// Agency setup edited in the app, one section at a time: the profile and the people (Settings), and the case types
// with their escalation rules (Case types). Each section changes only its own fields, so nothing else an agency has
// (procedures, resources, documents, channels, map) is rebuilt or lost.
import { z } from 'zod'
import type { Agency } from './agencies'
import { FLAGS } from './schemas'

const text = (min: number, max: number) => z.string().trim().min(min).max(max)
const opt = (max: number) => z.string().trim().max(max).default('')

export const Profile = z.object({
  name: text(2, 160),
  short_name: text(2, 40),
  country: text(2, 60),
  description: opt(400),
  name_id: opt(160),
  short_name_id: opt(40),
  description_id: opt(400),
  emergency_line: text(2, 200),
  emergency_line_id: opt(200),
  reply_signature: text(2, 160),
})

export const People = z
  .array(
    z.object({
      id: z.string().max(40).optional(),
      name: text(2, 60),
      role: z.enum(['leader', 'supervisor', 'officer']),
      title: text(2, 100),
      queues: z.array(z.string().max(60)).max(10).default([]),
    }),
  )
  .min(3)
  .max(30)

export const Rules = z.object({
  categories: z
    .array(
      z.object({
        id: z.string().max(60).optional(),
        label: text(2, 120),
        label_id: opt(120),
        /** The team's name; a new name creates a team. */
        team: text(2, 120),
        always_escalate: z.boolean().default(false),
        min_urgency: z.enum(['normal', 'high']).optional(),
      }),
    )
    .min(1)
    .max(30),
  keywords: z.array(text(2, 40)).max(80).default([]),
  flags: z.array(z.enum(FLAGS)).default([]),
  confidence_floor: z.number().min(0.5).max(0.95),
  sla_hours: z.object({
    critical: z.number().int().min(1).max(720),
    high: z.number().int().min(1).max(720),
    normal: z.number().int().min(1).max(2000),
    low: z.number().int().min(1).max(2000),
  }),
})

export const Setup = z.object({ profile: Profile.optional(), people: People.optional(), rules: Rules.optional() })
export type Setup = z.infer<typeof Setup>

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'x'

/** The agency fields a setup change produces, or an error message for the form. */
export function applySetup(agency: Agency, input: Setup): Partial<Agency> | string {
  const out: Partial<Agency> = {}
  if (input.profile) Object.assign(out, input.profile)

  let queues = { ...agency.queues }
  if (input.rules) {
    const r = input.rules
    const byName = Object.fromEntries(Object.entries(queues).map(([id, n]) => [n.toLowerCase(), id]))
    const queueOf = (team: string) => {
      const known = byName[team.toLowerCase()]
      if (known) return known
      let id = slug(team)
      while (queues[id]) id = `${id}_2`
      queues[id] = team
      byName[team.toLowerCase()] = id
      return id
    }
    const categories = r.categories.map((c) => {
      const was = agency.categories.find((x) => x.id === c.id)
      return {
        ...(was ?? {}),
        id: c.id || slug(c.label),
        label: c.label,
        ...(c.label_id ? { label_id: c.label_id } : {}),
        queue: queueOf(c.team),
        min_urgency: c.min_urgency,
      }
    })
    for (const c of categories) {
      if (!c.label_id) delete c.label_id
      if (!c.min_urgency) delete c.min_urgency
    }
    if (new Set(categories.map((c) => c.id)).size !== categories.length) return 'Two case types have the same name'
    const ids = categories.map((c) => c.id)
    out.categories = categories
    out.escalation = {
      ...agency.escalation,
      always_escalate_categories: categories.filter((_, i) => r.categories[i].always_escalate).map((c) => c.id),
      escalate_flags: r.flags,
      keywords: [...new Set(r.keywords.map((k) => k.toLowerCase()))],
      confidence_floor: r.confidence_floor,
    }
    out.sla_hours = r.sla_hours
    // A procedure keeps only the case types that still exist; one left with none is dropped.
    if (agency.procedures)
      out.procedures = agency.procedures
        .map((p) => ({ ...p, categories: p.categories.filter((c) => ids.includes(c)) }))
        .filter((p) => p.categories.length)
  }

  const team = input.people ?? agency.team
  if (input.people) {
    const roles = new Set(team.map((m) => m.role))
    if (!roles.has('leader') || !roles.has('supervisor') || !roles.has('officer'))
      return 'The team needs a head, a supervisor and at least one caseworker'
    const used = new Set<string>()
    out.team = team.map((m, i) => {
      let id = m.id || `${slug(m.name.split(' ')[0])}${i}`
      while (used.has(id)) id = `${id}_${i}`
      used.add(id)
      return {
        id,
        name: m.name,
        role: m.role,
        title: m.title,
        queues: m.role === 'officer' ? m.queues.filter((q) => q in queues) : [],
      }
    })
  }
  if (input.people || input.rules) {
    // Teams no case type and no caseworker uses any more are removed.
    const live = new Set([
      ...(out.categories ?? agency.categories).map((c) => c.queue),
      ...(out.team ?? agency.team).flatMap((m) => m.queues),
    ])
    queues = Object.fromEntries(Object.entries(queues).filter(([id]) => live.has(id)))
    out.queues = queues
    const sup = (out.team ?? agency.team).find((m) => m.role === 'supervisor')!
    out.escalation = { ...(out.escalation ?? agency.escalation), escalation_contact: `${sup.name}, ${sup.title}` }
  }
  return out
}
