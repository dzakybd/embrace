// Agency packs: taxonomy, queues, escalation rules and SOP index per agency (agencies/<id>/).
import childProtection from '@/agencies/child_protection/agency.json'
import socialServices from '@/agencies/social_services/agency.json'
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
  team: TeamMember[]
}

export interface TeamMember {
  id: string
  name: string
  role: 'leader' | 'supervisor' | 'officer'
  title: string
  queues: string[]
}

export const AGENCIES: Record<string, Agency> = Object.fromEntries(
  [socialServices, childProtection].map((a) => [a.id, a as Agency]),
)

export function getAgency(id: string): Agency | undefined {
  return AGENCIES[id]
}

export function supervisor(a: Agency): TeamMember {
  return a.team.find((m) => m.role === 'supervisor') ?? a.team[0]
}

/** The person in charge (PIC) of a queue: its first officer, else the supervisor. */
export function picFor(a: Agency, queue: string): TeamMember {
  return a.team.find((m) => m.role === 'officer' && m.queues.includes(queue)) ?? supervisor(a)
}

export function taxonomyText(a: Agency): string {
  return a.categories.map((c) => `- ${c.id}: ${c.label}`).join('\n')
}

/** What the browser needs to know about an agency. */
export function publicAgency(a: Agency) {
  const { id, name, short_name, country, categories, queues, sla_hours, emergency_line, team } = a
  return { id, name, short_name, country, categories, queues, sla_hours, emergency_line, team, escalation_contact: a.escalation.escalation_contact }
}
export type PublicAgency = ReturnType<typeof publicAgency>
