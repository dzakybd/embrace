// Deterministic routing rules. The LLM proposes; these rules decide.
//
// Escalation never depends on the model alone: agency keywords and safety flags force escalation
// even if the model under-rates urgency, and a model failure falls back to keywords plus manual review.
import type { Agency } from './agencies'
import type { Media, Policy, Triage, Urgency } from './schemas'

export const CONFIDENCE_FLOOR = 0.7
const RANK: Record<Urgency, number> = { low: 0, normal: 1, high: 2, critical: 3 }

/** `injection`: the input guardrail found instructions aimed at the model; a person then checks the case. */
export function decide(
  agency: Agency,
  text: string,
  triage: Triage | null,
  media: Media | null = null,
  injection = false,
): Policy {
  const esc = agency.escalation
  const lowered = `${text} ${media?.transcript ?? ''}`.toLowerCase()
  const hits = esc.keywords.filter((k) => lowered.includes(k))
  const reasons: string[] = []

  if (!triage) {
    if (hits.length) {
      reasons.push(`Model unavailable; keyword match: ${hits.join(', ')}`)
      return make(agency, 'escalated', escalationQueue(agency), 'critical', reasons)
    }
    reasons.push('Model unavailable; sent to manual review')
    return make(agency, 'manual_review', 'general', 'normal', reasons)
  }

  const categories = Object.fromEntries(agency.categories.map((c) => [c.id, c]))
  const urgency = triage.urgency
  let escalate = false

  if (urgency === 'critical') {
    escalate = true
    reasons.push(`Model rated critical: ${triage.urgency_reason}`)
  }
  const flagged = [...triage.flags, ...(triage.agency_flags ?? [])].filter((f) => esc.escalate_flags.includes(f)).sort()
  if (flagged.length) {
    escalate = true
    reasons.push(`Safety flag: ${[...new Set(flagged)].join(', ')}`)
  }
  if (esc.always_escalate_categories.includes(triage.category)) {
    escalate = true
    reasons.push(`Category '${triage.category}' always escalates`)
  }
  if (hits.length) {
    escalate = true
    reasons.push(`Keyword match: ${hits.join(', ')}`)
  }
  if (media?.safety_concern) {
    escalate = true
    reasons.push(`Attachment: ${media.safety_reason || 'safety concern'}`)
  }

  if (escalate) {
    const queue = categories[triage.category]?.queue ?? escalationQueue(agency)
    if (urgency !== 'critical') reasons.push(`Urgency raised from ${urgency} to critical`)
    return make(agency, 'escalated', queue, 'critical', reasons)
  }

  const cat = categories[triage.category]
  if (injection) {
    reasons.push('Input guardrail: the message contains instructions aimed at the AI; a person checks the triage')
    return make(agency, 'manual_review', cat?.queue ?? 'general', urgency, reasons)
  }
  if (!cat) {
    reasons.push(`Unknown category '${triage.category}'`)
    return make(agency, 'manual_review', 'general', urgency, reasons)
  }
  // Agency rule: some categories never go below a minimum urgency (e.g. disaster relief at least high).
  let final = urgency
  if (cat.min_urgency && RANK[cat.min_urgency] > RANK[urgency]) {
    final = cat.min_urgency
    reasons.push(`Urgency raised from ${urgency} to ${final}: minimum for '${triage.category}'`)
  }
  const floor = esc.confidence_floor ?? CONFIDENCE_FLOOR
  if (triage.confidence < floor) {
    reasons.push(`Low confidence ${triage.confidence.toFixed(2)} < ${floor}`)
    return make(agency, 'manual_review', cat.queue, final, reasons)
  }
  reasons.push(`Routed by category '${triage.category}' to ${agency.queues[cat.queue]}`)
  return make(agency, 'assigned', cat.queue, final, reasons)
}

function escalationQueue(agency: Agency): string {
  return agency.categories[0].queue
}

function make(agency: Agency, route: Policy['route'], queue: string, urgency: Urgency, reasons: string[]): Policy {
  return { route, queue, final_urgency: urgency, sla_hours: agency.sla_hours[urgency], reasons }
}
