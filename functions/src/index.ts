// Delivers case events published by the app to the Pub/Sub topic `case-events`:
// a notification for each person in charge, and for escalations the "alert delivered" mark on the ticket.
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { logger } from 'firebase-functions'

initializeApp()
const db = getFirestore()

interface CaseEvent {
  kind: 'escalated' | 'assigned' | 'followup'
  agency_id: string
  ticket_id: string
  to: string[]
  text: string
  contact?: string
}

export const onCaseEvent = onMessagePublished({ topic: 'case-events', region: 'asia-southeast1', retry: false }, async (event) => {
  const ev = event.data.message.json as CaseEvent
  const at = new Date().toISOString()
  const batch = db.batch()
  for (const to of ev.to) {
    batch.set(db.collection('notifications').doc(), { agency_id: ev.agency_id, to, ticket_id: ev.ticket_id, kind: ev.kind, text: ev.text, at, read: false })
  }
  if (ev.kind === 'escalated') {
    batch.update(db.collection('tickets').doc(ev.ticket_id), {
      alert_delivered_at: at,
      history: FieldValue.arrayUnion({ at, actor: 'case-events', action: 'alert_delivered', note: `Alert delivered to ${ev.contact ?? ev.to.join(', ')}` }),
    })
  }
  await batch.commit()
  logger.info('case event delivered', { kind: ev.kind, ticket: ev.ticket_id, to: ev.to })
})
