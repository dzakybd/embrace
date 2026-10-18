// Agency packs: taxonomy, queues, escalation rules and SOP index per agency (agencies/<id>/),
// plus agencies created in the app, which live in the store and are loaded on demand.
import type { MapConfig } from './geo'
import dinsosDemak from '@/agencies/dinsos_demak/agency.json'
import kpai from '@/agencies/kpai/agency.json'
import type { Urgency } from './schemas'
import { registerDocs, resetDocs, sourcesFor, type IndexFile } from './sop'
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
  /** label_id: Indonesian label. laws: `short` names of the pack's documents that govern this kind of case. */
  categories: { id: string; label: string; label_id?: string; queue: string; min_urgency?: Urgency; laws?: string[] }[]
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
  /** Created in the app (stored), not shipped in agencies/. */
  custom?: boolean
  /** A built-in agency whose settings were edited in the app (stored as an override). */
  edited?: boolean
  /** Username of the agency's Telegram bot, without @. */
  telegram_bot?: string | null
  /** What the agency calls its head (English, translated in the UI), e.g. "Chairperson"; default "Head of office". */
  leader_label?: string
  /** The map cases are placed on in Insights (lib/geo.ts). */
  map?: MapConfig
  /** Indonesian name, short name and description, shown when the UI language is Indonesian. */
  name_id?: string
  short_name_id?: string
  description_id?: string
  emergency_line_id?: string
  /** Details a report needs before the agency can act (lib/details.ts); the bot and form ask for missing ones. */
  required_details?: string[]
  /** Public path of the agency's emblem, shown on its cards and home. */
  logo?: string | null
  /** The agency's published service procedures, the stages a case goes through (shown to staff and the public). */
  procedures?: Procedure[]
  /** Links and contacts: official channels, social media, hotlines, partner agencies. `public` ones show on the agency
   * page; partners and hotlines may be named in drafted replies. */
  resources?: Resource[]
}

export const RESOURCE_KINDS = ['official', 'social', 'hotline', 'partner', 'link'] as const
export interface Resource {
  id: string
  kind: (typeof RESOURCE_KINDS)[number]
  name: string
  name_id?: string
  note?: string
  note_id?: string
  url?: string
  phone?: string
  public: boolean
}

export interface Procedure {
  id: string
  title: string
  title_id?: string
  /** Category ids this procedure applies to. */
  categories: string[]
  requirements?: string[]
  requirements_id?: string[]
  note?: string
  note_id?: string
  /** who: the actor doing the stage (citizen, desk, caseworker, supervisor, head, partner), a swimlane in the diagram. */
  stages: { title: string; title_id?: string; who?: string }[]
}

export interface TeamMember {
  id: string
  name: string
  role: 'leader' | 'supervisor' | 'officer'
  title: string
  queues: string[]
}

export interface StoredAgency extends Agency {
  docs?: IndexFile
  created_at?: string
  /** Settings saved over a built-in agency. */
  override?: boolean
}

const BUILT_IN = [dinsosDemak, kpai] as Agency[]
const SHIPPED: Record<string, Agency> = Object.fromEntries(BUILT_IN.map((a) => [a.id, a]))

/** Built-in agencies; custom agencies are merged in by loadAgencies(). */
export const AGENCIES: Record<string, Agency> = Object.fromEntries(BUILT_IN.map((a) => [a.id, a]))
export const DEFAULT_AGENCY = 'dinsos_demak'

export function getAgency(id: string): Agency | undefined {
  return AGENCIES[id]
}

/** Every agency citizens and staff can use. */
export function liveAgencies(): Agency[] {
  return Object.values(AGENCIES)
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
        AGENCIES[a.id] = override ? { ...a, edited: true } : { ...a, custom: true }
        registerDocs(a.id, docs ?? { sources: [], passages: [] })
      }
      loadedAt = Date.now()
    } finally {
      loading = null
    }
  })()
  return loading
}

/** Saves edited fields of an agency (procedures, resources). A built-in agency's first edit becomes a stored override
 * whose documents stay the shipped ones, by reference; Reset demo removes it. */
export async function saveAgencyFields(agency: Agency, fields: Partial<Agency>) {
  if (agency.custom || agency.edited) await STORE.patchAgency(agency.id, fields)
  else {
    const override: StoredAgency = {
      ...agency,
      ...fields,
      override: true,
      docs: { sources: [], passages: [], template: agency.id, keep: sourcesFor(agency.id).map((s) => s.short) },
    }
    delete override.custom
    delete override.edited
    await STORE.putAgency(override)
  }
  AGENCIES[agency.id] = { ...agency, ...fields, ...(agency.custom ? {} : { edited: true }) }
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
  const {
    id,
    name,
    short_name,
    country,
    description,
    categories,
    queues,
    sla_hours,
    emergency_line,
    team,
    custom,
    edited,
  } = a
  return {
    id,
    name,
    short_name,
    country,
    description,
    categories,
    queues,
    sla_hours,
    emergency_line,
    team,
    telegram_bot: a.telegram_bot ?? null,
    leader_label: a.leader_label ?? 'Head of office',
    logo: a.logo ?? null,
    name_id: a.name_id ?? '',
    short_name_id: a.short_name_id ?? '',
    description_id: a.description_id ?? '',
    emergency_line_id: a.emergency_line_id ?? '',
    custom: !!custom,
    edited: !!edited,
    escalation_contact: a.escalation.escalation_contact,
    escalation: a.escalation,
    reply_signature: a.reply_signature,
    procedures: a.procedures ?? [],
    resources: a.resources ?? [],
  }
}
export type PublicAgency = ReturnType<typeof publicAgency>
