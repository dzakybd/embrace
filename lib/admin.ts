// Settings password: every change to an agency's setup (settings, AI, procedures, resources, channels, demo reset)
// needs it, so visitors of the public demo can try the app but not change it. Kept in Secret Manager
// (embrace-admin-password); without it, local development is open and the cloud deployment refuses all changes.
// The browser never stores the password: POST /api/admin/session trades it for a signed, HttpOnly session cookie.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { rateLimit } from './http'

const COOKIE = 'embrace_admin'
const HOURS = 8
const SALT = randomBytes(16)
let keys: { secret: string; hash: Buffer; mac: Buffer } | null = null

/** The password's scrypt hash (per process) and the session-signing key (same on every instance). */
function keysFor(secret: string) {
  if (keys?.secret !== secret)
    keys = { secret, hash: scryptSync(secret, SALT, 32), mac: scryptSync(secret, 'embrace-admin-session', 32) }
  return keys
}
const secretOf = () => process.env.EMBRACE_ADMIN_PASSWORD?.trim() ?? ''

export function checkPassword(given: string): boolean {
  const secret = secretOf()
  if (!secret || !given) return false
  return timingSafeEqual(scryptSync(given, SALT, 32), keysFor(secret).hash)
}

const sign = (mac: Buffer, exp: number) => createHmac('sha256', mac).update(`embrace-admin:${exp}`).digest('base64url')

/** Set-Cookie value for a session that passed the password, valid for a working day. */
export function sessionCookie(): string {
  const exp = Date.now() + HOURS * 3600_000
  const token = `${exp}.${sign(keysFor(secretOf()).mac, exp)}`
  const secure = process.env.K_SERVICE ? '; Secure' : ''
  return `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${HOURS * 3600}${secure}`
}

function validSession(req: Request): boolean {
  const raw = req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  const [exp, sig] = raw?.split('.') ?? []
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const want = Buffer.from(sign(keysFor(secretOf()).mac, Number(exp)))
  const got = Buffer.from(sig)
  return got.length === want.length && timingSafeEqual(got, want)
}

export function requireAdmin(req: Request): NextResponse | null {
  if (!secretOf()) {
    if (!process.env.K_SERVICE) return null
    return NextResponse.json({ error: 'Changes are disabled: no settings password is configured' }, { status: 403 })
  }
  // A session cookie from the browser, or the password in a header (scripts).
  if (validSession(req) || checkPassword(req.headers.get('x-admin-password') ?? '')) return null
  // Wrong guesses are limited per IP; the 429 replaces the 401 once the limit is reached.
  return rateLimit(req, 'admin-password', 10) ?? NextResponse.json({ error: 'admin_password' }, { status: 401 })
}
