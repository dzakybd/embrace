// Saves that change an agency's setup need the settings password. The browser never keeps it: on the first save of a
// session the dialog in AdminPrompt asks for it, POST /api/admin/session trades it for an HttpOnly cookie, and the
// save is retried with that cookie.
let ask: ((wrong: boolean) => Promise<string | null>) | null = null

export function registerAdminPrompt(fn: typeof ask) {
  ask = fn
}

const needsPassword = async (res: Response) =>
  res.status === 401 &&
  (
    await res
      .clone()
      .json()
      .catch(() => null)
  )?.error === 'admin_password'

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  for (let tries = 0; tries < 4; tries++) {
    const res = await fetch(url, { ...init, credentials: 'same-origin' })
    if (!(await needsPassword(res))) return res
    const entered = (await ask?.(tries > 0)) ?? ''
    if (!entered) throw new Error('401 {"error":"The settings password is needed to save."}')
    const session = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: entered }),
    })
    if (session.status === 429) return session
  }
  throw new Error('401 {"error":"Wrong settings password."}')
}
