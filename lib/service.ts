// Ticket lifecycle: run the agent pipeline on a new complaint, then officer actions.
import { InMemoryRunner, ReflectAndRetryModelPlugin, type Event } from '@google/adk'
import type { Part } from '@google/genai'
import { randomBytes } from 'node:crypto'
import { agencyById, picFor, supervisor, type Agency } from './agencies'
import { analystAgent } from './agents/analyst'
import { governance, log, recordGuard } from './agents/governance'
import { STEP_KEYS, initialState, pipeline } from './agents/pipeline'
import { publish } from './events'
import { detailsText, missingDetails, type Slot } from './details'
import { checkDraft, screenInput } from './guardrails'
import { decide } from './policy'
import type { Channel, HistoryItem, Intake, Policy, Ticket, TraceStep } from './schemas'
import { prefix } from './seed'
import { STORE, now } from './store'
import { telegramBot } from './channels'
import { send as tgSend } from './telegram'

const pipelineRunner = new InMemoryRunner({ agent: pipeline, appName: 'embrace', plugins: [governance] })
// The analyst calls tools; a malformed call is reflected back to the model once instead of failing the answer.
const analystRunner = new InMemoryRunner({
  agent: analystAgent,
  appName: 'embrace_analyst',
  plugins: [governance, new ReflectAndRetryModelPlugin({ maxRetries: 1, throwExceptionIfRetryExceeded: false })],
})

const entry = (actor: string, action: string, note = ''): HistoryItem => ({ at: now(), actor, action, note })

export function newTicketId(agency: Agency) {
  return `${prefix(agency)}-${now().slice(2, 10).replaceAll('-', '')}-${randomBytes(2).toString('hex').toUpperCase()}`
}

export type SubmitEvent =
  | { type: 'received'; ticket_id: string }
  | ({ type: 'step' } & TraceStep)
  | { type: 'done'; ticket: Ticket }

type Outputs = Record<string, unknown>

/** Runs the agent pipeline on a report and yields one trace step per agent, with the model and tokens it used.
 * A model failure never means silence: the keyword rules decide and a human reviews. */
async function* runAgents(
  agency: Agency, id: string, text: string, channel: Channel, media: { mime: string; data: string }[],
  opts: { noAi?: string; injection: boolean; state?: Record<string, unknown>; rerun?: boolean },
  outputs: Outputs,
): AsyncGenerator<TraceStep> {
  let mark = Date.now()
  let invocation = ''
  try {
    // Over the AI budget (rate limit): no model call; the same fallback as a model failure decides.
    if (opts.noAi) throw new Error(opts.noAi)
    const parts: Part[] = [{ text: 'Process this complaint.' }, ...media.map((m) => ({ inlineData: { mimeType: m.mime, data: m.data } }))]
    const events = pipelineRunner.runEphemeral({
      userId: agency.id,
      newMessage: { role: 'user', parts },
      stateDelta: { ...initialState(agency, id, text, channel, media.length > 0, opts.injection), ...opts.state },
    })
    for await (const ev of events as AsyncGenerator<Event>) {
      invocation ||= ev.invocationId
      const key = ev.author ? STEP_KEYS[ev.author] : undefined
      const delta = ev.actions?.stateDelta ?? {}
      if (key && key in delta) {
        const ms = Date.now() - mark
        mark = Date.now()
        outputs[key] = delta[key]
        const kind = key === 'policy' ? 'rules' : key === 'sop' ? 'search' : 'llm'
        const call = kind === 'llm' ? governance.last(ev.invocationId, ev.author!) : undefined
        yield {
          agent: ev.author!, kind, ms: call?.ms ?? ms, output: delta[key],
          ...(call ? { model: call.model, tokens_in: call.tokens_in, tokens_out: call.tokens_out } : {}),
          ...(opts.rerun ? { rerun: true } : {}),
        }
      }
    }
  } catch (err) {
    log('ERROR', 'pipeline_failed', { ticket: id, agency: agency.id, error: String(err).slice(0, 300) })
    if (!outputs.policy) {
      outputs.policy = decide(agency, text, null)
      yield { agent: 'policy_agent', kind: 'rules', ms: 0, output: outputs.policy, fallback: String(err).slice(0, 200), ...(opts.rerun ? { rerun: true } : {}) }
    }
  } finally {
    if (invocation) governance.take(invocation)
  }
}

/** Output guardrail on the drafted reply; findings are shown to the officer, who approves every reply anyway. */
function guardDraft(agency: Agency, id: string, text: string, outputs: Outputs): string[] {
  const draft = outputs.draft as { reply?: string } | undefined
  if (!draft?.reply) return []
  const sop = (outputs.sop as { url?: string }[] | undefined) ?? []
  const { warnings } = checkDraft(draft.reply, { original: text, ticketId: id, sopCount: sop.length, allowedUrls: sop.map((c) => c.url ?? '').filter(Boolean) })
  if (warnings.length) recordGuard('draft', agency.id, id)
  return warnings
}

async function notify(agency: Agency, id: string, policy: Policy, summary: string, picId: string) {
  try {
    if (policy.route === 'escalated') {
      const sup = supervisor(agency)
      const pic = agency.team.find((m) => m.id === picId) ?? sup
      await publish({ kind: 'escalated', agency_id: agency.id, ticket_id: id, to: [...new Set([sup.id, pic.id])], text: `Escalated: ${summary}`, contact: `${sup.name} and ${pic.name}` })
    } else {
      await publish({ kind: 'assigned', agency_id: agency.id, ticket_id: id, to: [picId], text: `New case: ${summary}` })
    }
  } catch (err) {
    log('ERROR', 'case_event_failed', { ticket: id, error: String(err).slice(0, 200) }) // the ticket is saved and visible in the queue either way
  }
}

/**
 * Creates a ticket and runs the agents, yielding progress events for the SSE stream. The last event has the ticket.
 * Attachments go to the model only; the ticket keeps their type and size plus what the media agent read from them.
 */
export async function* submit(
  agencyId: string,
  text: string,
  channel: Channel,
  reporter: Ticket['reporter'],
  media: { mime: string; data: string }[],
  opts: { noAi?: string; telegramChatId?: string } = {},
): AsyncGenerator<SubmitEvent> {
  const agency = (await agencyById(agencyId))!
  const id = newTicketId(agency)
  const ts = now()
  let ticket: Ticket = {
    id,
    agency_id: agencyId,
    channel,
    text,
    reporter,
    status: 'received',
    created_at: ts,
    updated_at: ts,
    attachments: media.map((m) => ({ mime: m.mime, bytes: Math.floor((m.data.length * 3) / 4) })),
    trace: [],
    history: [entry('system', 'received', `via ${channel}`)],
    seeded: false,
    telegram_chat_id: opts.telegramChatId ?? null,
  }
  await STORE.put(ticket)
  yield { type: 'received', ticket_id: id }

  // Input guardrail before any model call.
  const screen = screenInput(text)
  if (screen.injection) recordGuard('injection', agencyId, id)

  const trace: TraceStep[] = []
  const outputs: Outputs = {}
  for await (const step of runAgents(agency, id, text, channel, media, { noAi: opts.noAi, injection: screen.injection }, outputs)) {
    trace.push(step)
    yield { type: 'step', ...step }
  }

  const policy = outputs.policy as Policy
  const history = [...ticket.history, entry('agents', policy.route, policy.reasons.join('; '))]
  if (outputs.draft) history.push(entry('drafter_agent', 'draft_ready', 'Waiting for officer approval'))
  const pic = picFor(agency, policy.queue)
  history.push(entry('agents', 'assign', `Assigned to ${pic.name} (${pic.title})`))
  const missing = missingDetails(agency, outputs.intake as Intake | undefined)
  ticket = await STORE.update(id, {
    media: (outputs.media as Ticket['media']) ?? null,
    intake: (outputs.intake as Ticket['intake']) ?? null,
    triage: (outputs.triage as Ticket['triage']) ?? null,
    policy,
    draft: (outputs.draft as Ticket['draft']) ?? null,
    sop: (outputs.sop as Ticket['sop']) ?? [],
    trace,
    guard: { injection: screen.matches, draft: guardDraft(agency, id, text, outputs) },
    details: { missing, answers: {} },
    status: policy.route,
    alerted_at: policy.route === 'escalated' ? now() : null,
    assignee: pic.id,
    updated_at: now(),
    history,
  })
  const summary = (outputs.triage as { summary?: string } | undefined)?.summary ?? text.slice(0, 120)
  await notify(agency, id, policy, summary, pic.id)
  yield { type: 'done', ticket: (await STORE.get(id)) ?? ticket }
}

/**
 * Multi-turn intake: the citizen's answers to the missing-detail questions join the report and the agents run again
 * on the fuller picture. The re-run may raise urgency or escalate, never lower it; a reply already sent is kept.
 */
export async function addDetails(id: string, answers: Partial<Record<Slot, string>>): Promise<Ticket | null> {
  const t = await STORE.get(id)
  if (!t || !t.details) return null
  const given = Object.fromEntries(Object.entries(answers).filter(([k, v]) => t.details!.missing.includes(k) && v?.trim()).map(([k, v]) => [k, v!.trim().slice(0, 300)]))
  if (!Object.keys(given).length) return t
  const agency = (await agencyById(t.agency_id))!
  const addition = detailsText(given)
  const text = `${t.text}\n\n${addition}`
  const screen = screenInput(addition)
  if (screen.injection) recordGuard('injection', agency.id, id)
  const outputs: Outputs = {}
  const steps: TraceStep[] = []
  // Media was read on the first run; pass what it found instead of the files.
  const state = t.media ? { media: t.media } : {}
  for await (const step of runAgents(agency, id, text, t.channel, [], { injection: screen.injection || !!t.guard?.injection.length, state, rerun: true }, outputs)) steps.push(step)

  const before = t.policy!
  const after = outputs.policy as Policy
  const RANK = { low: 0, normal: 1, high: 2, critical: 3 }
  // Safety ratchet: an escalated case stays escalated; urgency only goes up.
  const keep = before.route === 'escalated' || RANK[after.final_urgency] < RANK[before.final_urgency]
  const policy: Policy = keep && after.route !== 'escalated'
    ? { ...before, reasons: [...before.reasons, 'Details added; urgency kept (re-runs never lower it)'] }
    : after
  const newlyEscalated = policy.route === 'escalated' && before.route !== 'escalated'
  const fields: Partial<Ticket> = {
    intake: (outputs.intake as Ticket['intake']) ?? t.intake,
    triage: (outputs.triage as Ticket['triage']) ?? t.triage,
    policy,
    trace: [...t.trace, ...steps],
    details: { ...t.details, answers: { ...t.details.answers, ...given }, refined_at: now() },
    history: [...t.history, entry('citizen', 'details_added', addition.slice(0, 300)), entry('agents', 'rerun', policy.reasons.join('; '))],
    updated_at: now(),
  }
  if (!t.sent_reply && outputs.draft) {
    fields.draft = outputs.draft as Ticket['draft']
    fields.sop = (outputs.sop as Ticket['sop']) ?? t.sop
    fields.guard = { injection: [...(t.guard?.injection ?? []), ...screen.matches], draft: guardDraft(agency, id, text, outputs) }
  }
  if (newlyEscalated) {
    fields.status = 'escalated'
    fields.alerted_at = now()
  }
  const updated = await STORE.update(id, fields)
  if (newlyEscalated) await notify(agency, id, policy, fields.triage?.summary ?? t.text.slice(0, 120), t.assignee ?? picFor(agency, policy.queue).id)
  else if (t.assignee) {
    await publish({ kind: 'followup', agency_id: t.agency_id, ticket_id: id, to: [t.assignee], text: `Details added to ${id}` }).catch((e) => log('ERROR', 'case_event_failed', { ticket: id, error: String(e).slice(0, 200) }))
  }
  return updated
}

const ACTIONS: Record<string, [Ticket['status'] | null, string]> = {
  start: ['in_progress', 'Officer started work'],
  send_reply: ['in_progress', 'Reply approved and sent'],
  resolve: ['resolved', 'Case resolved'],
  reopen: ['in_progress', 'Case reopened'],
  reassign: [null, 'Reassigned'],
  assign: [null, 'Delegated'],
}
export const ACTION_NAMES = Object.keys(ACTIONS)

export async function act(id: string, action: string, officer: string, note = '', reply?: string, queue?: string, assignee?: string) {
  const t = await STORE.get(id)
  if (!t) return null
  const [status, label0] = ACTIONS[action]
  let label = label0
  const ts = now()
  const fields: Partial<Ticket> = { updated_at: ts }
  if (status) fields.status = status
  let delivery = ''
  if (action === 'send_reply') {
    fields.sent_reply = reply || t.draft?.reply || ''
    if (t.telegram_chat_id) {
      try {
        const bot = await telegramBot(t.agency_id)
        if (!bot) throw new Error('no Telegram bot is connected for this agency')
        await tgSend(bot.token, t.telegram_chat_id, fields.sent_reply)
        delivery = ` · delivered to the citizen on Telegram (@${bot.username})`
      } catch (err) {
        delivery = ` · Telegram delivery failed: ${String(err).slice(0, 120)}`
      }
    }
    fields.reply_edited = !!reply && reply !== t.draft?.reply
    fields.responded_at = t.responded_at ?? ts
  }
  if (action === 'resolve') fields.resolved_at = ts
  if (action === 'reassign' && queue && t.policy) {
    fields.policy = { ...t.policy, queue }
    fields.status = 'assigned'
    label = `Reassigned to ${queue}`
  }
  const agency = (await agencyById(t.agency_id))!
  if (action === 'reassign' && queue) fields.assignee = picFor(agency, queue).id
  const member = agency.team.find((m) => m.id === (action === 'assign' ? assignee : fields.assignee))
  if (action === 'assign') {
    if (!member) return null
    fields.assignee = member.id
    label = `Delegated to ${member.name} (${member.title})`
  }
  fields.history = [...t.history, entry(officer, action, (note ? `${label}: ${note}` : label) + delivery)]
  const updated = await STORE.update(id, fields)
  if (member && member.id !== t.assignee) {
    await publish({ kind: 'assigned', agency_id: t.agency_id, ticket_id: id, to: [member.id], text: `${officer} delegated a case to you: ${t.triage?.summary ?? t.text.slice(0, 120)}${note ? ` (${note})` : ''}` }).catch((e) => console.error('case event failed', e))
  }
  return updated
}

export async function askAnalyst(agencyId: string, question: string) {
  const agency = (await agencyById(agencyId))!
  const toolsUsed: string[] = []
  let answer = ''
  const events = analystRunner.runEphemeral({
    userId: agencyId,
    newMessage: { role: 'user', parts: [{ text: question }] },
    stateDelta: { agency_id: agencyId, agency_name: agency.name },
  })
  for await (const ev of events as AsyncGenerator<Event>) {
    for (const p of ev.content?.parts ?? []) {
      if (p.functionCall?.name) toolsUsed.push(p.functionCall.name)
    }
    const text = (ev.content?.parts ?? []).map((p) => p.text ?? '').join('')
    if (ev.author === 'analyst_agent' && text && !(ev.content?.parts ?? []).some((p) => p.functionCall)) answer = text
  }
  return { answer, tools_used: toolsUsed }
}

/** A later message from the same citizen joins their open case (no AI call) and notifies the person in charge. */
export async function addFollowup(id: string, text: string) {
  const t = await STORE.get(id)
  if (!t) return null
  const at = now()
  const updated = await STORE.update(id, {
    followups: [...(t.followups ?? []), { at, text }],
    history: [...t.history, entry('citizen', 'followup', text.slice(0, 300))],
    updated_at: at,
  })
  if (t.assignee) {
    await publish({ kind: 'followup', agency_id: t.agency_id, ticket_id: id, to: [t.assignee], text: `New message on ${id}: ${text.slice(0, 120)}` }).catch((e) => console.error('case event failed', e))
  }
  return updated
}
