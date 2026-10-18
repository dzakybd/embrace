import { agencyById } from '@/lib/agencies'
import { error } from '@/lib/http'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

/** What the citizen may see about their own report: status, team, timing and the reply. No staff notes or AI internals. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await STORE.get((await params).id)
  if (!t) return error(404, 'not found')
  const agency = (await agencyById(t.agency_id))!
  // The procedure staff follow (or the one for this kind of case) and the stages done, so the citizen sees what comes next.
  const procs = agency.procedures ?? []
  const proc = procs.find((p) => p.id === t.progress?.procedure) ?? procs.find((p) => p.categories.includes(t.triage?.category ?? ''))
  return Response.json({
    agency_id: agency.id,
    procedure: proc ? { id: proc.id, title: proc.title, title_id: proc.title_id, stages: proc.stages, done: t.progress?.procedure === proc.id ? t.progress.done : [] } : null,
    id: t.id,
    agency: agency.name,
    agency_name_id: agency.name_id ?? null,
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
