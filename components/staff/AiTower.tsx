'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { AiReport } from '@/lib/ai-report'
import { api } from '../api'
import { useT } from '../Lang'
import { AGENT_META, Card, Icon, ago } from '../ui'
import { useStaff } from './StaffProvider'

export interface Tower {
  models: { agent: string; key: string; role: string; default: string; chosen: string | null }[]
  choices: string[]
  key: { provider: string; store: string; configured: boolean; fingerprint: string | null }
  telemetry: { tracing: boolean; metrics: boolean; logging: boolean; project: string | null; error?: string }
  safety: {
    filters: { reading: string; writing: string }
    confidence_floor: number
    escalate_flags: string[]
    keywords: number
    limits: { reports_per_hour: number; reports_per_day: number; ai_reports_per_day: number }
    details: { required: string[]; max_questions: number }
  }
  eval: { n: number; category_accuracy: number; urgency_within_one: number; critical_recall_with_rules: number; escalations_high_or_critical_label: number }
  eval_at: string
  report: AiReport
}

const PROJECT = 'embrace-23a9c'
const CONSOLE = {
  trace: `https://console.cloud.google.com/traces/list?project=${PROJECT}`,
  metrics: `https://console.cloud.google.com/monitoring/metrics-explorer?project=${PROJECT}`,
  logs: `https://console.cloud.google.com/logs/query;query=jsonPayload.component%3D%22embrace-agents%22?project=${PROJECT}`,
}
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString())

/** AI control tower: which models run, under which key and guardrails, and what the agents did, for governance. */
export default function AiTower() {
  const t = useT()
  const { agency, me } = useStaff()
  const [d, setD] = useState<Tower | null>(null)
  const [err, setErr] = useState('')
  const [models, setModels] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState('')
  const load = useCallback(() => api.ai(agency.id).then((x) => {
    setD(x)
    setModels(Object.fromEntries(x.models.map((m) => [m.key, m.chosen ?? m.default])))
  }).catch((e) => setErr(String(e))), [agency.id])
  useEffect(() => { load() }, [load])

  if (err) return <div className="page"><p className="error">{err}</p></div>
  if (!d) return <div className="page"><div className="shimmer tall" /></div>
  const r = d.report
  const canEdit = me.role === 'leader'
  const changed = d.models.some((m) => models[m.key] !== (m.chosen ?? m.default))
  const save = async () => {
    setSaved('')
    try {
      await api.setAiModels(agency.id, models, me.name)
      setSaved(t('Saved. New reports use these models within a minute.'))
      load()
    } catch (e) {
      setSaved(String(e).replace(/^Error: \d+ /, ''))
    }
  }
  const maxRun = Math.max(1, ...r.recent.map((x) => x.steps.filter((s) => !s.rerun).reduce((a, s) => a + s.ms, 0)))

  return (
    <div className="page tower">
      <div className="page-h">
        <div>
          <h1>{t('AI control tower')}</h1>
          <p className="muted">{t('Which models run, under which key and guardrails, and what the agents did in the last 30 days.')}</p>
        </div>
      </div>

      <div className="kpis">
        <Kpi label={t('Model calls')} value={k(r.model_calls)} sub={t('{n} cases', { n: r.cases })} />
        <Kpi label={t('Tokens in / out')} value={`${k(r.tokens_in)} / ${k(r.tokens_out)}`} />
        <Kpi label={t('Pipeline time p50 / p95')} value={`${sec(r.run_p50_ms)} / ${sec(r.run_p95_ms)}`} />
        <Kpi label={t('Rules fallback')} value={`${r.fallback_pct}%`} sub={t('model failed or budget used')} tone={r.fallback_pct > 5 ? 'warn' : undefined} />
        <Kpi label={t('Guardrail findings')} value={r.guard_injection + r.guard_draft} sub={t('{a} input · {b} draft', { a: r.guard_injection, b: r.guard_draft })} tone={r.guard_injection ? 'warn' : undefined} />
        <Kpi label={t('Drafts edited by staff')} value={`${r.draft_edited_pct}%`} sub={t('{n} replies sent', { n: r.replies_sent })} />
      </div>

      <div className="tower-grid">
        <Card title={t('Models')} icon="spark" className="t-models">
          <table className="ttable">
            <thead><tr><th>{t('Agent')}</th><th>{t('Model')}</th></tr></thead>
            <tbody>
              {d.models.map((m) => (
                <tr key={m.agent}>
                  <td><b>{t(AGENT_META[m.agent]?.label ?? 'Analyst agent')}</b><div className="muted small">{t(m.role)}</div></td>
                  <td>
                    <select value={models[m.key]} disabled={!canEdit} onChange={(e) => setModels({ ...models, [m.key]: e.target.value })} aria-label={t('Model')}>
                      {[...new Set([m.default, ...d.choices])].map((c) => <option key={c} value={c}>{c}{c === m.default ? ` · ${t('default')}` : ''}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit
            ? <div className="form-actions"><button className="primary small" disabled={!changed} onClick={save}>{t('Apply models')}</button>{saved && <span className="muted small">{saved}</span>}</div>
            : <p className="muted small">{t('Only the head of office changes models; every change is logged.')}</p>}
        </Card>

        <Card title={t('API key and data')} icon="shield" className="t-key">
          <ul className="checks">
            <Check ok={d.key.configured}>{d.key.provider}: {d.key.configured ? t('configured') : t('missing')}{d.key.fingerprint && <> · <code>sha256 {d.key.fingerprint}…</code></>}</Check>
            <Check ok>{t(d.key.store)}</Check>
            <Check ok>{t('The key stays on the server; browsers and logs never see it.')}</Check>
            <Check ok>{t('Personal data is masked before staff read a case; prompts and complaint text are not logged.')}</Check>
            <Check ok>{t('Cases stored in Firestore, asia-southeast1 (Jakarta region).')}</Check>
          </ul>
        </Card>

        <Card title={t('Guardrails')} icon="shield" className="t-safety">
          <ul className="checks">
            <Check ok><b>{t('Input')}:</b> {t('instructions aimed at the AI are detected in code and send the case to a person; public text is fenced as data in every prompt.')}</Check>
            <Check ok><b>{t('Gemini safety filters')}:</b> {t('reading agents {a}, drafter {b} (reports describe abuse, so readers only block high-probability harm).', { a: d.safety.filters.reading, b: d.safety.filters.writing })}</Check>
            <Check ok><b>{t('Output')}:</b> {t('drafts are checked for copied personal data, invented links, citations that do not exist, a missing report number and promised outcomes.')}</Check>
            <Check ok><b>{t('Deterministic decisions')}:</b> {t('escalation and routing are code: {f} safety flags, {k} keywords, manual review below {c}% confidence.', { f: d.safety.escalate_flags.length, k: d.safety.keywords, c: Math.round(d.safety.confidence_floor * 100) })}</Check>
            <Check ok><b>{t('Human in the loop')}:</b> {t('no reply reaches a citizen without a caseworker approving it.')}</Check>
            <Check ok><b>{t('Limits')}:</b> {t('{h} reports per chat per hour, {d} per day; {a} AI-processed reports per day, then rules only.', { h: d.safety.limits.reports_per_hour, d: d.safety.limits.reports_per_day, a: d.safety.limits.ai_reports_per_day })}</Check>
            <Check ok><b>{t('Resilience')}:</b> {t('ADK reflect-and-retry for malformed tool calls; any model failure falls back to keyword rules and manual review.')}</Check>
          </ul>
        </Card>

        <Card title={t('Observability')} icon="eye" className="t-otel">
          <ul className="checks">
            <Check ok={d.telemetry.tracing}><b>{t('Traces')}:</b> {t('ADK OpenTelemetry spans (invoke_agent, generate_content) to Cloud Trace.')} <a href={CONSOLE.trace} target="_blank" rel="noreferrer">{t('Open')}</a></Check>
            <Check ok={d.telemetry.metrics}><b>{t('Metrics')}:</b> <code>gen_ai.client.token.usage</code>, <code>gen_ai.client.operation.duration</code>, <code>embrace.guardrail.events</code> {t('to Cloud Monitoring.')} <a href={CONSOLE.metrics} target="_blank" rel="noreferrer">{t('Open')}</a></Check>
            <Check ok={d.telemetry.logging}><b>{t('Logs')}:</b> {t('structured model-call, guardrail and audit events to Cloud Logging, metadata only.')} <a href={CONSOLE.logs} target="_blank" rel="noreferrer">{t('Open')}</a></Check>
            <Check ok><b>{t('Evaluation')}:</b> {t('{n} labelled reports: category {c}%, critical cases escalated {r}%, urgency within one level {u}%.', { n: d.eval.n, c: d.eval.category_accuracy, r: d.eval.critical_recall_with_rules, u: d.eval.urgency_within_one })}</Check>
          </ul>
          {d.telemetry.error && <p className="error small">{d.telemetry.error}</p>}
          {!d.telemetry.tracing && !d.telemetry.error && <p className="muted small">{t('Telemetry export runs on Cloud Run; this instance is local.')}</p>}
        </Card>

        <Card title={t('Agents, last 30 days')} icon="chart" className="t-agents">
          {r.agents.length === 0 ? <p className="muted">{t('No AI runs yet: send a report to see them here.')}</p> : (
            <table className="ttable">
              <thead><tr><th>{t('Agent')}</th><th>{t('Calls')}</th><th>p50</th><th>p95</th><th>{t('Tokens in / out')}</th></tr></thead>
              <tbody>{r.agents.map((a) => (
                <tr key={a.agent}><td><b>{t(AGENT_META[a.agent]?.label ?? a.agent)}</b><div className="muted small">{a.models.join(', ')}</div></td><td>{a.calls}</td><td>{sec(a.p50_ms)}</td><td>{sec(a.p95_ms)}</td><td>{k(a.tokens_in)} / {k(a.tokens_out)}</td></tr>
              ))}</tbody>
            </table>
          )}
          <p className="muted small">{t('Multi-turn intake: details asked in {a} cases, answered in {b}.', { a: r.details_asked, b: r.details_answered })}</p>
        </Card>

        <Card title={t('Recent agent runs')} icon="clock" className="t-runs">
          {r.recent.length === 0 && <p className="muted">{t('No AI runs yet: send a report to see them here.')}</p>}
          <ul className="runs">
            {r.recent.map((x) => (
              <li key={x.id}>
                <Link href={`/staff/cases/${x.id}`}><code>{x.id}</code></Link>
                <span className="muted small">{ago(x.at, t)}{x.route ? ` · ${t(x.route === 'escalated' ? 'Escalated' : x.route === 'manual_review' ? 'Manual review' : 'Assigned')}` : ''}{x.guard ? ` · ${t('{n} guardrail', { n: x.guard })}` : ''}</span>
                <span className="bar" aria-hidden="true">
                  {x.steps.filter((s) => !s.rerun).map((s, i) => (
                    <span key={i} className={`seg ${s.kind} ${s.agent}${s.fallback ? ' fb' : ''}`} style={{ width: `${Math.max(2, (s.ms / maxRun) * 100)}%` }}
                      title={`${s.agent}${s.model ? ` · ${s.model}` : ''} · ${sec(s.ms)}${s.tokens ? ` · ${s.tokens} tokens` : ''}`} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="legend muted small"><span className="seg llm" /> {t('model call')} <span className="seg rules" /> {t('rules')} <span className="seg search" /> {t('SOP search')}</p>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'warn' }) {
  return <div className={`kpi ${tone ?? ''}`}><span>{label}</span><b>{value}</b>{sub && <small className="muted">{sub}</small>}</div>
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <li className={ok ? 'ok' : 'off'}><Icon name={ok ? 'check' : 'close'} size={14} /><span>{children}</span></li>
}
