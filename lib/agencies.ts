// Agency packs: taxonomy, queues, escalation rules and SOP index per agency (agencies/<id>/).
import childProtection from '@/agencies/child_protection/agency.json'
import socialAssistance from '@/agencies/social_assistance/agency.json'
import idDemak from '@/agencies/id_demak/agency.json'
import type { Urgency } from './schemas'

export interface Agency {
  id: string
  name: string
  short_name: string
  country: string
  categories: { id: string; label: string; queue: string }[]
  queues: Record<string, string>
  escalation: {
    always_escalate_categories: string[]
    escalate_flags: string[]
    keywords: string[]
    escalation_contact: string
  }
  sla_hours: Record<Urgency, number>
  emergency_line: string
  reply_signature: string
}

export const AGENCIES: Record<string, Agency> = Object.fromEntries(
  [childProtection, socialAssistance, idDemak].map((a) => [a.id, a as Agency]),
)

export function getAgency(id: string): Agency | undefined {
  return AGENCIES[id]
}

export function taxonomyText(a: Agency): string {
  return a.categories.map((c) => `- ${c.id}: ${c.label}`).join('\n')
}

/** What the browser needs to know about an agency. */
export function publicAgency(a: Agency) {
  const { id, name, short_name, country, categories, queues, sla_hours, emergency_line } = a
  return { id, name, short_name, country, categories, queues, sla_hours, emergency_line, escalation_contact: a.escalation.escalation_contact }
}
export type PublicAgency = ReturnType<typeof publicAgency>
