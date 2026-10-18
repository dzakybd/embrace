// Seeds 30 days of synthetic history per agency so the dashboard and clusters have data.
// Seeded tickets use their labels (no model calls) and are marked `seeded`; routing still goes through the real rules.
import dinsosSeed from '@/agencies/dinsos_demak/seed.json'
import kpaiSeed from '@/agencies/kpai/seed.json'
import { AGENCIES, picFor, type Agency } from './agencies'
import { decide } from './policy'
import type { Channel, HistoryItem, Ticket, Triage } from './schemas'
import type { Store } from './store'

interface SeedRow {
  channel: string
  category: string
  urgency: string
  location: string | null
  institution: string | null
  aid_program: string | null
  summary: string
  text: string
  cluster: boolean
  /** The conversation: the caseworker's first reply, the citizen's answer, the closing message (resolved cases). */
  reply: string
  followup: string
  closing: string
  /** Procedure id when the case type has several. */
  procedure?: string
}

const SEEDS: Record<string, SeedRow[]> = { dinsos_demak: dinsosSeed, kpai: kpaiSeed }
const SENTIMENT = { critical: 'distressed', high: 'worried', normal: 'neutral', low: 'neutral' } as const
const H = 3600_000

/** Small deterministic PRNG so every reset gives the same demo data. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export function prefix(agency: Agency) {
  return (
    agency.code ??
    agency.id
      .split('_')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  )
}

export function build(agency: Agency): Ticket[] {
  const rand = rng(42)
  const uniform = (a: number, b: number) => a + rand() * (b - a)
  const t0 = Date.now()
  return (SEEDS[agency.id] ?? []).map((r, i) => {
    // Clustered complaints land in the last 10 days so the early warning shows up now.
    const ageH = r.cluster ? uniform(4, 240) : uniform(6, 30 * 24)
    const created = new Date(t0 - ageH * H)
    const urgency = r.urgency as Triage['urgency']
    const triage: Triage = {
      category: r.category,
      urgency,
      urgency_reason: r.summary,
      sentiment: SENTIMENT[urgency],
      flags: urgency === 'critical' && agency.id === 'kpai' ? ['child_safety'] : [],
      summary: r.summary,
      confidence: Math.round(uniform(0.75, 0.97) * 100) / 100,
    }
    const policy = decide(agency, r.text, triage)
    let status: Ticket['status'] = policy.route
    let responded: Date | null = null
    let resolved: Date | null = null
    const roll = rand()
    if (ageH > policy.sla_hours * 0.6 && roll < 0.8) {
      responded = new Date(created.getTime() + Math.min(ageH, uniform(0.2, 1.4) * policy.sla_hours) * H)
      status = 'in_progress'
      if (ageH > 48 && roll < 0.55) {
        resolved = new Date(Math.min(t0, responded.getTime() + uniform(4, Math.min(ageH, 200)) * H))
        status = 'resolved'
      }
    }
    const iso = (d: Date) => d.toISOString()
    const pic = picFor(agency, policy.queue)
    const sign = (text: string) => `${text}\n\n${agency.reply_signature}`
    const history: HistoryItem[] = [
      { at: iso(created), actor: 'system', action: 'received', note: `via ${r.channel}` },
      { at: iso(created), actor: 'agents', action: policy.route, note: policy.reasons.join('; ') },
    ]
    const replies: NonNullable<Ticket['replies']> = []
    const followups: NonNullable<Ticket['followups']> = []
    const proc =
      agency.procedures?.find((p) => p.id === r.procedure) ??
      agency.procedures?.find((p) => p.categories.includes(r.category))
    let done: number[] = []
    if (responded) {
      replies.push({ at: iso(responded), by: pic.name, text: sign(r.reply) })
      history.push({ at: iso(responded), actor: pic.name, action: 'send_reply', note: 'Reply approved and sent' })
      // The citizen answers within a day, before the case is closed.
      const end = (resolved ?? new Date(t0)).getTime()
      const answered = new Date(Math.min(end - 0.2 * H, responded.getTime() + uniform(0.5, 20) * H))
      if (answered > responded) {
        followups.push({ at: iso(answered), text: r.followup })
        history.push({ at: iso(answered), actor: 'citizen', action: 'followup', note: r.followup.slice(0, 300) })
      }
      if (proc) {
        // Resolved cases went through every stage; open ones are about halfway.
        const n = resolved ? proc.stages.length : Math.max(1, Math.floor(proc.stages.length / 2))
        done = [...Array(n).keys()]
        const span = (resolved ?? new Date(t0)).getTime() - responded.getTime()
        done.forEach((k) =>
          history.push({
            at: iso(new Date(responded.getTime() + (span * (k + 1)) / (n + 1))),
            actor: pic.name,
            action: 'stage_done',
            note: `${proc.title}: ${proc.stages[k].title}`,
          }),
        )
      }
    } else if (ageH > policy.sla_hours) {
      // Not answered in time: the citizen asks again.
      const asked = new Date(created.getTime() + policy.sla_hours * H)
      followups.push({ at: iso(asked), text: 'Is there any news on my report?' })
      history.push({ at: iso(asked), actor: 'citizen', action: 'followup', note: 'Is there any news on my report?' })
    }
    if (resolved) {
      replies.push({ at: iso(resolved), by: pic.name, text: sign(r.closing) })
      history.push({ at: iso(resolved), actor: pic.name, action: 'send_reply', note: 'Reply approved and sent' })
      history.push({ at: iso(resolved), actor: pic.name, action: 'resolve', note: 'Case resolved' })
    }
    history.sort((x, y) => x.at.localeCompare(y.at))
    const ymd = iso(created).slice(2, 10).replaceAll('-', '')
    return {
      id: `${prefix(agency)}-${ymd}-S${String(i).padStart(3, '0')}`,
      agency_id: agency.id,
      channel: r.channel as Channel,
      text: r.text,
      reporter: {},
      status,
      created_at: iso(created),
      updated_at: iso(resolved ?? responded ?? created),
      responded_at: responded && iso(responded),
      resolved_at: resolved && iso(resolved),
      attachments: [],
      sent_reply: replies.at(-1)?.text,
      replies,
      followups,
      ...(proc && done.length ? { progress: { procedure: proc.id, done } } : {}),
      intake: {
        language: '',
        entities: {
          location: r.location,
          institution: r.institution,
          aid_program: r.aid_program,
          victim_age: null,
          incident_time: null,
        },
        pii_types: [],
        masked_text: r.text,
        restated: r.summary,
      },
      triage,
      policy,
      assignee: pic.id,
      draft: null,
      sop: [],
      trace: [],
      history,
      seeded: true,
    }
  })
}

const seeding = new Map<string, Promise<void>>()

/** Seeds an agency the first time it is read and has no synthetic history yet. */
export async function ensureSeeded(store: Store, agencyId: string): Promise<void> {
  if (!seeding.has(agencyId)) {
    seeding.set(
      agencyId,
      (async () => {
        if ((await store.list(agencyId)).some((t) => t.seeded)) return
        const agency = AGENCIES[agencyId]
        if (agency) for (const t of build(agency)) await store.put(t)
      })(),
    )
  }
  return seeding.get(agencyId)
}

export async function reseed(store: Store, agencyId: string): Promise<void> {
  await store.clear(agencyId)
  await store.clearNotifications(agencyId)
  const agency = AGENCIES[agencyId]
  if (agency) for (const t of build(agency)) await store.put(t)
}
