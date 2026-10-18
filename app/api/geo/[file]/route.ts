import { fileUrl } from '@/lib/files-url'
import { error } from '@/lib/http'

const cache = new Map<string, string>()

/** Map boundaries from Cloud Storage `geo/`, served same-origin (the browser fetches them for the case maps). */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (!/^[a-z0-9-]+\.json$/.test(file)) return error(404, 'no such map')
  let body = cache.get(file)
  if (!body) {
    const res = await fetch(fileUrl(`geo/${file}`), { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return error(404, 'no such map')
    body = await res.text()
    cache.set(file, body)
  }
  return new Response(body, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
  })
}
