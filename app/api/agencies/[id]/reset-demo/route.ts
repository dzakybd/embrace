import { agencyById } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { reseed } from '@/lib/seed'
import { STORE } from '@/lib/store'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'reset', 10)
  if (limited) return limited
  await reseed(STORE, id)
  return Response.json({ ok: true })
}
