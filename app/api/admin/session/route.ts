import { z } from 'zod'
import { checkPassword, sessionCookie } from '@/lib/admin'
import { error, rateLimit } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Trades the settings password for an HttpOnly session cookie, so the browser never keeps the password. */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'admin-password', 10)
  if (limited) return limited
  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success || !checkPassword(parsed.data.password)) return error(401, 'admin_password')
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(), 'cache-control': 'no-store' } })
}
