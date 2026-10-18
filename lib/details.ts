// Multi-turn intake: the details an agency needs to act, which of them a report lacks, and how answers join the case.
// Asking is plain code with fixed, translated questions (no model call); the case is created and escalated first,
// so a question never delays an urgent report.
import type { Agency } from './agencies'
import type { Intake } from './schemas'

export const SLOTS = ['location', 'victim_age', 'incident_time'] as const
export type Slot = (typeof SLOTS)[number]

/** Asked at most this many times per report, so citizens are not interrogated. */
export const MAX_QUESTIONS = 2
const DEFAULT_REQUIRED: Slot[] = ['location', 'incident_time']

export const QUESTION: Record<Slot, string> = {
  location: 'Where did this happen? Please name the village or district and the city.',
  victim_age: 'How old is the person affected? If it is a child, an approximate age is fine.',
  incident_time: 'When did this happen, and is it still happening now?',
}
export const LABEL: Record<Slot, string> = {
  location: 'Where',
  victim_age: 'Age of the person affected',
  incident_time: 'When',
}

export const requiredDetails = (agency: Agency): Slot[] =>
  (agency.required_details ?? DEFAULT_REQUIRED).filter((s): s is Slot => (SLOTS as readonly string[]).includes(s))

/** The agency's required details that the intake agent did not find in the report, in the agency's order. */
export function missingDetails(agency: Agency, intake: Intake | null | undefined): Slot[] {
  return requiredDetails(agency)
    .filter((s) => !intake?.entities?.[s]?.trim())
    .slice(0, MAX_QUESTIONS)
}

/** The citizen's answers as one block appended to the report text, so the agents read them in context. */
export function detailsText(answers: Partial<Record<Slot, string>>): string {
  const lines = SLOTS.filter((s) => answers[s]?.trim()).map((s) => `- ${LABEL[s]}: ${answers[s]!.trim().slice(0, 300)}`)
  return lines.length ? `Additional details from the citizen:\n${lines.join('\n')}` : ''
}
