import { AGENCIES, loadAgencies, publicAgency } from '@/lib/agencies'
import { buildAgency, NewAgency } from '@/lib/agency-builder'
import { registerDocs } from '@/lib/sop'
import { error, rateLimit } from '@/lib/http'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

const MAX_CUSTOM = 30

export async function GET() {
  await loadAgencies()
  return Response.json(Object.values(AGENCIES).map(publicAgency))
}

/** Creates an agency from the form; stored in Firestore so every instance can serve it. */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'agency', 5)
  if (limited) return limited
  const parsed = NewAgency.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  await loadAgencies(true)
  if (Object.values(AGENCIES).filter((a) => a.custom).length >= MAX_CUSTOM) return error(429, 'The demo holds at most 30 created agencies; delete one first')
  const built = await buildAgency(parsed.data)
  if (typeof built === 'string') return error(400, built)
  await STORE.putAgency(built)
  const { docs, ...agency } = built
  AGENCIES[agency.id] = { ...agency, custom: true }
  registerDocs(agency.id, docs!)
  return Response.json(publicAgency(AGENCIES[agency.id]))
}
