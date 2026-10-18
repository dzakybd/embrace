// Structured outputs produced by the agents, plus the ticket record.
import { z } from 'zod'

export const URGENCIES = ['critical', 'high', 'normal', 'low'] as const
export const FLAGS = [
  'child_safety',
  'immediate_danger',
  'self_harm',
  'basic_needs_crisis',
  'repeat_complaint',
  'possible_fraud',
  'insufficient_info',
] as const

export const MediaResult = z.object({
  transcript: z
    .string()
    .nullable()
    .describe('Verbatim transcript of the voice note in its own language; null if no audio'),
  photo_description: z
    .string()
    .nullable()
    .describe('What the photos show, in English, with ID and card numbers masked; null if no photo'),
  safety_concern: z.boolean().describe('True if the media shows injury, ongoing danger or a threat to someone'),
  safety_reason: z.string().describe('Short reason when safety_concern is true, else empty'),
})

export const IntakeResult = z.object({
  language: z.string().describe("ISO 639-1 code of the main language, e.g. 'en', 'es', 'id', 'jv', 'tl'"),
  entities: z.object({
    location: z.string().nullable().describe('Village, district or city mentioned, normalised'),
    institution: z.string().nullable().describe('School, office, shop or facility mentioned'),
    aid_program: z.string().nullable().describe('Benefit or aid programme mentioned, if any'),
    victim_age: z.string().nullable().describe('Age or age group of the affected person'),
    incident_time: z.string().nullable().describe('When it happened, as stated'),
  }),
  pii_types: z
    .array(z.string())
    .describe('Kinds of personal data present: name, phone, id_number, address, child_name, ...'),
  masked_text: z
    .string()
    .describe(
      'The complaint in its original language with personal data replaced by [NAME], [ID], [PHONE], [ADDRESS], [CHILD_NAME]',
    ),
  restated: z.string().describe('One-paragraph neutral restatement in English'),
})

export const TriageResult = z.object({
  category: z.string().describe('Category id from the agency taxonomy'),
  urgency: z.enum(URGENCIES),
  urgency_reason: z.string().describe('Short reason, quoting the decisive phrase from the complaint'),
  sentiment: z.enum(['distressed', 'angry', 'worried', 'neutral', 'positive']),
  flags: z.array(z.enum(FLAGS)),
  summary: z.string().describe('At most 2 sentences in English, no personal data'),
  confidence: z.number().min(0).max(1).describe('Confidence in category and urgency together'),
})

export const DraftReply = z.object({
  reply: z.string().describe("Reply to the complainant in the complainant's language"),
  next_step: z.string().describe('What the officer should do next, one sentence in English'),
})

export type Urgency = (typeof URGENCIES)[number]
export type Media = z.infer<typeof MediaResult>
export type Intake = z.infer<typeof IntakeResult>
export type Triage = z.infer<typeof TriageResult>
export type Draft = z.infer<typeof DraftReply>

export interface Policy {
  route: 'escalated' | 'assigned' | 'manual_review'
  queue: string
  final_urgency: Urgency
  sla_hours: number
  reasons: string[]
}

export interface Citation {
  n: number
  doc: string
  title: string
  url: string
  loc: string
  text: string
  score: number
}

export type Status = 'received' | 'escalated' | 'manual_review' | 'assigned' | 'in_progress' | 'resolved'
/** A message for one team member, written by the case-events Cloud Function (or inline when running locally). */
export interface Notification {
  id?: string
  agency_id: string
  to: string
  ticket_id: string
  kind: 'escalated' | 'assigned' | 'followup'
  text: string
  at: string
  read: boolean
}

export type Channel = 'web' | 'whatsapp' | 'email' | 'social' | 'telegram'

export interface TraceStep {
  agent: string
  kind: 'llm' | 'rules' | 'search'
  ms: number
  output: unknown
  fallback?: string
  /** Model calls only: the model that answered and its token usage (from the governance plugin). */
  model?: string
  tokens_in?: number
  tokens_out?: number
  /** Cloud Trace id of the run (model steps). */
  trace_id?: string
  /** Set on steps of the re-run after the citizen added details. */
  rerun?: boolean
}

export interface HistoryItem {
  at: string
  actor: string
  action: string
  note: string
}

/** A ticket as stored in Firestore. Dates are ISO strings. */
export interface Ticket {
  id: string
  agency_id: string
  channel: Channel
  text: string
  reporter: { name?: string | null; contact?: string | null }
  status: Status
  created_at: string
  updated_at: string
  responded_at?: string | null
  resolved_at?: string | null
  attachments: { mime: string; bytes: number }[]
  media?: Media | null
  intake?: Intake | null
  triage?: Triage | null
  policy?: Policy | null
  draft?: Draft | null
  sop?: Citation[]
  sent_reply?: string
  reply_edited?: boolean
  alerted_at?: string | null
  alert_delivered_at?: string | null
  assignee?: string | null
  /** Set when the report came from Telegram; approved replies are sent back to this chat. */
  telegram_chat_id?: string | null
  followups?: { at: string; text: string }[]
  /** Guardrail findings: instructions aimed at the AI in the report, problems in the drafted reply. */
  guard?: { injection: string[]; draft: string[] }
  /** Details the agency needs that the report lacks, and the citizen's answers once given. */
  details?: { missing: string[]; answers: Record<string, string>; refined_at?: string | null }
  /** The agency procedure staff follow for this case, and the stages done (indexes); the citizen sees it on tracking. */
  progress?: { procedure: string; done: number[] }
  trace: TraceStep[]
  history: HistoryItem[]
  seeded: boolean
}
