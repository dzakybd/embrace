import { agencyById } from '@/lib/agencies'
import { error } from '@/lib/http'
import { indexFor, sourcesFor } from '@/lib/sop'

/** Ask the SOP: BM25 passages from the agency's documents, no model call. Empty q lists the sources. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  return Response.json({ sources: sourcesFor(id), results: q ? indexFor(id).search(q, 5) : [] })
}
