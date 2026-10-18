import { describe, expect, it } from 'vitest'
import { AGENCIES } from '@/lib/agencies'
import { procedureText } from '@/lib/agents/pipeline'
import { sourcesFor } from '@/lib/sop'

const WHO = ['citizen', 'desk', 'caseworker', 'supervisor', 'head', 'partner']

describe('agency procedures', () => {
  for (const a of Object.values(AGENCIES)) {
    it(`${a.id}: every case type has a procedure and its laws are agency documents`, () => {
      const docs = new Set(sourcesFor(a.id).map((s) => s.short))
      for (const c of a.categories) {
        expect(a.procedures?.some((p) => p.categories.includes(c.id)), c.id).toBe(true)
        expect(c.laws?.length, c.id).toBeGreaterThan(0)
        for (const l of c.laws ?? []) expect(docs.has(l), `${c.id}: ${l}`).toBe(true)
      }
      for (const p of a.procedures ?? []) for (const s of p.stages) expect(WHO, `${p.id}: ${s.title}`).toContain(s.who)
    })
  }

  it('gives the drafter the stages, what to bring and the legal basis', () => {
    const text = procedureText(AGENCIES.kpai, 'sexual_abuse')
    expect(text).toMatch(/^KPAI complaint/)
    expect(text).toMatch(/1\. Complaint registered \[citizen\]/)
    expect(text).toMatch(/What to bring:/)
    expect(text).toMatch(/UU 12\/2022/)
    expect(procedureText(AGENCIES.kpai, 'nope')).toMatch(/no published procedure/)
  })
})
