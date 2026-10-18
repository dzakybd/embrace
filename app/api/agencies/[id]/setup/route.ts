import { requireAdmin } from '@/lib/admin'
import { AGENCIES, agencyById, publicAgency, saveAgencyFields } from '@/lib/agencies'
import { log } from '@/lib/agents/governance'
import { Setup, applySetup } from '@/lib/agency-setup'
import { error, rateLimit } from '@/lib/http'

/** Saves one or more sections of an agency's setup: profile, people, or case types with their escalation rules. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'agency-edit', 30)
  if (limited) return limited
  const parsed = Setup.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const fields = applySetup(agency, parsed.data)
  if (typeof fields === 'string') return error(400, fields)
  await saveAgencyFields(agency, fields)
  log('INFO', 'agency_setup_changed', { agency: id, sections: Object.keys(parsed.data) })
  return Response.json(publicAgency(AGENCIES[id]))
}
