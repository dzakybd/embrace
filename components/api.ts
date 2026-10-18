import { adminFetch } from './adminFetch'
import type { ProcedureT } from './Procedures'

export interface Resource {
  id: string
  kind: 'official' | 'social' | 'hotline' | 'partner' | 'link'
  name: string
  name_id?: string
  note?: string
  note_id?: string
  url?: string
  phone?: string
  public: boolean
}

export type Urgency = 'critical' | 'high' | 'normal' | 'low'
export type Status = 'received' | 'escalated' | 'manual_review' | 'assigned' | 'in_progress' | 'resolved'
export type Channel = 'web' | 'whatsapp' | 'email' | 'social' | 'telegram'

export interface Agency {
  id: string
  name: string
  short_name: string
  categories: { id: string; label: string; label_id?: string; queue: string; min_urgency?: Urgency; laws?: string[] }[]
  queues: Record<string, string>
  country: string
  procedures: ProcedureT[]
  resources: Resource[]
  sla_hours: Record<Urgency, number>
  emergency_line: string
  escalation_contact: string
  team: TeamMember[]
  description?: string
  reply_signature: string
  escalation: {
    always_escalate_categories: string[]
    keywords: string[]
    escalate_flags: string[]
    confidence_floor?: number
  }
  custom: boolean
  edited: boolean
  telegram_bot: string | null
  logo: string | null
  name_id: string
  short_name_id: string
  description_id: string
  emergency_line_id: string
}

export interface BotStatus {
  reachable: boolean
  name: string | null
  webhook_ok: boolean
  pending: number
  last_error: { message: string; at: string } | null
  description: boolean
  commands: number
  photo: boolean
}
export interface SetupStep {
  step: string
  ok: boolean
  error?: string
}

export interface Integrations {
  web: { connected: boolean; url: string; page: string }
  telegram: {
    connected: boolean
    username?: string
    managed: boolean
    webhook: string
    token_hint?: string
    stored_in?: string
    status?: BotStatus
  }
}

export interface NewAgency {
  template: string
  name: string
  short_name: string
  country: string
  description: string
  name_id: string
  short_name_id: string
  description_id: string
  emergency_line_id: string
  emergency_line: string
  reply_signature: string
  categories: { id?: string; label: string; team: string; escalate: boolean; min_urgency?: 'low' | 'normal' | 'high' }[]
  team: { id?: string; name: string; role: TeamMember['role']; title: string; teams: string[] }[]
  keywords: string[]
  escalate_flags: string[]
  sla_hours: Record<Urgency, number>
  confidence_floor: number
  keep_template_docs: boolean
  drop_docs: string[]
  docs: { title: string; text: string; pdf_base64?: string }[]
}

export interface TeamMember {
  id: string
  name: string
  role: 'leader' | 'supervisor' | 'officer'
  title: string
  queues: string[]
}
export interface Notification {
  id?: string
  ticket_id: string
  kind: 'escalated' | 'assigned' | 'followup'
  text: string
  at: string
}
export interface Media {
  transcript: string | null
  photo_description: string | null
  safety_concern: boolean
  safety_reason: string
}
export interface Attachment {
  mime: string
  data: string
}
export interface Intake {
  language: string
  entities: Record<string, string | null>
  pii_types: string[]
  masked_text: string
  restated: string
}
export interface Triage {
  category: string
  urgency: Urgency
  urgency_reason: string
  sentiment: string
  flags: string[]
  summary: string
  confidence: number
}
export interface Policy {
  route: 'escalated' | 'assigned' | 'manual_review'
  queue: string
  final_urgency: Urgency
  sla_hours: number
  reasons: string[]
}
export interface Draft {
  reply: string
  next_step: string
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
export interface TraceStep {
  agent: string
  kind: 'llm' | 'rules' | 'search'
  ms: number
  output: Record<string, unknown> | Citation[]
  fallback?: string
  model?: string
  tokens_in?: number
  tokens_out?: number
  trace_id?: string
  rerun?: boolean
}
export interface SopSource {
  file: string
  title: string
  short: string
  url: string
  issuer: string
  kind: string
}
export interface HistoryItem {
  at: string
  actor: string
  action: string
  note: string
}
export interface Ticket {
  id: string
  agency_id: string
  channel: Channel
  text: string
  status: Status
  created_at: string
  responded_at?: string | null
  resolved_at?: string | null
  attachments?: { mime: string; bytes: number; path?: string }[]
  media?: Media | null
  intake?: Intake | null
  triage?: Triage | null
  policy?: Policy | null
  draft?: Draft | null
  sop?: Citation[]
  sent_reply?: string
  guard?: { injection: string[]; draft: string[] }
  details?: { missing: string[]; answers: Record<string, string>; refined_at?: string | null }
  progress?: { procedure: string; done: number[] }
  trace: TraceStep[]
  history: HistoryItem[]
  seeded: boolean
  sla_breached: boolean
  alerted_at?: string | null
  alert_delivered_at?: string | null
  assignee?: string | null
  telegram_chat_id?: string | null
  followups?: { at: string; text: string }[]
}
export interface Row {
  id: string
  created_at: string
  channel: Channel
  status: Status
  category: string | null
  urgency: Urgency | null
  queue: string | null
  summary: string
  sentiment: string | null
  sla_hours: number | null
  sla_breached: boolean
  seeded: boolean
  assignee: string | null
}
export interface Cluster {
  kind: string
  display: string
  count: number
  critical: number
  top_categories: string[]
  top_locations: string[]
  ticket_ids: string[]
  first_seen: string
}
export interface Overview {
  window_days: number
  total: number
  open: number
  escalated: number
  sla_breached_open: number
  median_first_response_h: number | null
  median_resolution_h: number | null
  by_category: { id: string; label: string; count: number; this_week: number; prev_week: number }[]
  by_urgency: Partial<Record<Urgency, number>>
  by_status: Record<string, number>
  by_channel: Record<string, number>
  daily: { date: string; count: number }[]
  clusters: Cluster[]
}
export interface AnalystAnswer {
  answer: string
  tools_used: string[]
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

export const api = {
  agencies: () => fetch('/api/agencies').then(json<Agency[]>),
  tickets: (t: string, status?: string) =>
    fetch(`/api/agencies/${t}/tickets${status ? `?status=${status}` : ''}`).then(json<Row[]>),
  ticket: (id: string) => fetch(`/api/tickets/${id}`).then(json<Ticket>),
  details: (id: string, answers: Record<string, string>) =>
    fetch(`/api/tickets/${id}/details`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    }).then(json<Pick<Ticket, 'id' | 'status' | 'details'>>),
  progress: (id: string, body: { procedure: string; stage: number; done: boolean; officer: string }) =>
    fetch(`/api/tickets/${id}/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Ticket>),
  act: (
    id: string,
    body: { action: string; officer?: string; note?: string; reply?: string; queue?: string; assignee?: string },
  ) =>
    fetch(`/api/tickets/${id}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Ticket>),
  overview: (t: string) => fetch(`/api/agencies/${t}/overview`).then(json<Overview>),
  brief: (t: string, refresh = false, lang = 'en') =>
    fetch(`/api/agencies/${t}/brief?lang=${lang}${refresh ? '&refresh=true' : ''}`).then(json<AnalystAnswer>),
  ask: (t: string, question: string) =>
    fetch(`/api/agencies/${t}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    }).then(json<AnalystAnswer>),
  sop: (t: string, q: string) =>
    fetch(`/api/agencies/${t}/sop?q=${encodeURIComponent(q)}`).then(
      json<{ sources: SopSource[]; results: Omit<Citation, 'n'>[] }>,
    ),
  ai: (t: string) => fetch(`/api/agencies/${t}/ai`).then(json<import('./staff/AiTower').Tower>),
  setAi: (
    t: string,
    body: {
      models: Record<string, string>
      guard: { read: string; write: string; injection: string; questions: number }
      by: string
    },
  ) =>
    adminFetch(`/api/agencies/${t}/ai`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<{ ok: boolean }>),
  notifications: (t: string, member: string) =>
    fetch(`/api/agencies/${t}/notifications?for=${member}`).then(json<Notification[]>),
  createAgency: (body: NewAgency) =>
    fetch('/api/agencies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Agency>),
  integrations: (t: string) => fetch(`/api/agencies/${t}/integrations`).then(json<Integrations>),
  connectTelegram: (t: string, token: string) =>
    adminFetch(`/api/agencies/${t}/integrations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(json<{ connected: boolean; username: string; steps: SetupStep[] }>),
  setupTelegram: (t: string) =>
    adminFetch(`/api/agencies/${t}/integrations`, { method: 'PATCH' }).then(
      json<{ steps: SetupStep[]; status: BotStatus }>,
    ),
  disconnectTelegram: (t: string) => adminFetch(`/api/agencies/${t}/integrations`, { method: 'DELETE' }).then(json),
  saveResources: (t: string, body: { resources: Resource[]; by: { name: string; role: string } }) =>
    adminFetch(`/api/agencies/${t}/resources`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Agency>),
  saveProcedures: (
    t: string,
    body: { procedures: ProcedureT[]; laws: Record<string, string[]>; by: { name: string; role: string } },
  ) =>
    adminFetch(`/api/agencies/${t}/procedures`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Agency>),
  updateAgency: (t: string, body: NewAgency) =>
    adminFetch(`/api/agencies/${t}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Agency>),
  deleteAgency: (t: string) => adminFetch(`/api/agencies/${t}`, { method: 'DELETE' }).then(json),
  resetDemo: (t: string) => adminFetch(`/api/agencies/${t}/reset-demo`, { method: 'POST' }).then(json),
}

export type SubmitEvent =
  | { type: 'received'; ticket_id: string }
  | ({ type: 'step' } & TraceStep)
  | { type: 'done'; ticket: Ticket }
  | { type: 'error'; message: string }

/** POST a complaint and read the agents' progress from the SSE stream. */
export async function submitComplaint(
  agency: string,
  body: {
    text: string
    channel: Channel
    reporter_name?: string
    reporter_contact?: string
    attachments?: Attachment[]
  },
  onEvent: (e: SubmitEvent) => void,
) {
  const res = await fetch(`/api/agencies/${agency}/complaints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text()}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (chunk.startsWith('data: ')) onEvent(JSON.parse(chunk.slice(6)))
    }
  }
}
