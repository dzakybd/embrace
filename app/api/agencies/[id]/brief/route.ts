import { agencyById } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { ensureSeeded } from '@/lib/seed'
import { askAnalyst } from '@/lib/service'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

const cache = new Map<string, { at: number; body: unknown }>()

/** The analyst agent's weekly brief, cached for 15 minutes to save model budget. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const refresh = new URL(req.url).searchParams.get('refresh') === 'true'
  const hit = cache.get(id)
  if (hit && !refresh && Date.now() - hit.at < 15 * 60_000) return Response.json(hit.body)
  if (refresh) {
    const limited = rateLimit(req, 'brief', 10)
    if (limited) return limited
  }
  await ensureSeeded(STORE, id)
  const body = {
    ...(await askAnalyst(
      id,
      'Write the weekly trend brief for the head of service: categories rising versus last week, emerging complaint clusters (early warning), SLA breaches, and one recommended action.',
    )),
    generated_at: Date.now(),
  }
  cache.set(id, { at: Date.now(), body })
  return Response.json(body)
}
