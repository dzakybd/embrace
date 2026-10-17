import { agencyById } from '@/lib/agencies'
import { error } from '@/lib/http'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

/** What the citizen may see about their own report: status, team, timing and the reply. No staff notes or AI internals. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await STORE.get((await params).id)
  if (!t) return error(404, 'not found')
  const agency = (await agencyById(t.agency_id))!
  return Response.json({
    id: t.id,
    agency: agency.name,
    status: t.status,
    created_at: t.created_at,
    team: t.policy ? agency.queues[t.policy.queue] ?? t.policy.queue : null,
    sla_hours: t.policy?.sla_hours ?? null,
    escalated: t.policy?.route === 'escalated',
    emergency_line: agency.emergency_line,
    responded_at: t.responded_at ?? null,
    resolved_at: t.resolved_at ?? null,
    reply: t.sent_reply ?? null,
  })
}
