import { cookies } from 'next/headers'
import { LANG_COOKIE, asLang, translator } from './i18n'

export async function getLang() {
  return asLang((await cookies()).get(LANG_COOKIE)?.value)
}

export async function getT() {
  return translator(await getLang())
}
