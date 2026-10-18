// UI language. English strings are the keys; Indonesian translations live in ./i18n-id. A missing key shows English.
import { ID } from './i18n-id'

export type Lang = 'en' | 'id'
export const LANGS: Lang[] = ['en', 'id']
export const LANG_COOKIE = 'lang'

export const asLang = (v: string | undefined | null): Lang => (v === 'id' ? 'id' : 'en')

/** An agency's names, description and emergency line in the UI language, falling back to English. */
export function localize<A extends { name: string; short_name: string; description?: string; emergency_line: string; name_id?: string; short_name_id?: string; description_id?: string; emergency_line_id?: string }>(a: A, lang: Lang): A {
  if (lang !== 'id') return a
  return {
    ...a, name: a.name_id || a.name, short_name: a.short_name_id || a.short_name, description: a.description_id || a.description,
    emergency_line: a.emergency_line_id || a.emergency_line,
  }
}

export type T = (s: string, vars?: Record<string, string | number>) => string

export function translator(lang: Lang): T {
  return (s, vars) => {
    let out = lang === 'id' ? ID[s] ?? s : s
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
    return out
  }
}
