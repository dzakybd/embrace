import { requireAdmin } from '@/lib/admin'
import { agencyById } from '@/lib/agencies'
import { error } from '@/lib/http'
import { loadKnowledge } from '@/lib/sop'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; doc: string }> }

/** The uploaded file of an added document, from private Cloud Storage. */
export async function GET(_req: Request, { params }: Params) {
  const { id, doc } = await params
  const d = (await loadKnowledge(id)).find((x) => x.id === doc)
  if (!d?.file_path) return error(404, 'no such file')
  const file = await STORE.getFile(d.file_path)
  if (!file) return error(404, 'file not found')
  return new Response(new Uint8Array(file.data), {
    headers: { 'content-type': file.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  })
}

/** Removes an added document from the knowledge base (shipped documents cannot be removed). */
export async function DELETE(req: Request, { params }: Params) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id, doc } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const d = (await loadKnowledge(id, true)).find((x) => x.id === doc)
  if (!d) return error(404, 'no such document')
  await STORE.deleteKnowledge(id, doc)
  if (d.file_path) await STORE.deleteFile(d.file_path).catch(() => undefined)
  await loadKnowledge(id, true)
  return Response.json({ ok: true })
}
