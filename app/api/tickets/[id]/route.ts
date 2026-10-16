import { slaBreached } from '@/lib/analytics'
import { error } from '@/lib/http'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await STORE.get((await params).id)
  return t ? Response.json({ ...t, sla_breached: slaBreached(t) }) : error(404, 'not found')
}
