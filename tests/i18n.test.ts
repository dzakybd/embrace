import { globSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ID } from '@/lib/i18n-id'
import { translator } from '@/lib/i18n'

const files = [...globSync('app/**/*.tsx'), ...globSync('components/**/*.tsx'), 'lib/bot.ts', 'lib/details.ts'].filter(
  (f) => !f.endsWith('layout.tsx'),
)
const src = files.map((f) => [f, readFileSync(f, 'utf8')] as const)

// Object-literal labels that reach t() through a variable (nav items, filters, statuses, agent names...).
const LABEL_KEYS = /\b(label|title|body|role|what|name|text|[a-z_]+)\s*:\s*'([A-Z][^'\\]*)'/g
const NOT_UI = new Set(['ph', 'mime', 'href', 'id', 'icon', 'channel', 'agency', 'as', 'page', 'no_ai'])
// Language buttons name each language in itself.
const SELF_NAMED = new Set(['English', 'Bahasa Indonesia'])

describe('Indonesian UI strings', () => {
  it('translates every literal t() key', () => {
    const missing = src.flatMap(([f, s]) =>
      [...s.matchAll(/\btr?\('((?:[^'\\]|\\.)*)'/g)]
        .map((m) => m[1].replace(/\\'/g, "'"))
        .filter((k) => !(k in ID))
        .map((k) => `${f}: ${k}`),
    )
    expect(missing).toEqual([])
  })

  it('translates the labels passed to t() through constants', () => {
    const missing = src.flatMap(([f, s]) =>
      [...s.matchAll(LABEL_KEYS)]
        // The sample complaints themselves stay in their original language.
        .filter((m) => !NOT_UI.has(m[1]) && !/^M\d/.test(m[2]) && !(f.endsWith('Report.tsx') && m[1] === 'text'))
        .map((m) => m[2])
        .filter((k) => !(k in ID) && !SELF_NAMED.has(k))
        .map((k) => `${f}: ${k}`),
    )
    expect(missing).toEqual([])
  })

  it('falls back to English and fills placeholders', () => {
    const t = translator('id')
    expect(t('{n} teams', { n: 3 })).toBe('3 tim')
    expect(t('Not a key')).toBe('Not a key')
    expect(translator('en')('{n} teams', { n: 3 })).toBe('3 teams')
  })
})
