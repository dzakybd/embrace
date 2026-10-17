import { AGENCIES, agencyById, loadAgencies, publicAgency } from '@/lib/agencies'
import { buildAgency, NewAgency } from '@/lib/agency-builder'
import { error, rateLimit } from '@/lib/http'
import { registerDocs } from '@/lib/sop'
import { STORE } from '@/lib/store'

/** Saves edited settings (rules, categories, teams, staff, documents). Built-in agencies keep an override. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency || agency.template) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'agency-edit', 20)
  if (limited) return limited
  const parsed = NewAgency.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const built = await buildAgency(parsed.data, agency)
  if (typeof built === 'string') return error(400, built)
  const { docs, ...saved } = built
  await STORE.putAgency(agency.custom ? built : { ...built, override: true })
  AGENCIES[id] = agency.custom ? { ...saved, custom: true } : { ...saved, edited: true }
  registerDocs(id, docs!)
  return Response.json(publicAgency(AGENCIES[id]))
}

/** Deletes an agency created in the app with its cases, or restores a built-in agency's shipped settings. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  if (!agency.custom && !agency.edited) return error(403, 'built-in agencies cannot be deleted')
  const limited = rateLimit(req, 'agency-delete', 10)
  if (limited) return limited
  await STORE.deleteAgency(id)
  if (agency.custom) {
    await STORE.clear(id)
    await STORE.clearNotifications(id)
    delete AGENCIES[id]
  } else await loadAgencies(true)
  return Response.json({ ok: true })
}
