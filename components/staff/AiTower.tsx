'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AiReport } from '@/lib/ai-report'
import { api } from '../api'
import { useT } from '../Lang'
import { AGENT_META, Card, Icon, ago } from '../ui'
import { AgentMap } from './AgentMap'
import { Chart, COLORS } from '../Chart'
import { CountUp } from '../CountUp'
import { useStaff } from './StaffProvider'

type Guard = { read: string; write: string; injection: 'review' | 'flag'; questions: number }
type EvalSummary = { category_accuracy: number; critical_recall_with_rules: number; urgency_within_one: number }

export interface Tower {
  models: { agent: string; key: string; role: string; default: string; chosen: string | null }[]
  choices: { model: string; price: [number, number] | null; eval: EvalSummary | null }[]
  guard: Guard
  thresholds: string[]
  changed: { by?: string; at: string } | null
  key: { provider: string; store: string; configured: boolean; hint: string | null }
  telemetry: { tracing: boolean; metrics: boolean; logging: boolean; project: string | null; error?: string }
  safety: {
    confidence_floor: number
    escalate_flags: string[]
    keywords: number
    limits: { reports_per_hour: number; reports_per_day: number; ai_reports_per_day: number }
    details: { required: string[]; max_questions: number }
  }
  eval: EvalSummary & { n: number }
  eval_at: string
  attacks: {
    n: number
    held: number
    held_or_caught: number
    screened: number
    at: string
    rows: { id: string; kind: string; screened: boolean; held: boolean; caught: boolean }[]
  }
  report: AiReport
}

const PROJECT = 'embrace-23a9c'
const CONSOLE = {
  trace: `https://console.cloud.google.com/traces/explorer?project=${PROJECT}`,
  metrics: `https://console.cloud.google.com/monitoring/metrics-explorer?project=${PROJECT}`,
  logs: `https://console.cloud.google.com/logs/query;query=jsonPayload.component%3D%22embrace-agents%22?project=${PROJECT}`,
}
const traceUrl = (id: string) => `https://console.cloud.google.com/traces/explorer;traceId=${id}?project=${PROJECT}`
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString())
const usd = (n: number) => (n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)
const THRESHOLD_LABEL: Record<string, string> = {
  BLOCK_NONE: 'Off',
  BLOCK_ONLY_HIGH: 'Block only high',
  BLOCK_MEDIUM_AND_ABOVE: 'Block medium and above',
  BLOCK_LOW_AND_ABOVE: 'Block low and above',
}

/** AI control tower: which models run at what cost and quality, the guardrails and what they caught, and live telemetry. */
export default function AiTower() {
  const t = useT()
  const { agency, me } = useStaff()
  const [d, setD] = useState<Tower | null>(null)
  const [err, setErr] = useState('')
  const [models, setModels] = useState<Record<string, string>>({})
  const [guard, setGuard] = useState<Guard | null>(null)
  const [saved, setSaved] = useState('')
  const load = useCallback(
    () =>
      api
        .ai(agency.id)
        .then((x) => {
          setD(x)
          setModels(Object.fromEntries(x.models.map((m) => [m.key, m.chosen ?? m.default])))
          setGuard(x.guard)
        })
        .catch((e) => setErr(String(e))),
    [agency.id],
  )
  useEffect(() => {
    load()
  }, [load])

  if (err)
    return (
      <div className="page">
        <p className="error">{err}</p>
      </div>
    )
  if (!d || !guard)
    return (
      <div className="page">
        <div className="shimmer tall" />
      </div>
    )
  const r = d.report
  const canEdit = me.role === 'supervisor'
  const changed =
    d.models.some((m) => models[m.key] !== (m.chosen ?? m.default)) || JSON.stringify(guard) !== JSON.stringify(d.guard)
  const save = async () => {
    setSaved('')
    try {
      await api.setAi(agency.id, { models, guard, by: me.name })
      setSaved(t('Saved. New reports use these settings within a minute.'))
      load()
    } catch (e) {
      setSaved(String(e).replace(/^Error: \d+ /, ''))
    }
  }
  const choice = (m: string) => d.choices.find((c) => c.model === m)
  const live = (m: string) => r.models.find((x) => x.model === m)
  const maxRun = Math.max(1, ...r.recent.map((x) => x.steps.filter((s) => !s.rerun).reduce((a, s) => a + s.ms, 0)))
  const maxDraft = Math.max(1, ...r.draft_checks.map((c) => c.count))

  return (
    <div className="page tower">
      <div className="page-h">
        <div>
          <h1>{t('AI control tower')}</h1>
          <p className="muted">{t('Models, cost, guardrails and live telemetry of the agents, last 30 days.')}</p>
        </div>
        {d.changed && (
          <p className="muted small">
            {t('Last change by {by}, {when}', { by: d.changed.by ?? '?', when: ago(d.changed.at, t) })}
          </p>
        )}
      </div>

      <div className="kpis">
        <Kpi label={t('Model calls')} value={k(r.model_calls)} sub={t('{n} cases', { n: r.cases })} />
        <Kpi label={t('Estimated AI cost')} value={usd(r.usd)} sub={t('{c} per case', { c: usd(r.usd_per_case) })} />
        <Kpi label={t('Pipeline time p50 / p95')} value={`${sec(r.run_p50_ms)} / ${sec(r.run_p95_ms)}`} />
        <Kpi
          label={t('Rules fallback')}
          value={`${r.fallback_pct}%`}
          sub={t('model failed or budget used')}
          tone={r.fallback_pct > 5 ? 'warn' : undefined}
        />
        <Kpi
          label={t('Guardrail findings')}
          value={r.guard_injection + r.guard_draft}
          sub={t('{a} input · {b} draft', { a: r.guard_injection, b: r.guard_draft })}
          tone={r.guard_injection ? 'warn' : undefined}
        />
        <Kpi
          label={t('Drafts edited by staff')}
          value={`${r.draft_edited_pct}%`}
          sub={t('{n} replies sent', { n: r.replies_sent })}
        />
      </div>

      <AgentMap models={Object.fromEntries(d.models.map((m) => [m.agent, models[m.key]]))} stats={r.agents} />

      <div className="tower-grid">
        <Card title={t('Activity, last 14 days')} icon="chart" className="t-activity">
          <Activity days={r.daily} />
        </Card>

        <Card title={t('API key and usage')} icon="shield" className="t-key">
          <div className="statgrid">
            <Stat
              label={t('Gemini API key')}
              value={d.key.configured ? t('Active') : t('Missing')}
              tone={d.key.configured ? 'ok' : 'bad'}
              sub={d.key.hint ? t('ends in {k}', { k: d.key.hint }) : undefined}
            />
            <Stat label={t('Tokens in / out')} value={`${k(r.tokens_in)} / ${k(r.tokens_out)}`} />
            <Stat label={t('Spend, 30 days')} value={usd(r.usd)} />
            <Stat
              label={t('Daily AI budget')}
              value={t('{n} reports', { n: d.safety.limits.ai_reports_per_day })}
              sub={t('then rules only')}
            />
          </div>
          <p className="muted small">
            {t(d.key.store)}. {t('The key stays on the server; browsers and logs never see it.')}
          </p>
        </Card>

        <Card title={t('Models')} icon="spark" className="t-models">
          <table className="ttable">
            <thead>
              <tr>
                <th>{t('Agent')}</th>
                <th>{t('Model')}</th>
                <th>{t('Price in / out')}</th>
                <th>{t('Live p50')}</th>
              </tr>
            </thead>
            <tbody>
              {d.models.map((m) => {
                const sel = models[m.key]
                const c = choice(sel)
                return (
                  <tr key={m.agent}>
                    <td>
                      <b>{t(AGENT_META[m.agent]?.label ?? m.agent)}</b>
                      <div className="muted small">{t(m.role)}</div>
                    </td>
                    <td>
                      <select
                        value={sel}
                        disabled={!canEdit}
                        onChange={(e) => setModels({ ...models, [m.key]: e.target.value })}
                        aria-label={t('Model')}
                      >
                        {[...new Set([m.default, ...d.choices.map((x) => x.model)])].map((x) => (
                          <option key={x} value={x}>
                            {x}
                            {x === m.default ? ` · ${t('default')}` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">{c?.price ? `$${c.price[0]} / $${c.price[1]}` : '—'}</td>
                    <td className="num">{live(sel) ? sec(live(sel)!.p50_ms) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <h3 className="sub-h">{t('Triage quality by model, on {n} labelled reports', { n: d.eval.n })}</h3>
          <table className="ttable">
            <thead>
              <tr>
                <th>{t('Model')}</th>
                <th>{t('Category')}</th>
                <th>{t('Critical escalated')}</th>
                <th>{t('Urgency ±1')}</th>
              </tr>
            </thead>
            <tbody>
              {d.choices
                .filter((c) => c.eval)
                .map((c) => (
                  <tr key={c.model} className={models.triage === c.model ? 'sel' : ''}>
                    <td>{c.model}</td>
                    <td className="num">{c.eval!.category_accuracy}%</td>
                    <td className="num">{c.eval!.critical_recall_with_rules}%</td>
                    <td className="num">{c.eval!.urgency_within_one}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="muted small">
            {t(
              'Prices are USD per million tokens (Gemini API list prices, October 2026). Quality is measured with npm run eval on synthetic reports.',
            )}
          </p>
        </Card>

        <Card title={t('Guardrails')} icon="shield" className="t-safety">
          <div className="guard-form">
            <label className="field">
              <span>{t('Safety filter, agents that read reports')}</span>
              <select
                value={guard.read}
                disabled={!canEdit}
                onChange={(e) => setGuard({ ...guard, read: e.target.value })}
              >
                {d.thresholds.map((x) => (
                  <option key={x} value={x}>
                    {t(THRESHOLD_LABEL[x] ?? x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Safety filter, reply drafter')}</span>
              <select
                value={guard.write}
                disabled={!canEdit}
                onChange={(e) => setGuard({ ...guard, write: e.target.value })}
              >
                {d.thresholds.map((x) => (
                  <option key={x} value={x}>
                    {t(THRESHOLD_LABEL[x] ?? x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('When a report contains instructions aimed at the AI')}</span>
              <select
                value={guard.injection}
                disabled={!canEdit}
                onChange={(e) => setGuard({ ...guard, injection: e.target.value as Guard['injection'] })}
              >
                <option value="review">{t('Send the case to a person')}</option>
                <option value="flag">{t('Only flag it')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('Follow-up questions for missing details')}</span>
              <select
                value={guard.questions}
                disabled={!canEdit}
                onChange={(e) => setGuard({ ...guard, questions: Number(e.target.value) })}
              >
                <option value={0}>{t('Off')}</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
          </div>
          <h3 className="sub-h">{t('Output checks on drafts, last 30 days')}</h3>
          <ul className="hbars">
            {r.draft_checks.map((c) => (
              <li key={c.check}>
                <span>{t(c.check)}</span>
                <span className="hbar">
                  <span style={{ width: `${(c.count / maxDraft) * 100}%` }} />
                </span>
                <b>{c.count}</b>
              </li>
            ))}
          </ul>
          <h3 className="sub-h">{t('Attack tests on the public chat')}</h3>
          <p className="small-body">
            {t(
              '{held} of {n} synthetic attacks held (prompt injection, prompt leaks, urgency tricks, planted links and promises); {s} were caught by the input screen first.',
              { held: d.attacks.rows.filter((x) => x.held).length, n: d.attacks.n, s: d.attacks.screened },
            )}{' '}
            <span className="muted small">{t('Run {date}', { date: d.attacks.at.slice(0, 10) })}</span>
          </p>
          <ul className="chips" aria-label={t('Attack tests on the public chat')}>
            {d.attacks.rows.map((x) => (
              <li key={x.id} className={`tag ${x.held ? '' : 'flag'}`} title={x.id}>
                <Icon name={x.held ? 'check' : 'alert'} size={12} /> {x.kind}
              </li>
            ))}
          </ul>
          <p className="muted small">
            {t(
              'Always on: escalation by rules ({f} safety flags, {k} keywords), manual review below {c}% confidence, and a caseworker approves every reply.',
              {
                f: d.safety.escalate_flags.length,
                k: d.safety.keywords,
                c: Math.round(d.safety.confidence_floor * 100),
              },
            )}
          </p>
        </Card>

        <Card title={t('Recent agent runs')} icon="clock" className="t-runs">
          {r.recent.length === 0 && <p className="muted">{t('No AI runs yet: send a report to see them here.')}</p>}
          <ul className="runs">
            {r.recent.map((x) => (
              <li key={x.id}>
                <Link href={`/staff/cases/${x.id}`}>
                  <code>{x.id}</code>
                </Link>
                <span className="muted small">
                  {ago(x.at, t)}
                  {x.route
                    ? ` · ${t(x.route === 'escalated' ? 'Escalated' : x.route === 'manual_review' ? 'Manual review' : 'Assigned')}`
                    : ''}
                  {x.guard ? ` · ${t('{n} guardrail', { n: x.guard })}` : ''}
                  {x.trace_id && (
                    <>
                      {' '}
                      ·{' '}
                      <a href={traceUrl(x.trace_id)} target="_blank" rel="noreferrer">
                        {t('Trace')} ↗
                      </a>
                    </>
                  )}
                </span>
                <span className="bar" aria-hidden="true">
                  {x.steps
                    .filter((s) => !s.rerun)
                    .map((s, i) => (
                      <span
                        key={i}
                        className={`seg ${s.kind} ${s.agent}${s.fallback ? ' fb' : ''}`}
                        style={{ width: `${Math.max(2, (s.ms / maxRun) * 100)}%` }}
                        title={`${s.agent}${s.model ? ` · ${s.model}` : ''} · ${sec(s.ms)}${s.tokens ? ` · ${s.tokens} tokens` : ''}`}
                      />
                    ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="legend muted small">
            <span className="seg intake_agent" /> {t('Intake agent')} <span className="seg triage_agent" />{' '}
            {t('Triage agent')} <span className="seg drafter_agent" /> {t('Reply drafter')}{' '}
            <span className="seg rules" /> {t('rules')} <span className="seg search" /> {t('SOP search')}
          </p>
        </Card>

        <Card title={t('Observability')} icon="eye" className="t-otel">
          <div className="statgrid">
            <Stat
              label={t('Traces')}
              value={d.telemetry.tracing ? t('Exporting') : t('Off')}
              tone={d.telemetry.tracing ? 'ok' : undefined}
              sub="Cloud Trace"
              href={CONSOLE.trace}
            />
            <Stat
              label={t('Metrics')}
              value={d.telemetry.metrics ? t('Exporting') : t('Off')}
              tone={d.telemetry.metrics ? 'ok' : undefined}
              sub="Cloud Monitoring"
              href={CONSOLE.metrics}
            />
            <Stat
              label={t('Logs')}
              value={d.telemetry.logging ? t('Exporting') : t('Off')}
              tone={d.telemetry.logging ? 'ok' : undefined}
              sub="Cloud Logging"
              href={CONSOLE.logs}
            />
            <Stat
              label={t('Evaluation')}
              value={`${d.eval.category_accuracy}%`}
              sub={t('category accuracy, {n} reports', { n: d.eval.n })}
            />
          </div>
          <h3 className="sub-h">{t('Audit feed')}</h3>
          {r.events.length === 0 ? (
            <p className="muted small">{t('No guardrail or fallback events in the last 30 days.')}</p>
          ) : (
            <ul className="events">
              {r.events.map((e, i) => (
                <li key={i} className={e.kind}>
                  <span className="tag">
                    {t(
                      e.kind === 'injection'
                        ? 'Input guardrail'
                        : e.kind === 'draft'
                          ? 'Output guardrail'
                          : 'Rules fallback',
                    )}
                  </span>
                  <Link href={`/staff/cases/${e.ticket}`}>
                    <code>{e.ticket}</code>
                  </Link>
                  <span className="muted small">
                    {e.text.slice(0, 90)} · {ago(e.at, t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {d.telemetry.error && <p className="error small">{d.telemetry.error}</p>}
        </Card>
      </div>

      {canEdit && (
        <div className="savebar">
          <span className="muted small">
            {saved ||
              (changed
                ? t('Unsaved changes to models or guardrails')
                : t('Only the supervisor changes these settings; every change is logged.'))}
          </span>
          <button className="primary" disabled={!changed} onClick={save}>
            {t('Apply')}
          </button>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'warn' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span>{label}</span>
      <b>{typeof value === 'number' ? <CountUp value={value} /> : value}</b>
      {sub && <small className="muted">{sub}</small>}
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'ok' | 'bad'
  href?: string
}) {
  const body = (
    <>
      <span className="muted small">{label}</span>
      <b className={tone ?? ''}>{value}</b>
      {sub && (
        <small className="muted">
          {sub}
          {href ? ' ↗' : ''}
        </small>
      )}
    </>
  )
  return href ? (
    <a className="stat" href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <div className="stat">{body}</div>
  )
}

/** Model calls per day as columns, median model latency as a line (ECharts: tooltips, legend toggles, animation). */
function Activity({ days }: { days: AiReport['daily'] }) {
  const t = useT()
  const option = useMemo(
    () => ({
      grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true },
      legend: { top: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: days.map((d) => d.day.slice(5)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.line } },
      },
      yAxis: [
        { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: COLORS.line } } },
        { type: 'value', axisLabel: { formatter: '{value} s' }, splitLine: { show: false } },
      ],
      series: [
        {
          name: t('model calls'),
          type: 'bar',
          data: days.map((d) => d.calls),
          itemStyle: { color: COLORS.brand, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 22,
          animationDelay: (i: number) => i * 40,
        },
        {
          name: t('median latency'),
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 6,
          data: days.map((d) => (d.calls ? Math.round(d.p50_ms / 100) / 10 : null)),
          itemStyle: { color: COLORS.high },
          lineStyle: { width: 2 },
          areaStyle: { color: 'rgba(232,113,10,.08)' },
        },
      ],
    }),
    [days, t],
  )
  return <Chart option={option} height={200} label={t('Model calls per day and median latency, last 14 days')} />
}
