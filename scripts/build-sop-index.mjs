// Builds agencies/<id>/sop-index.json from the PDFs and Markdown files listed in each sop/sources.json.
// Run after adding or changing an SOP document: npm run sop:index
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractText, getDocumentProxy } from 'unpdf'

const AGENCIES = new URL('../agencies/', import.meta.url).pathname
const CHUNK = 900
const OVERLAP = 150

function chunks(text) {
  text = text.split(/\s+/).join(' ').trim()
  if (text.length <= CHUNK) return text ? [text] : []
  const out = []
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

/** Pages of a PDF, or "## " sections of a Markdown file, as [{loc, text}]. */
async function units(path) {
  if (path.endsWith('.md')) {
    return readFileSync(path, 'utf8')
      .split(/^## /m)
      .slice(1)
      .map((s) => ({ loc: `section ${s.split('.')[0]}`, text: s }))
  }
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path)))
  const { text } = await extractText(pdf, { mergePages: false })
  return text.map((t, i) => ({ loc: `p. ${i + 1}`, text: t }))
}

for (const id of readdirSync(AGENCIES)) {
  const manifest = join(AGENCIES, id, 'sop', 'sources.json')
  if (!existsSync(manifest)) continue
  const sources = JSON.parse(readFileSync(manifest, 'utf8'))
  const passages = []
  for (const src of sources) {
    const parts = await units(join(AGENCIES, id, 'sop', src.file))
    if (parts.reduce((n, p) => n + p.text.trim().length, 0) < 200) {
      console.warn(`skipped ${src.file}: no text layer`)
      continue
    }
    for (const p of parts) {
      for (const text of chunks(p.text)) passages.push({ doc: src.short, title: src.title, url: src.url, loc: p.loc, text })
    }
  }
  writeFileSync(join(AGENCIES, id, 'sop-index.json'), JSON.stringify({ sources, passages }))
  console.log(`${id}: ${sources.length} documents, ${passages.length} passages`)
}
