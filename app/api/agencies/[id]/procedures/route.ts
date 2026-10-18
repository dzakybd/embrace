import { z } from 'zod'
import { AGENCIES, agencyById, publicAgency, type StoredAgency } from '@/lib/agencies'
import { log } from '@/lib/agents/governance'
import { error, rateLimit } from '@/lib/http'
import { sourcesFor } from '@/lib/sop'
import { STORE } from '@/lib/store'

const Line = z.string().trim().max(200)
const Body = z.object({
  procedures: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_]{2,60}$/),
    title: Line.min(3), title_id: Line.optional(),
    categories: z.array(z.string()).min(1),
    requirements: z.array(Line).max(15).optional(), requirements_id: z.array(Line).max(15).optional(),
    note: z.string().trim().max(400).optional(), note_id: z.string().trim().max(400).optional(),
    stages: z.array(z.object({ title: Line.min(2), title_id: Line.optional(), who: z.enum(['citizen', 'desk', 'caseworker', 'supervisor', 'head', 'partner']) })).min(1).max(20),
  })).max(40),
  /** Category id -> `short` names of the agency's documents that are its legal basis. */
  laws: z.record(z.string(), z.array(z.string()).max(12)),
  by: z.object({ name: z.string().max(80), role: z.string() }),
})

/** Supervisor or head of office: the agency's case procedures (stages, owners, requirements) and each case type's legal basis.
 * Built-in agencies keep the edit as an override, like Settings; Reset demo restores the shipped version. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'procedures', 30)
  if (limited) return limited
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const { procedures, laws, by } = parsed.data
  if (by.role !== 'leader' && by.role !== 'supervisor') return error(403, 'only the supervisor or the head of office changes procedures')
  const cats = new Set(agency.categories.map((c) => c.id))
  const docs = new Set(sourcesFor(id).map((s) => s.short))
  if (procedures.some((p) => p.categories.some((c) => !cats.has(c)))) return error(400, 'unknown case type')
  if (new Set(procedures.map((p) => p.id)).size !== procedures.length) return error(400, 'two procedures have the same id')
  if (Object.values(laws).flat().some((l) => !docs.has(l))) return error(400, 'unknown document')
  const categories = agency.categories.map((c) => ({ ...c, laws: laws[c.id] ?? c.laws ?? [] }))
  const fields = { procedures, categories }
  if (agency.custom || agency.edited) await STORE.patchAgency(id, fields)
  else {
    // First edit of a built-in agency: store it as an override; its documents stay the shipped ones, by reference.
    const override: StoredAgency = { ...agency, ...fields, override: true, docs: { sources: [], passages: [], template: id, keep: [...docs] } }
    delete override.custom
    delete override.edited
    await STORE.putAgency(override)
  }
  AGENCIES[id] = { ...agency, ...fields, ...(agency.custom ? {} : { edited: true }) }
  log('INFO', 'procedures_changed', { agency: id, by: by.name, procedures: procedures.length })
  return Response.json(publicAgency(AGENCIES[id]))
}
