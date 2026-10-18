'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { LANG_COOKIE, translator, type Lang, type T } from '@/lib/i18n'

const Ctx = createContext<{ lang: Lang; t: T; setLang: (l: Lang) => void }>({
  lang: 'en',
  t: translator('en'),
  setLang: () => {},
})

/** The UI language, read from the cookie on the server so server and client pages agree. */
export function LangProvider({ lang: initial, children }: { lang: Lang; children: ReactNode }) {
  const router = useRouter()
  const [lang, set] = useState(initial)
  const value = useMemo(
    () => ({
      lang,
      t: translator(lang),
      setLang: (l: Lang) => {
        document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
        document.documentElement.lang = l
        set(l)
        router.refresh()
      },
    }),
    [lang, router],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)
export const useT = () => useContext(Ctx).t

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-switch" role="group" aria-label="Language / Bahasa">
      {(['en', 'id'] as Lang[]).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
