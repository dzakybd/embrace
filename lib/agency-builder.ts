// Builds a new agency from the "Create agency" form: a template for rules and documents, plus the office's own
// names, categories, team and documents. Stored agencies are plain data; no code changes per agency.
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { AGENCIES, type Agency, type StoredAgency } from './agencies'
import { FLAGS } from './schemas'
import { indexFor, markdownUnits, passagesFor, sourcesFor, type Passage, type Source } from './sop'

const name = z.string().trim().min(2).max(120)

export const NewAgency = z.object({
  template: z.string().max(40),
  name,
  short_name: z.string().trim().min(2).max(40),
  country: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).default(''),
  emergency_line: z.string().trim().min(2).max(200),
  reply_signature: z.string().trim().min(2).max(160),
  categories: z.array(z.object({
    id: z.string().max(40).optional(),
    label: name,
    team: name,
    escalate: z.boolean().default(false),
    min_urgency: z.enum(['low', 'normal', 'high']).optional(),
  })).min(1).max(20),
  team: z.array(z.object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(2).max(60),
    role: z.enum(['leader', 'supervisor', 'officer']),
    title: z.string().trim().min(2).max(100),
    teams: z.array(name).max(10).default([]),
  })).min(3).max(20),
  keywords: z.array(z.string().trim().min(2).max(40)).max(60).default([]),
  escalate_flags: z.array(z.enum(FLAGS)).optional(),
  sla_hours: z.object({
    critical: z.number().int().min(1).max(720),
    high: z.number().int().min(1).max(720),
    normal: z.number().int().min(1).max(2000),
    low: z.number().int().min(1).max(2000),
  }).optional(),
  confidence_floor: z.number().min(0.5).max(0.95).optional(),
  keep_template_docs: z.boolean().default(true),
  /** Editing: source files of the current documents to drop. */
  drop_docs: z.array(z.string().max(200)).max(50).default([]),
  docs: z.array(z.object({
    title: z.string().trim().min(2).max(160),
    text: z.string().max(200_000).default(''),
    pdf_base64: z.string().max(6_000_000).optional(),
  })).max(8).default([]),
})
export type NewAgency = z.infer<typeof NewAgency>

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'x'

async function pdfUnits(b64: string): Promise<{ loc: string; text: string }[]> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(b64, 'base64')))
  const { text } = await extractText(pdf, { mergePages: false })
  return text.map((t, i) => ({ loc: `p. ${i + 1}`, text: t }))
}

/**
 * Returns the stored agency, or an error message the form can show. With `existing` (editing), ids of categories,
 * teams and staff are kept so open cases, saved sign-ins and eval labels still match; its documents are the base.
 */
export async function buildAgency(input: NewAgency, existing?: Agency): Promise<StoredAgency | string> {
  const base = existing ?? AGENCIES[input.template]
  if (!base) return 'Unknown template'
  const roles = new Set(input.team.map((m) => m.role))
  if (!roles.has('leader') || !roles.has('supervisor') || !roles.has('officer')) {
    return 'The team needs at least one head of office, one duty supervisor and one caseworker'
  }

  const queues: Record<string, string> = {}
  const known = Object.fromEntries(Object.entries(existing?.queues ?? {}).map(([id, n]) => [n, id]))
  const queueId = (team: string) => {
    const id = known[team] ?? slug(team)
    queues[id] ??= team
    return id
  }
  const categories = input.categories.map((c) => ({
    id: c.id || slug(c.label), label: c.label, queue: queueId(c.team), ...(c.min_urgency ? { min_urgency: c.min_urgency } : {}),
  }))
  if (new Set(categories.map((c) => c.id)).size !== categories.length) return 'Two categories have the same name'
  const team = input.team.map((m, i) => ({
    id: m.id || `${slug(m.name.split(' ')[0])}${i}`,
    name: m.name,
    role: m.role,
    title: m.title,
    queues: m.role === 'officer' ? m.teams.map(queueId) : [],
  }))
  const sup = team.find((m) => m.role === 'supervisor')!

  const sources: Source[] = []
  const passages: Passage[] = []
  if (input.keep_template_docs) {
    const keep = sourcesFor(base.id).filter((s) => !input.drop_docs.includes(s.file))
    const shorts = new Set(keep.map((s) => s.short))
    sources.push(...keep)
    passages.push(...indexFor(base.id).passages.filter((p) => shorts.has(p.doc)))
  }
  for (const [i, d] of input.docs.entries()) {
    const src: Source = { file: `upload-${Date.now().toString(36)}-${i + 1}`, title: d.title, short: d.title.slice(0, 40), url: '', issuer: input.name, kind: 'uploaded' }
    let units: { loc: string; text: string }[]
    try {
      units = d.pdf_base64 ? await pdfUnits(d.pdf_base64) : markdownUnits(d.text)
    } catch {
      return `Could not read "${d.title}" (only PDFs with a text layer, Markdown or plain text)`
    }
    const found = passagesFor(src, units)
    if (!found.length) return `"${d.title}" has no readable text`
    sources.push(src)
    passages.push(...found)
  }
  if (passages.length > 700) return 'Documents are too long for the demo (about 600 pages of text at most)'

  const agency: Agency = {
    id: existing?.id ?? `${slug(input.short_name)}_${randomBytes(2).toString('hex')}`,
    code: existing?.code ?? (input.short_name.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'AG'),
    name: input.name,
    short_name: input.short_name,
    country: input.country,
    description: input.description,
    categories,
    queues,
    escalation: {
      always_escalate_categories: categories.filter((_, i) => input.categories[i].escalate).map((c) => c.id),
      escalate_flags: input.escalate_flags ?? base.escalation.escalate_flags,
      keywords: input.keywords.map((k) => k.toLowerCase()),
      escalation_contact: `${sup.name}, ${sup.title}`,
      confidence_floor: input.confidence_floor ?? base.escalation.confidence_floor,
    },
    sla_hours: input.sla_hours ?? base.sla_hours,
    emergency_line: input.emergency_line,
    reply_signature: input.reply_signature,
    team,
    ...(existing?.telegram_bot ? { telegram_bot: existing.telegram_bot } : {}),
    ...(existing?.logo ? { logo: existing.logo } : {}),
  }
  return { ...agency, docs: { sources, passages }, created_at: new Date().toISOString() }
}
