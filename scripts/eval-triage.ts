// Triage eval on the labelled synthetic sets in data/eval/: category, urgency and escalation recall.
// Uses the app's Gemini key; ~60 cases cost well under one US cent. Run: npm run eval [-- --limit 5]
import { InMemoryRunner, type Event } from '@google/adk'
import { readFileSync, writeFileSync } from 'node:fs'
import { getAgency } from '../lib/agencies'
import { initialState, triageOnly } from '../lib/agents/pipeline'
import type { Policy, Triage } from '../lib/schemas'

const RANK = { critical: 3, high: 2, normal: 1, low: 0 } as const
type U = keyof typeof RANK
const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
const runner = new InMemoryRunner({ agent: triageOnly, appName: 'embrace_eval' })

const rows: Record<string, unknown>[] = []
for (const agencyId of ['child_protection', 'id_demak']) {
  const agency = getAgency(agencyId)!
  const cases = JSON.parse(readFileSync(`data/eval/${agencyId}.json`, 'utf8')).slice(0, limit)
  for (const c of cases) {
    const state: Record<string, unknown> = {}
    try {
      const events = runner.runEphemeral({
        userId: 'eval',
        newMessage: { role: 'user', parts: [{ text: 'Process this complaint.' }] },
        stateDelta: initialState(agency, 'EVAL', c.text, c.channel, false),
      })
      for await (const ev of events as AsyncGenerator<Event>) Object.assign(state, ev.actions?.stateDelta ?? {})
    } catch (e) {
      console.error(agencyId, c.index, String(e).slice(0, 120))
    }
    const t = state.triage as Triage | undefined
    const p = state.policy as Policy | undefined
    rows.push({ agency: agencyId, index: c.index, want_category: c.category, want_urgency: c.urgency, category: t?.category, urgency: t?.urgency, final: p?.final_urgency, route: p?.route })
    process.stdout.write(t?.category === c.category ? '.' : 'x')
  }
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0)
const n = rows.length
const crit = rows.filter((r) => r.want_urgency === 'critical')
const esc = rows.filter((r) => r.route === 'escalated')
const summary = {
  n,
  category_accuracy: pct(rows.filter((r) => r.category === r.want_category).length, n),
  urgency_exact: pct(rows.filter((r) => r.urgency === r.want_urgency).length, n),
  urgency_within_one: pct(rows.filter((r) => r.urgency && Math.abs(RANK[r.urgency as U] - RANK[r.want_urgency as U]) <= 1).length, n),
  critical_recall_model: pct(crit.filter((r) => r.urgency === 'critical').length, crit.length),
  critical_recall_with_rules: pct(crit.filter((r) => r.route === 'escalated').length, crit.length),
  critical_cases: crit.length,
  escalations: esc.length,
  escalations_high_or_critical_label: pct(esc.filter((r) => RANK[r.want_urgency as U] >= 2).length, esc.length),
  manual_review: pct(rows.filter((r) => r.route === 'manual_review').length, n),
}
console.log('\n', summary)
writeFileSync('data/eval/results.json', JSON.stringify({ summary, rows, at: new Date().toISOString() }, null, 1))
