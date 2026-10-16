// Aggregates for the insights dashboard and the analyst agent's tools.
import type { Agency } from './agencies'
import type { Ticket } from './schemas'

export const OPEN = new Set(['escalated', 'manual_review', 'assigned', 'in_progress'])
const H = 3600_000

const hours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / H

export function slaBreached(t: Ticket, at = new Date().toISOString()): boolean {
  if (!t.policy) return false
  return hours(t.created_at, t.responded_at ?? at) > t.policy.sla_hours
}

function tally<T>(items: T[], key: (t: T) => string | undefined | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return Math.round((s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) * 10) / 10
}

export function overview(agency: Agency, tickets: Ticket[], days = 30) {
  const t0 = Date.now()
  const since = new Date(t0 - days * 24 * H).toISOString()
  const recent = tickets.filter((t) => t.created_at >= since)
  const labels = Object.fromEntries(agency.categories.map((c) => [c.id, c.label]))
  const thisWeek = new Date(t0 - 7 * 24 * H).toISOString()
  const prevWeek = new Date(t0 - 14 * 24 * H).toISOString()
  const byCat = tally(recent, (t) => t.triage?.category)
  const catThis = tally(recent.filter((t) => t.created_at >= thisWeek), (t) => t.triage?.category)
  const catPrev = tally(recent.filter((t) => t.created_at >= prevWeek && t.created_at < thisWeek), (t) => t.triage?.category)
  const daily = tally(recent, (t) => t.created_at.slice(0, 10))
  return {
    window_days: days,
    total: recent.length,
    open: recent.filter((t) => OPEN.has(t.status)).length,
    escalated: recent.filter((t) => t.policy?.route === 'escalated').length,
    sla_breached_open: recent.filter((t) => OPEN.has(t.status) && slaBreached(t)).length,
    median_first_response_h: median(recent.filter((t) => t.responded_at).map((t) => hours(t.created_at, t.responded_at!))),
    median_resolution_h: median(recent.filter((t) => t.resolved_at).map((t) => hours(t.created_at, t.resolved_at!))),
    by_category: [...byCat]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, label: labels[id] ?? id, count, this_week: catThis.get(id) ?? 0, prev_week: catPrev.get(id) ?? 0 })),
    by_urgency: Object.fromEntries(tally(recent, (t) => t.policy?.final_urgency)),
    by_status: Object.fromEntries(tally(recent, (t) => t.status)),
    by_channel: Object.fromEntries(tally(recent, (t) => t.channel)),
    daily: [...daily].sort().map(([date, count]) => ({ date, count })),
  }
}

function norm(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v
    .toLowerCase()
    .replace(/\b(desa|kelurahan|kel\.|kecamatan|kec\.|kabupaten|kab\.|kota|village|district|city|town)\b/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
  return s || null
}

type Kind = 'institution' | 'aid_program' | 'location'
const SPECIFICITY: Record<Kind, number> = { institution: 0, aid_program: 1, location: 2 }

/** Related complaints sharing a place, institution or aid programme within a window: early-warning signal. */
export function clusters(agency: Agency, tickets: Ticket[], days = 14, minSize = 3) {
  const since = new Date(Date.now() - days * 24 * H).toISOString()
  const groups = new Map<string, { kind: Kind; key: string; ts: Ticket[] }>()
  for (const t of tickets) {
    if (t.created_at < since || !t.intake) continue
    for (const kind of ['institution', 'location', 'aid_program'] as Kind[]) {
      const key = norm(t.intake.entities?.[kind])
      if (!key) continue
      const g = groups.get(`${kind}|${key}`) ?? { kind, key, ts: [] }
      g.ts.push(t)
      groups.set(`${kind}|${key}`, g)
    }
  }
  const labels = Object.fromEntries(agency.categories.map((c) => [c.id, c.label]))
  const covered = new Set<string>()
  const out = []
  // Most specific, largest groups first; drop groups that mostly repeat one already reported.
  for (const g of [...groups.values()].sort((a, b) => SPECIFICITY[a.kind] - SPECIFICITY[b.kind] || b.ts.length - a.ts.length)) {
    const ids = g.ts.map((t) => t.id)
    if (g.ts.length < minSize || ids.filter((id) => covered.has(id)).length >= 0.6 * ids.length) continue
    ids.forEach((id) => covered.add(id))
    const cats = [...tally(g.ts, (t) => t.triage?.category)].sort((a, b) => b[1] - a[1])
    const places = [...tally(g.ts, (t) => t.intake?.entities?.location)].sort((a, b) => b[1] - a[1])
    out.push({
      kind: g.kind,
      key: g.key,
      display: g.ts[0].intake!.entities[g.kind] ?? g.key,
      count: g.ts.length,
      critical: g.ts.filter((t) => t.policy?.final_urgency === 'critical').length,
      top_categories: cats.slice(0, 2).map(([c]) => labels[c] ?? c),
      top_locations: places.slice(0, 3).map(([p, n]) => `${p} (${n})`),
      ticket_ids: ids.slice(0, 10),
      first_seen: g.ts.map((t) => t.created_at).sort()[0],
    })
  }
  return out.sort((a, b) => b.critical - a.critical || b.count - a.count)
}
export type Overview = ReturnType<typeof overview> & { clusters: ReturnType<typeof clusters> }
