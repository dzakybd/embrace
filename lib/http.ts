// Small helpers for the route handlers: JSON errors and a per-IP rate limit that protects the prepaid Gemini budget.
import { NextResponse } from 'next/server'

export const error = (status: number, message: string) => NextResponse.json({ error: message }, { status })

const hits = new Map<string, number[]>()

/** Allows `limit` calls per `windowMin` minutes per client IP and bucket. Returns a 429 response when exceeded. */
export function rateLimit(req: Request, bucket: string, limit: number, windowMin = 60): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  const key = `${bucket}|${ip}`
  const since = Date.now() - windowMin * 60_000
  const recent = (hits.get(key) ?? []).filter((t) => t > since)
  if (recent.length >= limit) return error(429, `Demo limit reached (${limit} per ${windowMin} min). Please try again later.`)
  recent.push(Date.now())
  hits.set(key, recent)
  return null
}
