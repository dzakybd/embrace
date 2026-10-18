// Usage: node scripts/load-burst.mjs [n]  (each report spends about US$0.0013 of the Gemini key)
// Concurrent AI reports against production: end-to-end time per report (SSE until `done`).
const BASE = 'https://embrace.nalaria.ai.id'
const N = Number(process.argv[2] || 10)
const texts = [
  'The BPNT food aid for this round has not arrived on my KKS card in Wonosalam, my neighbours already collected theirs.',
  'An elderly man in Mranggen lives alone, paralysed, nobody brings him food. Please send someone.',
  'Our house in Bedono, Sayung is flooded by the tidal flood, we have a baby and cannot evacuate.',
  'The e-warong agent in Wonosalam takes Rp50,000 from every recipient at each payout.',
  'How do I check whether my family is registered in DTSEN? We live in Dempet.',
]
async function one(i) {
  const t0 = performance.now()
  const res = await fetch(`${BASE}/api/agencies/dinsos_demak/complaints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: `${texts[i % texts.length]} (load test ${i})`, channel: 'web' }),
  })
  let first = null,
    body = ''
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (first === null) first = performance.now() - t0
    body += dec.decode(value)
  }
  const ok = body.includes('"type":"done"')
  return { i, status: res.status, ok, first: Math.round(first), total: Math.round(performance.now() - t0) }
}
const t0 = performance.now()
const rows = await Promise.all(Array.from({ length: N }, (_, i) => one(i)))
const tot = rows
  .filter((r) => r.ok)
  .map((r) => r.total)
  .sort((a, b) => a - b)
const q = (p) => tot[Math.min(tot.length - 1, Math.floor(p * tot.length))]
console.log(
  JSON.stringify({
    n: N,
    ok: tot.length,
    first_event_ms_max: Math.max(...rows.map((r) => r.first ?? 0)),
    p50_ms: q(0.5),
    p95_ms: q(0.95),
    max_ms: tot.at(-1),
    wall_ms: Math.round(performance.now() - t0),
    errors: rows.filter((r) => !r.ok),
  }),
)
