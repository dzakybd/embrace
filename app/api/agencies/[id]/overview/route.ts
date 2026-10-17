import { agencyById } from '@/lib/agencies'
import { clusters, overview } from '@/lib/analytics'
import { error } from '@/lib/http'
import { ensureSeeded } from '@/lib/seed'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const agency = await agencyById((await params).id)
  if (!agency) return error(404, 'unknown agency')
  await ensureSeeded(STORE, agency.id)
  const days = Number(new URL(req.url).searchParams.get('days') ?? 30)
  const rows = await STORE.list(agency.id)
  return Response.json({ ...overview(agency, rows, days), clusters: clusters(agency, rows) })
}
