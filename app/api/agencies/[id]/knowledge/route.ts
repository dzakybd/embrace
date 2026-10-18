import { requireAdmin } from '@/lib/admin'
import { agencyById } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { AddKnowledge, addKnowledge } from '@/lib/knowledge'
import { knowledgeSources, loadKnowledge } from '@/lib/sop'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Every document of the agency's knowledge base: shipped ones and those added in the app. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  await loadKnowledge(id)
  return Response.json({ sources: knowledgeSources(id) })
}

/** Adds a document (PDF, Markdown or text) or a web page; it is searchable by staff and agents at once. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'kb-add', 20)
  if (limited) return limited
  const parsed = AddKnowledge.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues[0].message)
  const out = await addKnowledge(id, parsed.data)
  if (typeof out === 'string') return error(400, out)
  return Response.json({ source: out.source, passages: out.passages.length })
}
