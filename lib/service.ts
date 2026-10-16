// Ticket lifecycle: run the agent pipeline on a new complaint, then officer actions.
import { InMemoryRunner, type Event } from '@google/adk'
import type { Part } from '@google/genai'
import { randomBytes } from 'node:crypto'
import { getAgency, type Agency } from './agencies'
import { analystAgent } from './agents/analyst'
import { STEP_KEYS, initialState, pipeline } from './agents/pipeline'
import { decide } from './policy'
import type { Channel, HistoryItem, Policy, Ticket, TraceStep } from './schemas'
import { prefix } from './seed'
import { STORE, now } from './store'

const pipelineRunner = new InMemoryRunner({ agent: pipeline, appName: 'embrace' })
const analystRunner = new InMemoryRunner({ agent: analystAgent, appName: 'embrace_analyst' })

const entry = (actor: string, action: string, note = ''): HistoryItem => ({ at: now(), actor, action, note })

export function newTicketId(agency: Agency) {
  return `${prefix(agency)}-${now().slice(2, 10).replaceAll('-', '')}-${randomBytes(2).toString('hex').toUpperCase()}`
}

export type SubmitEvent =
  | { type: 'received'; ticket_id: string }
  | ({ type: 'step' } & TraceStep)
  | { type: 'done'; ticket: Ticket }

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
): AsyncGenerator<SubmitEvent> {
  const agency = getAgency(agencyId)!
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
  }
  await STORE.put(ticket)
  yield { type: 'received', ticket_id: id }

  const trace: TraceStep[] = []
  const outputs: Record<string, unknown> = {}
  let mark = Date.now()
  try {
    const parts: Part[] = [{ text: 'Process this complaint.' }, ...media.map((m) => ({ inlineData: { mimeType: m.mime, data: m.data } }))]
    const events = pipelineRunner.runEphemeral({
      userId: agencyId,
      newMessage: { role: 'user', parts },
      stateDelta: initialState(agency, id, text, channel, media.length > 0),
    })
    for await (const ev of events as AsyncGenerator<Event>) {
      const key = ev.author ? STEP_KEYS[ev.author] : undefined
      const delta = ev.actions?.stateDelta ?? {}
      if (key && key in delta) {
        const ms = Date.now() - mark
        mark = Date.now()
        outputs[key] = delta[key]
        const step: TraceStep = { agent: ev.author!, kind: key === 'policy' ? 'rules' : key === 'sop' ? 'search' : 'llm', ms, output: delta[key] }
        trace.push(step)
        yield { type: 'step', ...step }
      }
    }
  } catch (err) {
    console.error(`pipeline failed for ${id}`, err)
    if (!outputs.policy) {
      // Model failure never means silence: keyword rules decide and a human reviews.
      outputs.policy = decide(agency, text, null)
      const step: TraceStep = { agent: 'policy_agent', kind: 'rules', ms: 0, output: outputs.policy, fallback: String(err).slice(0, 200) }
      trace.push(step)
      yield { type: 'step', ...step }
    }
  }

  const policy = outputs.policy as Policy
  const history = [...ticket.history, entry('agents', policy.route, policy.reasons.join('; '))]
  if (outputs.draft) history.push(entry('drafter_agent', 'draft_ready', 'Waiting for officer approval'))
  if (policy.route === 'escalated') {
    // The escalation alert: recorded in Firestore `alerts`, shown to the on-call supervisor in the console.
    await STORE.addAlert({
      ticket_id: id,
      agency_id: agencyId,
      contact: agency.escalation.escalation_contact,
      urgency: policy.final_urgency,
      summary: (outputs.triage as { summary?: string } | undefined)?.summary ?? '',
      at: now(),
    })
    history.push(entry('system', 'alert_sent', `Alert sent to ${agency.escalation.escalation_contact}`))
  }
  ticket = await STORE.update(id, {
    media: (outputs.media as Ticket['media']) ?? null,
    intake: (outputs.intake as Ticket['intake']) ?? null,
    triage: (outputs.triage as Ticket['triage']) ?? null,
    policy,
    draft: (outputs.draft as Ticket['draft']) ?? null,
    sop: (outputs.sop as Ticket['sop']) ?? [],
    trace,
    status: policy.route,
    alerted_at: policy.route === 'escalated' ? now() : null,
    updated_at: now(),
    history,
  })
  yield { type: 'done', ticket }
}

const ACTIONS: Record<string, [Ticket['status'] | null, string]> = {
  start: ['in_progress', 'Officer started work'],
  send_reply: ['in_progress', 'Reply approved and sent'],
  resolve: ['resolved', 'Case resolved'],
  reopen: ['in_progress', 'Case reopened'],
  reassign: [null, 'Reassigned'],
}
export const ACTION_NAMES = Object.keys(ACTIONS)

export async function act(id: string, action: string, officer: string, note = '', reply?: string, queue?: string) {
  const t = await STORE.get(id)
  if (!t) return null
  const [status, label0] = ACTIONS[action]
  let label = label0
  const ts = now()
  const fields: Partial<Ticket> = { updated_at: ts }
  if (status) fields.status = status
  if (action === 'send_reply') {
    fields.sent_reply = reply || t.draft?.reply || ''
    fields.reply_edited = !!reply && reply !== t.draft?.reply
    fields.responded_at = t.responded_at ?? ts
  }
  if (action === 'resolve') fields.resolved_at = ts
  if (action === 'reassign' && queue && t.policy) {
    fields.policy = { ...t.policy, queue }
    fields.status = 'assigned'
    label = `Reassigned to ${queue}`
  }
  fields.history = [...t.history, entry(officer, action, note || label)]
  return STORE.update(id, fields)
}

export async function askAnalyst(agencyId: string, question: string) {
  const agency = getAgency(agencyId)!
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
