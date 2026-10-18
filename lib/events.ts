// Case events (escalations, assignments). In the cloud they are published to the Pub/Sub topic `case-events`
// and a Cloud Function (functions/src/index.ts) delivers them; locally they are delivered inline, same effect.
import type { Notification, Ticket } from './schemas'
import { STORE, now } from './store'

export const TOPIC = 'case-events'

export interface CaseEvent {
  kind: 'escalated' | 'assigned' | 'followup'
  agency_id: string
  ticket_id: string
  /** Team member ids to notify. */
  to: string[]
  text: string
  /** Shown in the ticket history when the alert is delivered. */
  contact?: string
}

type Topic = { publishMessage(m: { json: unknown }): Promise<string> }
const topics = new Map<string, Topic>()

export const pubsubOn = () => process.env.EMBRACE_PUBSUB === 'on'

/** Publishes a JSON message to a Pub/Sub topic. */
export async function publishTo(name: string, json: unknown): Promise<void> {
  let t = topics.get(name)
  if (!t) {
    const { PubSub } = await import('@google-cloud/pubsub')
    t = new PubSub().topic(name)
    topics.set(name, t)
  }
  await t.publishMessage({ json })
}

export async function publish(ev: CaseEvent): Promise<void> {
  if (pubsubOn()) return publishTo(TOPIC, ev)
  await deliver(ev)
}

/** What the Cloud Function does, against the app's store: notify each person and record alert delivery. */
async function deliver(ev: CaseEvent) {
  const at = now()
  for (const to of ev.to) {
    const n: Notification = {
      agency_id: ev.agency_id,
      to,
      ticket_id: ev.ticket_id,
      kind: ev.kind,
      text: ev.text,
      at,
      read: false,
    }
    await STORE.addNotification(n)
  }
  if (ev.kind === 'escalated') {
    const t = await STORE.get(ev.ticket_id)
    if (!t) return
    const fields: Partial<Ticket> = {
      alert_delivered_at: at,
      history: [
        ...t.history,
        {
          at,
          actor: 'case-events',
          action: 'alert_delivered',
          note: `Alert delivered to ${ev.contact ?? ev.to.join(', ')}`,
        },
      ],
    }
    await STORE.update(ev.ticket_id, fields)
  }
}
