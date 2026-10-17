import { agencyById, loadAgencies } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { reseed } from '@/lib/seed'
import { STORE } from '@/lib/store'

/** Restores the demo: synthetic cases again and, for a built-in agency, its shipped settings. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'reset', 10)
  if (limited) return limited
  if (agency.edited) {
    await STORE.deleteAgency(id)
    await loadAgencies(true)
  }
  await reseed(STORE, id)
  return Response.json({ ok: true })
}
