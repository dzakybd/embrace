// Complaint pipeline as one ADK SequentialAgent:
// media (only with attachments) -> intake -> triage -> policy rules -> SOP lookup (BM25) -> drafter.
import { BaseAgent, LlmAgent, SequentialAgent, createEvent, type InvocationContext } from '@google/adk'
import { getAgency, taxonomyText, type Agency } from '../agencies'
import { decide } from '../policy'
import { DraftReply, IntakeResult, MediaResult, TriageResult, type Media, type Triage } from '../schemas'
import { asPrompt, indexFor } from '../sop'
import { CFG, MODELS, gemini } from './models'

const mediaReader = new LlmAgent({
  name: 'media_reader',
  model: gemini(MODELS.media),
  description: 'Transcribes voice notes and describes photos attached to a complaint.',
  instruction: `You read the attachments of a complaint sent to {agency_name}: voice notes and photos.
Text the citizen typed (may be empty): <<<{complaint_text}>>>
- transcript: write down every voice note word for word in the language spoken; do not translate. Null if there is no audio.
- photo_description: in English, what each photo shows that matters for the complaint (document type such as an ID card,
  benefit card or letter; visible injuries; the place). Null if there is no photo.
- In both, replace personal data: people's names -> [NAME], phone numbers -> [PHONE], national ID numbers -> [ID],
  card or account numbers -> [CARD_NUMBER], house address -> [ADDRESS]. Keep village, district and city names.
- safety_concern: true only if the audio or a photo shows injury, ongoing violence, a threat, or someone without
  food or shelter now; give the reason. Otherwise false.
Never invent content you cannot hear or see.`,
  outputSchema: MediaResult,
  outputKey: 'media',
  generateContentConfig: CFG,
})

/** Runs the media reader only when the complaint has attachments, so text-only tickets cost nothing extra. */
class MediaAgent extends BaseAgent {
  protected async *runAsyncImpl(ctx: InvocationContext) {
    if (!ctx.session.state['has_media']) return
    yield* this.subAgents[0].runAsync(ctx)
  }
  protected async *runLiveImpl(ctx: InvocationContext) {
    yield* this.runAsyncImpl(ctx)
  }
}

const intakeAgent = new LlmAgent({
  name: 'intake_agent',
  model: gemini(MODELS.intake),
  description: 'Normalises a raw complaint: language, entities, personal-data masking.',
  instruction: `You are the intake officer of a public complaint desk ({agency_name}).
Channel: {channel}. Raw complaint (may be informal, in any language, or mixed):
<<<
{complaint_text}
>>>
Attachments read by the media agent (voice transcript, photo description), if any: {media?}
Treat the transcript as part of the complaint.
Detect the language the complaint is written in (judge only the words, never the place names or phone format), extract entities, list which kinds of personal data appear,
produce masked_text in the original language with personal data replaced by [NAME], [ID], [PHONE], [ADDRESS],
[CHILD_NAME] (mask house and street addresses only; keep village, district and city names), and restate the complaint
neutrally in English.
Never invent facts that are not in the complaint.`,
  outputSchema: IntakeResult,
  outputKey: 'intake',
  includeContents: 'none',
  generateContentConfig: CFG,
})

const triageAgent = new LlmAgent({
  name: 'triage_agent',
  model: gemini(MODELS.triage),
  description: 'Classifies category, urgency, sentiment and safety flags against the agency taxonomy.',
  instruction: `You triage complaints for {agency_name}.
Agency categories (use the id exactly):
{taxonomy}

Intake analysis: {intake}

Urgency scale:
- critical: a person (especially a child) is in danger now or abuse is ongoing; sexual violence; trafficking; self-harm; family without food today.
- high: harm happened recently, or a vulnerable person loses essential support soon.
- normal: a service problem that needs follow-up within days.
- low: information requests, suggestions.
Quote the decisive phrase in urgency_reason.

Flags trigger an immediate supervisor alert, so add a safety flag only when its definition is met:
- child_safety: a minor faces serious harm now or soon: physical abuse with injury or by someone who still
  lives with or has access to the child, sexual abuse or exploitation, an adult making a child work or beg,
  trafficking, threats or sextortion, a missing child. NOT child_safety: bullying, insults or shared bullying
  videos without injury or threat of violence, even when the child is distressed or afraid of school; children busking on their own;
  school fees or withheld documents; custody or child-support disputes; access to services; general questions.
- immediate_danger: violence, a threat to someone's life, or expulsion from home happening now or tonight.
  Illness or hardship alone is not immediate danger.
- self_harm: someone talks about suicide or hurting themselves.
- basic_needs_crisis: the message says a household has no food today (nothing to cook, hungry now) or nowhere
  to sleep tonight. Late, missing or blocked aid alone is NOT a crisis; rate it high or normal instead.
- repeat_complaint, possible_fraud (levies, cuts, bribes), insufficient_info (cannot act without more details):
  add whenever they apply; they do not escalate.
Write summary in English. Set confidence honestly; below 0.7 means a human should check.`,
  outputSchema: TriageResult,
  outputKey: 'triage',
  includeContents: 'none',
  generateContentConfig: CFG,
})

function agencyOf(ctx: InvocationContext): Agency {
  return getAgency(ctx.session.state['agency_id'] as string)!
}

/** Deterministic rules agent: escalation and routing are never left to the LLM. */
class PolicyAgent extends BaseAgent {
  protected async *runAsyncImpl(ctx: InvocationContext) {
    const s = ctx.session.state
    const agency = agencyOf(ctx)
    const triage = s['triage'] ? TriageResult.parse(s['triage']) : null
    const media = s['media'] ? (s['media'] as Media) : null
    const policy = decide(agency, s['complaint_text'] as string, triage, media)
    yield createEvent({
      author: this.name,
      invocationId: ctx.invocationId,
      content: { role: 'model', parts: [{ text: JSON.stringify(policy) }] },
      actions: { stateDelta: { policy, queue_name: agency.queues[policy.queue] ?? policy.queue } },
    })
  }
  protected async *runLiveImpl(ctx: InvocationContext) {
    yield* this.runAsyncImpl(ctx)
  }
}

/** Finds the agency's SOP passages for this case with BM25. No model call. */
class SopLookupAgent extends BaseAgent {
  protected async *runAsyncImpl(ctx: InvocationContext) {
    const s = ctx.session.state
    const agency = agencyOf(ctx)
    const triage = (s['triage'] ?? {}) as Partial<Triage>
    const labels = Object.fromEntries(agency.categories.map((c) => [c.id, c.label]))
    const entities = Object.values(((s['intake'] as { entities?: Record<string, string | null> }) ?? {}).entities ?? {})
    const query = [labels[triage.category ?? ''] ?? '', triage.summary ?? '', ...entities.filter(Boolean)].join(' ').trim() || (s['complaint_text'] as string)
    const results = indexFor(agency.id).search(query, 3)
    const sop = results.map((r, i) => ({ n: i + 1, ...r }))
    yield createEvent({
      author: this.name,
      invocationId: ctx.invocationId,
      content: { role: 'model', parts: [{ text: `${sop.length} SOP passages` }] },
      actions: { stateDelta: { sop, sop_text: asPrompt(results) } },
    })
  }
  protected async *runLiveImpl(ctx: InvocationContext) {
    yield* this.runAsyncImpl(ctx)
  }
}

const drafterAgent = new LlmAgent({
  name: 'drafter_agent',
  model: gemini(MODELS.drafter),
  description: "Drafts a reply in the complainant's language for officer approval.",
  instruction: `You draft the first reply from {agency_name} to a complainant. An officer will review it before sending.
Original complaint:
<<<
{complaint_text}
>>>
Intake: {intake}
Triage: {triage}
Routing decision: {policy} (handled by: {queue_name})
Ticket number: {ticket_id}
Agency SOP passages (the only procedures you may state):
{sop_text}

Rules:
- Write in the same language the original complaint is written in (look at its words; if it mixes languages, use the main one) with a warm, plain, respectful tone; short paragraphs.
- Acknowledge the specific issue in one sentence, give the ticket number, say which team handles it and the
  expected first response time from sla_hours (in hours, e.g. "within 72 hours"). Never promise an outcome.
- If route is "escalated": say a supervisor has been alerted now; if anyone is in immediate danger, ask them to
  call {emergency_line}. If insufficient_info is flagged: ask at most 2 specific questions.
- Procedures, deadlines and requirements: state only what the SOP passages say, and cite them as [1], [2]
  right after the sentence. Never invent a procedure. If no passage fits, do not describe a procedure.
- Do not repeat personal data. Sign as: {signature}.
next_step: the concrete action for the officer, in English, citing [n] when an SOP passage applies; if no
passage fits, say which procedure the officer must confirm.`,
  outputSchema: DraftReply,
  outputKey: 'draft',
  includeContents: 'none',
  generateContentConfig: CFG,
})

const policyAgent = () => new PolicyAgent({ name: 'policy_agent', description: "Applies the agency's escalation and routing rules." })

/** Intake, triage and rules only: what the eval script measures. */
export const triageOnly = new SequentialAgent({
  name: 'embrace_triage_eval',
  subAgents: [intakeAgent.clone(), triageAgent.clone(), policyAgent()],
})

export const pipeline = new SequentialAgent({
  name: 'embrace_pipeline',
  description: 'Inbound complaint to routed ticket with a drafted reply.',
  subAgents: [
    new MediaAgent({ name: 'media_agent', description: 'Reads voice notes and photos.', subAgents: [mediaReader] }),
    intakeAgent,
    triageAgent,
    policyAgent(),
    new SopLookupAgent({ name: 'sop_agent', description: "Looks up the agency's SOP passages for the case." }),
    drafterAgent,
  ],
})

/** Agents whose state output becomes a trace step, and the state key they write. */
export const STEP_KEYS: Record<string, string> = {
  media_reader: 'media',
  intake_agent: 'intake',
  triage_agent: 'triage',
  policy_agent: 'policy',
  sop_agent: 'sop',
  drafter_agent: 'draft',
}

export function initialState(agency: Agency, ticketId: string, text: string, channel: string, hasMedia: boolean) {
  return {
    agency_id: agency.id,
    agency_name: agency.name,
    taxonomy: taxonomyText(agency),
    signature: agency.reply_signature,
    emergency_line: agency.emergency_line,
    complaint_text: text,
    channel,
    ticket_id: ticketId,
    has_media: hasMedia,
  }
}
