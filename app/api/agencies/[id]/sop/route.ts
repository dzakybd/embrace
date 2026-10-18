import { agencyById } from '@/lib/agencies'
import { error } from '@/lib/http'
import { knowledgeIndex, knowledgeSources, loadKnowledge } from '@/lib/sop'

/** Search the knowledge base: BM25 passages from all the agency's documents, no model call. Empty q lists the sources. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  await loadKnowledge(id)
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  return Response.json({ sources: knowledgeSources(id), results: q ? knowledgeIndex(id, 'all').search(q, 5) : [] })
}
