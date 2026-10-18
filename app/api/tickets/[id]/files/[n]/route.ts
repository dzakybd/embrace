import { error } from '@/lib/http'
import { STORE } from '@/lib/store'

export const dynamic = 'force-dynamic'

/** A report's photo or voice note (n from 1), streamed from private Cloud Storage for the staff case page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params
  const t = await STORE.get(id)
  const path = t?.attachments?.[Number(n) - 1]?.path
  if (!path) return error(404, 'no such attachment')
  const file = await STORE.getFile(path)
  if (!file) return error(404, 'attachment not found')
  return new Response(new Uint8Array(file.data), {
    headers: { 'content-type': file.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  })
}
