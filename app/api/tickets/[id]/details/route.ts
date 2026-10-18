import { z } from 'zod'
import { SLOTS } from '@/lib/details'
import { error, rateLimit } from '@/lib/http'
import { addDetails } from '@/lib/service'
import { STORE } from '@/lib/store'

const Body = z.object({ answers: z.partialRecord(z.enum(SLOTS), z.string().max(300)) })

/** Citizen answers to the missing-detail questions, once, within two hours of the report. Re-runs the agents. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 'details', 10)
  if (limited) return limited
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, parsed.error.issues[0]?.message ?? 'invalid body')
  const id = (await params).id
  const t = await STORE.get(id)
  if (!t?.details) return error(404, 'not found')
  if (t.details.refined_at || Date.now() - Date.parse(t.created_at) > 2 * 3600_000)
    return error(409, 'details already added or too late; send a new message instead')
  const updated = await addDetails(id, parsed.data.answers)
  return updated
    ? Response.json({ id: updated.id, status: updated.status, details: updated.details })
    : error(404, 'not found')
}
