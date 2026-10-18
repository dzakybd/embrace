import { agencyById } from '@/lib/agencies'
import { slaBreached } from '@/lib/analytics'
import { regionOf } from '@/lib/geo'
import { error } from '@/lib/http'
import { ensureSeeded } from '@/lib/seed'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  await ensureSeeded(STORE, id)
  const rows = (await STORE.list(id)).map((t) => ({
    id: t.id,
    created_at: t.created_at,
    channel: t.channel,
    status: t.status,
    category: t.triage?.category ?? null,
    urgency: t.policy?.final_urgency ?? null,
    queue: t.policy?.queue ?? null,
    summary: t.triage?.summary ?? t.text.slice(0, 140),
    sla_hours: t.policy?.sla_hours ?? null,
    sla_breached: slaBreached(t),
    seeded: t.seeded,
    assignee: t.assignee ?? null,
    // The map region, so a click on the Insights map opens these cases.
    region: agency.map ? regionOf(agency.map.level, t.intake?.entities?.location) : null,
  }))
  return Response.json(rows)
}
