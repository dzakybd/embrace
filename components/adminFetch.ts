// Saves that change an agency's setup carry the settings password (header x-admin-password). It is asked once per
// browser session through the dialog in AdminPrompt and forgotten when the tab closes or the server rejects it.
const KEY = 'embrace-admin'
let ask: ((wrong: boolean) => Promise<string | null>) | null = null

export function registerAdminPrompt(fn: typeof ask) {
  ask = fn
}

const read = () => {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
const write = (v: string) => {
  try {
    if (v) sessionStorage.setItem(KEY, v)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage blocked: ask again next time */
  }
}

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let password = read()
  for (let tries = 0; tries < 4; tries++) {
    if (!password) {
      password = (await ask?.(tries > 0)) ?? ''
      if (!password) throw new Error('401 {"error":"The settings password is needed to save."}')
    }
    const res = await fetch(url, { ...init, headers: { ...init.headers, 'x-admin-password': password } })
    if (res.status !== 401) {
      if (res.ok) write(password)
      return res
    }
    write('')
    password = ''
  }
  throw new Error('401 {"error":"Wrong settings password."}')
}
