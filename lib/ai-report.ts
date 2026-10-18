// AI control tower figures, computed from the stored cases (their agent traces carry model, latency and tokens), so
// they hold across Cloud Run instances and restarts. Pure function: tested without a model or a database.
import type { Ticket } from './schemas'

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
function quantile(xs: number[], q: number) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

export interface AgentStats { agent: string; calls: number; p50_ms: number; p95_ms: number; tokens_in: number; tokens_out: number; models: string[] }

export function aiReport(tickets: Ticket[], sinceDays = 30) {
  const since = Date.now() - sinceDays * 86_400_000
  const live = tickets.filter((t) => !t.seeded && Date.parse(t.created_at) >= since)
  const steps = live.flatMap((t) => t.trace.map((s) => ({ ...s, ticket: t.id })))
  const llm = steps.filter((s) => s.kind === 'llm')
  const byAgent = new Map<string, typeof llm>()
  for (const s of llm) byAgent.set(s.agent, [...(byAgent.get(s.agent) ?? []), s])
  const agents: AgentStats[] = [...byAgent.entries()].map(([agent, xs]) => ({
    agent,
    calls: xs.length,
    p50_ms: quantile(xs.map((x) => x.ms), 0.5),
    p95_ms: quantile(xs.map((x) => x.ms), 0.95),
    tokens_in: xs.reduce((a, x) => a + (x.tokens_in ?? 0), 0),
    tokens_out: xs.reduce((a, x) => a + (x.tokens_out ?? 0), 0),
    models: [...new Set(xs.map((x) => x.model).filter((m): m is string => !!m))],
  }))
  const runs = live.map((t) => t.trace.filter((s) => !s.rerun).reduce((a, s) => a + s.ms, 0)).filter((ms) => ms > 0)
  const sent = live.filter((t) => t.sent_reply)
  const asked = live.filter((t) => t.details?.missing.length)
  return {
    days: sinceDays,
    cases: live.length,
    model_calls: llm.length,
    tokens_in: agents.reduce((a, x) => a + x.tokens_in, 0),
    tokens_out: agents.reduce((a, x) => a + x.tokens_out, 0),
    run_p50_ms: quantile(runs, 0.5),
    run_p95_ms: quantile(runs, 0.95),
    /** Cases decided by the keyword rules because a model call failed or the AI budget was used up. */
    fallback_pct: pct(live.filter((t) => t.trace.some((s) => s.fallback)).length, live.length),
    escalated_pct: pct(live.filter((t) => t.policy?.route === 'escalated').length, live.length),
    manual_review_pct: pct(live.filter((t) => t.policy?.route === 'manual_review').length, live.length),
    guard_injection: live.filter((t) => t.guard?.injection.length).length,
    guard_draft: live.filter((t) => t.guard?.draft.length).length,
    /** Human oversight: how often a caseworker changed the AI draft before sending it. */
    draft_edited_pct: pct(sent.filter((t) => t.reply_edited).length, sent.length),
    replies_sent: sent.length,
    details_asked: asked.length,
    details_answered: asked.filter((t) => t.details?.refined_at).length,
    agents,
    recent: live
      .filter((t) => t.trace.length)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12)
      .map((t) => ({
        id: t.id,
        at: t.created_at,
        channel: t.channel,
        route: t.policy?.route ?? null,
        guard: (t.guard?.injection.length ?? 0) + (t.guard?.draft.length ?? 0),
        steps: t.trace.map((s) => ({ agent: s.agent, kind: s.kind, ms: s.ms, model: s.model ?? null, tokens: (s.tokens_in ?? 0) + (s.tokens_out ?? 0), fallback: !!s.fallback, rerun: !!s.rerun })),
      })),
  }
}
export type AiReport = ReturnType<typeof aiReport>
