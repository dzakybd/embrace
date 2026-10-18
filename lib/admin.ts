// Settings password: every change to an agency's setup (settings, AI, procedures, resources, channels, demo reset)
// needs it, so visitors of the public demo can try the app but not change it. Kept in Secret Manager
// (embrace-admin-password); without it, local development is open and the cloud deployment refuses all changes.
import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { rateLimit } from './http'

const digest = (s: string) => createHash('sha256').update(s).digest()

export function requireAdmin(req: Request): NextResponse | null {
  const secret = process.env.EMBRACE_ADMIN_PASSWORD?.trim()
  if (!secret) {
    if (!process.env.K_SERVICE) return null
    return NextResponse.json({ error: 'Changes are disabled: no settings password is configured' }, { status: 403 })
  }
  const given = req.headers.get('x-admin-password') ?? ''
  if (given && timingSafeEqual(digest(given), digest(secret))) return null
  // Wrong guesses are limited per IP; the 429 replaces the 401 once the limit is reached.
  return rateLimit(req, 'admin-password', 10) ?? NextResponse.json({ error: 'admin_password' }, { status: 401 })
}
