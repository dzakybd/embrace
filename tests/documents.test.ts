import { describe, expect, it } from 'vitest'
import { unverifiedCitations } from '@/lib/agents/documents'
import { htmlText, safeUrl } from '@/lib/knowledge'

describe('document agent citations', () => {
  const refs = ['UU 23/2004, p. 1', 'UU 23/2004, p. 2', 'PP 78/2021, p. 33', 'PP 78/2021, p. 34', 'KPAI SOP, section 4']
  it('accepts exact refs, page lists and several refs in one bracket', () => {
    expect(unverifiedCitations('A [UU 23/2004, p. 1, 2]. B [PP 78/2021, p. 33; KPAI SOP, section 4].', refs)).toEqual(
      [],
    )
  })
  it('accepts a page list that repeats "p." for each page', () => {
    expect(unverifiedCitations('A [PP 78/2021, p. 33, p. 34].', refs)).toEqual([])
    expect(unverifiedCitations('A [PP 78/2021, p. 33, p. 35].', refs)).toEqual(['PP 78/2021, p. 33, p. 35'])
  })
  it('flags pages and documents the agent was not given', () => {
    expect(unverifiedCitations('A [UU 23/2004, p. 9]. B [KUHP, Pasal 351].', refs)).toEqual([
      'UU 23/2004, p. 9',
      'KUHP, Pasal 351',
    ])
  })
})

describe('knowledge base web pages', () => {
  it('only takes public https addresses', () => {
    expect(safeUrl('https://peraturan.go.id/id/uu-35-2014')).not.toBeNull()
    for (const bad of [
      'http://example.com',
      'https://localhost/x',
      'https://169.254.169.254/',
      'https://[::1]/',
      'https://metadata/x',
      'https://a.internal/',
    ])
      expect(safeUrl(bad)).toBeNull()
  })
  it('keeps the readable text of a page', () => {
    const { title, text } = htmlText(
      '<html><head><title>UU &amp; PP</title><script>x()</script></head><body><nav>Menu</nav><h1>Pasal 76C</h1><p>Setiap Orang dilarang&nbsp;melakukan kekerasan</p></body></html>',
    )
    expect(title).toBe('UU & PP')
    expect(text).toBe('Pasal 76C\nSetiap Orang dilarang melakukan kekerasan')
  })
})
