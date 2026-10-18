import { afterEach, describe, expect, it } from 'vitest'
import { requireAdmin, sessionCookie } from '@/lib/admin'

const req = (password?: string, ip = '1.1.1.1') =>
  new Request('http://x/api/agencies/kpai', {
    method: 'PUT',
    headers: { 'x-forwarded-for': ip, ...(password ? { 'x-admin-password': password } : {}) },
  })

describe('settings password', () => {
  afterEach(() => {
    delete process.env.EMBRACE_ADMIN_PASSWORD
    delete process.env.K_SERVICE
  })

  it('lets the right password through and refuses others', () => {
    process.env.EMBRACE_ADMIN_PASSWORD = 'correct horse'
    expect(requireAdmin(req('correct horse'))).toBeNull()
    expect(requireAdmin(req('wrong'))?.status).toBe(401)
    expect(requireAdmin(req())?.status).toBe(401)
  })

  it('accepts the signed session cookie instead of the password, and only untampered', () => {
    process.env.EMBRACE_ADMIN_PASSWORD = 'correct horse'
    const cookie = sessionCookie().split(';')[0]
    const withCookie = (c: string) =>
      new Request('http://x/api/agencies/kpai', {
        method: 'PATCH',
        headers: { cookie: c, 'x-forwarded-for': '2.2.2.2' },
      })
    expect(cookie).toMatch(/^embrace_admin=\d+\./)
    expect(sessionCookie()).toMatch(/HttpOnly; SameSite=Strict/)
    expect(requireAdmin(withCookie(cookie))).toBeNull()
    expect(requireAdmin(withCookie(`${cookie}x`))?.status).toBe(401)
    expect(requireAdmin(withCookie(cookie.replace(/=\d+/, '=9999999999999')))?.status).toBe(401)
    process.env.EMBRACE_ADMIN_PASSWORD = 'changed'
    expect(requireAdmin(withCookie(cookie))?.status).toBe(401)
  })

  it('limits wrong guesses per IP', () => {
    process.env.EMBRACE_ADMIN_PASSWORD = 'correct horse'
    const codes = Array.from({ length: 12 }, () => requireAdmin(req('guess', '9.9.9.9'))?.status)
    expect(codes.at(-1)).toBe(429)
  })

  it('is open locally without a password, closed in the cloud', () => {
    expect(requireAdmin(req())).toBeNull()
    process.env.K_SERVICE = 'embrace'
    expect(requireAdmin(req())?.status).toBe(403)
  })
})
