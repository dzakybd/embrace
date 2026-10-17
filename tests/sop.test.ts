import { describe, expect, it } from 'vitest'
import { indexFor, sourcesFor } from '@/lib/sop'

const top = (agency: string, q: string) => indexFor(agency).search(q, 3).map((r) => `${r.doc} ${r.loc}`)

describe('SOP search', () => {
  it('every agency and template has sources and passages', () => {
    for (const id of ['dinsos_demak', 'kpai', 'child_protection', 'social_services']) {
      expect(sourcesFor(id).length).toBeGreaterThan(0)
      expect(indexFor(id).passages.length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['dinsos_demak', 'rob masuk rumah, butuh bantuan bencana', 'Alur layanan Dinsos P2PA Demak section 6'],
    ['dinsos_demak', 'cara minta rekomendasi PBI UHC, BPJS nonaktif', 'Alur layanan Dinsos P2PA Demak section 3'],
    ['dinsos_demak', 'surat keterangan terdaftar DTKS syaratnya apa', 'Alur layanan Dinsos P2PA Demak section 2'],
    ['dinsos_demak', 'anak 15 tahun mau dinikahkan', 'Alur layanan Dinsos P2PA Demak section 10'],
    ['dinsos_demak', 'pungutan liar agen e-warong', 'Standar respons (sampel) section 5'],
    ['kpai', 'pengaduan online data belum lengkap kapan dihubungi', 'SOP pengaduan KPAI section 3'],
    ['kpai', 'pengadu tidak dapat dihubungi, kasus diterminasi', 'SOP pengaduan KPAI section 7'],
    ['child_protection', 'child beaten with injury by stepfather', 'Sample CP SOP section 3'],
    ['social_services', 'flood water in the house no shelter tonight', 'Sample social services SOP section 10'],
  ])('%s: "%s" finds %s', (agency, q, want) => {
    expect(top(agency, q)).toContain(want)
  })

  it('sends a complaint already with the police to KPAI oversight', () => {
    expect(top('kpai', 'sudah lapor polisi tapi belum ditangani, minta pengawasan KPAI').some((d) => /SOP pengaduan KPAI section [45]/.test(d))).toBe(true)
  })

  it('finds the food aid regulation for an Indonesian BPNT complaint', () => {
    expect(top('dinsos_demak', 'BPNT belum masuk ke KKS').some((d) => d.startsWith('Permensos 4/2023') || d.startsWith('Standar respons'))).toBe(true)
  })
})
