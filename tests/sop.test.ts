import { describe, expect, it } from 'vitest'
import { indexFor, sourcesFor } from '@/lib/sop'

const top = (agency: string, q: string) => indexFor(agency).search(q, 3).map((r) => `${r.doc} ${r.loc}`)

describe('SOP search', () => {
  it('every agency has sources and passages', () => {
    for (const id of ['child_protection', 'social_assistance', 'id_demak']) {
      expect(sourcesFor(id).length).toBeGreaterThan(0)
      expect(indexFor(id).passages.length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['child_protection', 'child beaten with injury by stepfather', 'Sample CP SOP section 3'],
    ['child_protection', 'sextortion online game photos', 'Sample CP SOP section 5'],
    ['child_protection', 'school withheld report card over fees', 'Sample CP SOP section 6'],
    ['child_protection', 'custody dispute after divorce', 'Sample CP SOP section 7'],
    ['social_assistance', 'food voucher payment not received this month', 'Sample SA SOP section 3'],
    ['social_assistance', 'shop agent takes a fee from every payment', 'Sample SA SOP section 7'],
    ['social_assistance', 'how to register for assistance documents', 'Sample SA SOP section 4'],
    ['social_assistance', 'can my son collect for me pickup', 'Sample SA SOP section 5'],
  ])('%s: "%s" finds %s', (agency, q, want) => {
    expect(top(agency, q)).toContain(want)
  })

  it('finds the food aid regulation for an Indonesian BPNT complaint', () => {
    expect(top('id_demak', 'BPNT belum masuk ke KKS').some((d) => d.startsWith('Permensos 4/2023'))).toBe(true)
  })
})
