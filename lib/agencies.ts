// Agency packs: taxonomy, queues, escalation rules and SOP index per agency (agencies/<id>/),
// plus agencies created in the app, which live in the store and are loaded on demand.
import dinsosDemak from '@/agencies/dinsos_demak/agency.json'
import kpai from '@/agencies/kpai/agency.json'
import socialServices from '@/agencies/social_services/agency.json'
import childProtection from '@/agencies/child_protection/agency.json'
import type { Urgency } from './schemas'
import { registerDocs, resetDocs, type Passage, type Source } from './sop'
import { STORE } from './store'

export interface Agency {
  id: string
  /** Short code used in case numbers, e.g. KPAI-261017-A3E1. */
  code?: string
  name: string
  short_name: string
  country: string
  description?: string
  /** min_urgency: an agency rule that keeps a category at or above this urgency. */
  categories: { id: string; label: string; queue: string; min_urgency?: Urgency }[]
  queues: Record<string, string>
  escalation: {
    always_escalate_categories: string[]
    escalate_flags: string[]
    keywords: string[]
    escalation_contact: string
    /** Below this triage confidence a case goes to manual review (default 0.7). */
    confidence_floor?: number
  }
  sla_hours: Record<Urgency, number>
  emergency_line: string
  reply_signature: string
  team: TeamMember[]
  /** Starting point for new agencies only, not a live desk. */
  template?: boolean
  /** Created in the app (stored), not shipped in agencies/. */
  custom?: boolean
  /** A built-in agency whose settings were edited in the app (stored as an override). */
  edited?: boolean
  /** Username of the agency's Telegram bot, without @. */
  telegram_bot?: string | null
}

export interface TeamMember {
  id: string
  name: string
  role: 'leader' | 'supervisor' | 'officer'
  title: string
  queues: string[]
}

export interface StoredAgency extends Agency {
  docs?: { sources: Source[]; passages: Passage[] }
  created_at?: string
  /** Settings saved over a built-in agency. */
  override?: boolean
}

const BUILT_IN = [dinsosDemak, kpai, socialServices, childProtection] as Agency[]
const SHIPPED: Record<string, Agency> = Object.fromEntries(BUILT_IN.map((a) => [a.id, a]))

/** Live agencies plus templates; custom agencies are merged in by loadAgencies(). */
export const AGENCIES: Record<string, Agency> = Object.fromEntries(BUILT_IN.map((a) => [a.id, a]))
export const DEFAULT_AGENCY = 'dinsos_demak'

export function getAgency(id: string): Agency | undefined {
  return AGENCIES[id]
}

/** Agencies citizens and staff can use (templates excluded). */
export function liveAgencies(): Agency[] {
  return Object.values(AGENCIES).filter((a) => !a.template)
}

/** The agency as shipped in agencies/<id>/, before any edits made in the app. */
export function shipped(id: string): Agency | undefined {
  return SHIPPED[id]
}

let loadedAt = 0
let loading: Promise<void> | null = null

/** Refreshes custom agencies from the store (shared by all instances); cached for 30 s. */
export async function loadAgencies(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < 30_000) return
  loading ??= (async () => {
    try {
      const stored = (await STORE.listAgencies()) as unknown as StoredAgency[]
      const ids = new Set(stored.map((s) => s.id))
      for (const id of Object.keys(AGENCIES)) {
        if (ids.has(id)) continue
        if (AGENCIES[id].custom) delete AGENCIES[id]
        else if (AGENCIES[id].edited) {
          AGENCIES[id] = SHIPPED[id]
          resetDocs(id)
        }
      }
      for (const { docs, override, ...a } of stored) {
        if (override && !SHIPPED[a.id]) continue
        AGENCIES[a.id] = override ? { ...a, template: SHIPPED[a.id].template, edited: true } : { ...a, custom: true }
        registerDocs(a.id, docs ?? { sources: [], passages: [] })
      }
      loadedAt = Date.now()
    } finally {
      loading = null
    }
  })()
  return loading
}

/** The agency with this id, loading custom agencies from the store when it is not known yet. */
export async function agencyById(id: string): Promise<Agency | undefined> {
  await loadAgencies(!AGENCIES[id])
  return AGENCIES[id]
}

export function supervisor(a: Agency): TeamMember {
  return a.team.find((m) => m.role === 'supervisor') ?? a.team[0]
}

/** The person in charge (PIC) of a queue: its first caseworker, else the supervisor. */
export function picFor(a: Agency, queue: string): TeamMember {
  return a.team.find((m) => m.role === 'officer' && m.queues.includes(queue)) ?? supervisor(a)
}

export function taxonomyText(a: Agency): string {
  return a.categories.map((c) => `- ${c.id}: ${c.label}`).join('\n')
}

/** What the browser needs to know about an agency. */
export function publicAgency(a: Agency) {
  const { id, name, short_name, country, description, categories, queues, sla_hours, emergency_line, team, template, custom, edited } = a
  return {
    id, name, short_name, country, description, categories, queues, sla_hours, emergency_line, team, telegram_bot: a.telegram_bot ?? null,
    template: !!template, custom: !!custom, edited: !!edited, escalation_contact: a.escalation.escalation_contact,
    escalation: a.escalation, reply_signature: a.reply_signature,
  }
}
export type PublicAgency = ReturnType<typeof publicAgency>
