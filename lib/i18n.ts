// UI language. English strings are the keys; Indonesian translations live in ./i18n-id. A missing key shows English.
import { ID } from './i18n-id'

export type Lang = 'en' | 'id'
export const LANGS: Lang[] = ['en', 'id']
export const LANG_COOKIE = 'lang'

export const asLang = (v: string | undefined | null): Lang => (v === 'id' ? 'id' : 'en')

export type T = (s: string, vars?: Record<string, string | number>) => string

export function translator(lang: Lang): T {
  return (s, vars) => {
    let out = lang === 'id' ? ID[s] ?? s : s
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
    return out
  }
}
