import { z } from 'zod'
import { agencyById } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { askDocuments } from '@/lib/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Ask = z
  .object({
    question: z.string().trim().min(3).max(800).optional(),
    ticket_id: z.string().max(40).optional(),
    by: z.string().trim().max(80).optional(),
  })
  .refine((x) => x.question || x.ticket_id, { message: 'Ask a question or name a case' })

/** Document agent: a question answered from the knowledge base, or the legal basis of a case. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const parsed = Ask.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, parsed.error.issues[0].message)
  const limited = rateLimit(req, 'documents', 20)
  if (limited) return limited
  const out = await askDocuments(id, {
    question: parsed.data.question,
    ticketId: parsed.data.ticket_id,
    by: parsed.data.by,
  })
  if (!out) return error(404, 'unknown case')
  return Response.json(out)
}
