import { AGENCIES, agencyById } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { STORE } from '@/lib/store'

/** Deletes an agency created in the app, with its cases. Built-in packs cannot be deleted. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  if (!agency.custom) return error(403, 'built-in agencies cannot be deleted')
  const limited = rateLimit(req, 'agency-delete', 10)
  if (limited) return limited
  await STORE.clear(id)
  await STORE.clearNotifications(id)
  await STORE.deleteAgency(id)
  delete AGENCIES[id]
  return Response.json({ ok: true })
}
