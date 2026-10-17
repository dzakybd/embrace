import { agencyById } from '@/lib/agencies'
import { error } from '@/lib/http'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

/** Notifications for one team member (`?for=<member id>`), newest first. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const agency = await agencyById((await params).id)
  if (!agency) return error(404, 'unknown agency')
  const to = new URL(req.url).searchParams.get('for') ?? ''
  if (!agency.team.some((m) => m.id === to)) return error(404, 'unknown team member')
  return Response.json(await STORE.listNotifications(agency.id, to))
}
