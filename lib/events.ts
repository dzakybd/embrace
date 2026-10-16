// Case events (escalations, assignments). In the cloud they are published to the Pub/Sub topic `case-events`
// and a Cloud Function (functions/src/index.ts) delivers them; locally they are delivered inline, same effect.
import type { Notification, Ticket } from './schemas'
import { STORE, now } from './store'

export const TOPIC = 'case-events'

export interface CaseEvent {
  kind: 'escalated' | 'assigned'
  agency_id: string
  ticket_id: string
  /** Team member ids to notify. */
  to: string[]
  text: string
  /** Shown in the ticket history when the alert is delivered. */
  contact?: string
}

let topic: { publishMessage(m: { json: unknown }): Promise<string> } | null = null

export async function publish(ev: CaseEvent): Promise<void> {
  if (process.env.EMBRACE_PUBSUB === 'on') {
    if (!topic) {
      const { PubSub } = await import('@google-cloud/pubsub')
      topic = new PubSub().topic(TOPIC)
    }
    await topic.publishMessage({ json: ev })
    return
  }
  await deliver(ev)
}

/** What the Cloud Function does, against the app's store: notify each person and record alert delivery. */
async function deliver(ev: CaseEvent) {
  const at = now()
  for (const to of ev.to) {
    const n: Notification = { agency_id: ev.agency_id, to, ticket_id: ev.ticket_id, kind: ev.kind, text: ev.text, at, read: false }
    await STORE.addNotification(n)
  }
  if (ev.kind === 'escalated') {
    const t = await STORE.get(ev.ticket_id)
    if (!t) return
    const fields: Partial<Ticket> = {
      alert_delivered_at: at,
      history: [...t.history, { at, actor: 'case-events', action: 'alert_delivered', note: `Alert delivered to ${ev.contact ?? ev.to.join(', ')}` }],
    }
    await STORE.update(ev.ticket_id, fields)
  }
}
