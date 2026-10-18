// SOP lookup without model tokens: BM25 over the agency's SOP passages (built by scripts/build-sop-index.mjs).
import dinsosDemak from '@/agencies/dinsos_demak/sop-index.json'
import kpai from '@/agencies/kpai/sop-index.json'

export interface Passage {
  doc: string
  title: string
  url: string
  loc: string
  text: string
}
export interface Source {
  file: string
  title: string
  short: string
  url: string
  issuer: string
  kind: string
}
export interface IndexFile {
  sources: Source[]
  passages: Passage[]
  /** A built-in agency whose shipped documents this agency also uses (only those named in `keep`): stored as a
   * reference, so a copied agency stays far below Firestore's 1 MB document limit. */
  template?: string
  keep?: string[]
}

const FILES: Record<string, IndexFile> = {
  dinsos_demak: dinsosDemak,
  kpai,
}

const STOPWORDS = new Set(
  `the of and to in for on with at by from is are was were be been it this that these those a an or as not
  can will would should may must has have had who what when where which their there they them his her its
  our your you we i my me please help about into than then also any all
  yang dan di ke dari untuk dengan pada dalam atau ini itu adalah sebagai oleh tidak akan para bagi serta
  telah dapat tersebut sesuai setiap huruf ayat angka bahwa juga lebih secara antara karena maka jika apabila
  sudah belum ada saya kami kita mereka dia nya pak bapak ibu tolong mohon min admin`.split(/\s+/),
)

// Citizens use programme nicknames and everyday words; SOPs use formal terms.
const SYNONYMS: Record<string, string[]> = {
  bpnt: ['sembako', 'bantuan', 'pangan'],
  sembako: ['bpnt'],
  kks: ['kartu', 'keluarga', 'sejahtera'],
  pkh: ['program', 'keluarga', 'harapan'],
  dtks: ['dtsen', 'data', 'terpadu', 'kesejahteraan'],
  dtsen: ['dtks', 'data'],
  cair: ['penyaluran', 'pencairan'],
  kdrt: ['kekerasan', 'rumah', 'tangga'],
  dipukul: ['kekerasan', 'fisik'],
  dicabuli: ['kekerasan', 'seksual'],
  dipukuli: ['kekerasan', 'fisik', 'penganiayaan'],
  dinikahkan: ['pernikahan', 'usia', 'dini', 'perkawinan'],
  nikah: ['pernikahan', 'perkawinan'],
  nafkah: ['biaya', 'pemeliharaan', 'kewajiban', 'orang', 'tua'],
  cerai: ['perceraian', 'pengasuhan', 'orang', 'tua'],
  rob: ['bencana', 'banjir'],
  banjir: ['bencana'],
  odgj: ['gangguan', 'jiwa', 'tuna', 'sosial', 'terlantar'],
  dipasung: ['pasung', 'gangguan', 'jiwa'],
  bpjs: ['pbi', 'uhc', 'jaminan', 'kesehatan'],
  uhc: ['pbi', 'jaminan', 'kesehatan'],
  adopsi: ['pengangkatan', 'anak'],
  married: ['marriage', 'early', 'child'],
  marry: ['marriage', 'early', 'child'],
  wedding: ['marriage'],
  agen: ['warong'],
  hit: ['physical', 'abuse', 'injury'],
  beaten: ['physical', 'abuse', 'injury'],
  bullied: ['bullying'],
  bully: ['bullying'],
  molested: ['sexual', 'abuse'],
  payment: ['benefit', 'paid'],
  late: ['payment', 'not', 'received'],
  cash: ['payment', 'benefit'],
  voucher: ['benefit', 'food'],
  fee: ['fees', 'deduction'],
  cut: ['deduction', 'fee'],
  register: ['registration', 'eligibility'],
  online: ['grooming', 'sextortion', 'images'],
  custody: ['family', 'care'],
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

function counts(words: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const w of words) m.set(w, (m.get(w) ?? 0) + 1)
  return m
}

class SopIndex {
  private docs: Map<string, number>[]
  private lengths: number[]
  private avg: number
  private idf = new Map<string, number>()

  constructor(readonly passages: Passage[]) {
    this.docs = passages.map((p) => counts(tokens(`${p.doc} ${p.text}`)))
    this.lengths = this.docs.map((d) => [...d.values()].reduce((a, b) => a + b, 0))
    this.avg = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length)
    const df = new Map<string, number>()
    for (const d of this.docs) for (const w of d.keys()) df.set(w, (df.get(w) ?? 0) + 1)
    const n = this.docs.length
    for (const [w, c] of df) this.idf.set(w, Math.log(1 + (n - c + 0.5) / (c + 0.5)))
  }

  search(query: string, k = 3, k1 = 1.4, b = 0.75): (Passage & { score: number })[] {
    const words = tokens(query)
    const q = counts([...words, ...words.flatMap((w) => SYNONYMS[w] ?? [])])
    const scored: [number, number][] = []
    this.docs.forEach((d, i) => {
      let s = 0
      for (const [w, qn] of q) {
        const f = d.get(w)
        if (f) s += qn * this.idf.get(w)! * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.lengths[i]) / this.avg)))
      }
      if (s > 0) scored.push([s, i])
    })
    scored.sort((a, b) => b[0] - a[0])
    const out: (Passage & { score: number })[] = []
    const seen = new Set<string>()
    for (const [s, i] of scored) {
      const p = this.passages[i]
      const key = `${p.doc}|${p.loc}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...p, score: Math.round(s * 100) / 100 })
      if (out.length === k) break
    }
    return out
  }
}

const cache = new Map<string, SopIndex>()

export function indexFor(agencyId: string): SopIndex {
  let idx = cache.get(agencyId)
  if (!idx) {
    idx = new SopIndex(FILES[agencyId]?.passages ?? [])
    cache.set(agencyId, idx)
  }
  return idx
}

const SHIPPED = { ...FILES }

/** Back to the documents shipped in agencies/<id>/ (after an edited agency is reset). */
export function resetDocs(agencyId: string): void {
  if (SHIPPED[agencyId]) FILES[agencyId] = SHIPPED[agencyId]
  else delete FILES[agencyId]
  cache.delete(agencyId)
}

export const isShippedDocs = (agencyId: string) => !!SHIPPED[agencyId]

/** Documents of an agency created in the app (built at upload time, see passagesFor), plus the template documents it keeps. */
export function registerDocs(agencyId: string, docs: IndexFile): void {
  const base = docs.template ? SHIPPED[docs.template] : undefined
  const kept = (short: string) => (docs.keep ?? []).includes(short)
  FILES[agencyId] = base
    ? {
        sources: [...base.sources.filter((s) => kept(s.short)), ...docs.sources],
        passages: [...base.passages.filter((p) => kept(p.doc)), ...docs.passages],
      }
    : docs
  cache.delete(agencyId)
}

const CHUNK = 900
const OVERLAP = 150

/** Same chunking as scripts/build-sop-index.mjs: ~900 characters, cut at a sentence end, 150 overlap. */
function chunks(text: string): string[] {
  text = text.split(/\s+/).join(' ').trim()
  if (text.length <= CHUNK) return text ? [text] : []
  const out: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK)
    if (end < text.length) {
      const cut = text.lastIndexOf('. ', end)
      if (cut > start + CHUNK / 2) end = cut + 1
    }
    out.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = Math.max(end - OVERLAP, start + 1)
  }
  return out
}

/** Passages of one uploaded document: "## " sections for Markdown, pages for PDFs, else the whole text. */
export function passagesFor(src: Source, units: { loc: string; text: string }[]): Passage[] {
  return units.flatMap((u) =>
    chunks(u.text).map((text) => ({ doc: src.short, title: src.title, url: src.url, loc: u.loc, text })),
  )
}

export function markdownUnits(text: string): { loc: string; text: string }[] {
  const parts = text.split(/^## /m)
  if (parts.length < 2) return [{ loc: 'text', text }]
  return parts.slice(1).map((s) => ({ loc: `section ${s.split('.')[0].slice(0, 40)}`, text: s }))
}

export function sourcesFor(agencyId: string): Source[] {
  return FILES[agencyId]?.sources ?? []
}

export function asPrompt(results: Passage[]): string {
  if (!results.length) return '(no matching SOP passage found)'
  return results.map((r, n) => `[${n + 1}] ${r.doc}, ${r.loc}: ${r.text.slice(0, 700)}`).join('\n')
}
