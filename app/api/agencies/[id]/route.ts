import { requireAdmin } from '@/lib/admin'
import { AGENCIES, agencyById, loadAgencies } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { STORE } from '@/lib/store'

/** Deletes an agency created in the app with its cases, or restores a built-in agency's shipped settings. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
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
