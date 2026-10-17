import { z } from 'zod'
import { agencyById } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { ensureSeeded } from '@/lib/seed'
import { askAnalyst } from '@/lib/service'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const parsed = z.object({ question: z.string().min(3).max(500) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, 'question must be 3 to 500 characters')
  const limited = rateLimit(req, 'ask', 30)
  if (limited) return limited
  await ensureSeeded(STORE, id)
  return Response.json(await askAnalyst(id, parsed.data.question))
}
