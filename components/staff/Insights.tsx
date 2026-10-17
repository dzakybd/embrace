'use client'

import { useEffect, useState } from 'react'
import { api, type AnalystAnswer, type Overview } from '../api'
import Link from 'next/link'
import { CHANNEL_LABEL, Card, Icon, URGENCY_LABEL } from '../ui'
import { useStaff } from './StaffProvider'

const SUGGESTED: Record<string, string[]> = {
  dinsos_demak: ['Which village needs attention first this week?', 'Is there a pattern of illegal levies in aid distribution?', 'Desa mana yang paling banyak aduan rob?'],
  kpai: ['Which school has the most complaints this month?', 'Which clusters grew this week vs last week?', 'Berapa kasus kritis yang belum ditanggapi?'],
}

export default function Insights() {
  const { agency } = useStaff()
  const [tab, setTab] = useState('overview')
  const [history, setHistory] = useState<{ q: string; a: AnalystAnswer }[]>([])
  const [ov, setOv] = useState<Overview | null>(null)
  const [brief, setBrief] = useState<AnalystAnswer | null>(null)
  const [briefErr, setBriefErr] = useState('')
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<AnalystAnswer | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    setOv(null)
    setBrief(null)
    setAnswer(null)
    setBriefErr('')
    api.overview(agency.id).then(setOv)
    api.brief(agency.id).then(setBrief).catch((e) => setBriefErr(String(e)))
  }, [agency.id])

  const ask = async (question: string) => {
    setQ(question)
    setAsking(true)
    setAnswer(null)
    try {
      const a = await api.ask(agency.id, question)
      setAnswer(a)
      setHistory((h) => [{ q: question, a }, ...h].slice(0, 6))
    } catch (e) {
      setAnswer({ answer: `Error: ${e}`, tools_used: [] })
    } finally {
      setAsking(false)
    }
  }

  const refreshBrief = () => {
    setBrief(null)
    setBriefErr('')
    api.brief(agency.id, true).then(setBrief).catch((e) => setBriefErr(String(e)))
  }

  if (!ov) return <div className="page"><div className="shimmer tall" /></div>

  const askPanel = (
    <Card title="Ask the analyst agent" icon="spark" className="brief">
      <p className="muted small">The analyst agent answers from live case data by calling tools (overview, clusters, case search). It never sees personal data.</p>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q) }}>
        <label htmlFor="ask" className="sr">Ask the analyst agent</label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your reports, in any language…" />
        <button className="primary" disabled={asking || q.trim().length < 3}>Ask</button>
      </form>
      <div className="samples">
        {SUGGESTED[agency.id]?.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
      </div>
      {asking && <div className="shimmer tall" />}
      {history.map((h, i) => (
        <div key={i} className="answer">
          <p className="q"><b>{h.q}</b></p>
          <Answer a={h.a} />
        </div>
      ))}
      {!asking && !history.length && answer && <div className="answer"><Answer a={answer} /></div>}
    </Card>
  )

  return (
    <div className="page dash">
      <div className="page-h">
        <div>
          <h1>Insights</h1>
          <p className="muted">{agency.name} · last 30 days, no personal data</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button role="tab" aria-selected={tab === 'ask'} className={tab === 'ask' ? 'on' : ''} onClick={() => setTab('ask')}>Ask the analyst</button>
      </div>
      {tab === 'ask' ? askPanel : (<>
      <div className="kpis">
        <Kpi label="Reports, 30 days" value={ov.total} />
        <Kpi label="Open now" value={ov.open} />
        <Kpi label="Escalated" value={ov.escalated} tone="crit" icon="alert" />
        <Kpi label="Open past SLA" value={ov.sla_breached_open} tone={ov.sla_breached_open ? 'warn' : undefined} icon="clock" />
        <Kpi label="Median first response" value={ov.median_first_response_h == null ? '—' : `${ov.median_first_response_h} h`} />
      </div>

      <div className="dash-grid">
        <Card title="AI weekly brief" icon="spark" className="brief"
          action={<button className="ghost small" onClick={refreshBrief} aria-label="Regenerate brief"><Icon name="refresh" size={14} /></button>}>
          {brief ? <Answer a={brief} /> : briefErr ? <p className="error">{briefErr}</p> : <div className="shimmer tall" aria-label="Analyst agent is reading the data" />}
          <button className="ghost small" onClick={() => setTab('ask')}><Icon name="chat" size={14} /> Ask a follow-up question</button>
        </Card>

        <Card title="Early warning: related reports" icon="pin" className="clusters">
          {ov.clusters.length === 0 && <p className="muted">No clusters in the last 14 days.</p>}
          {ov.clusters.map((c) => (
            <div key={c.kind + c.display} className="cluster">
              <div className="cluster-h">
                <b>{c.display}</b>
                <span className="count">{c.count} reports</span>
              </div>
              <p className="muted">
                {c.kind.replace('_', ' ')} · {c.top_categories.join(', ')}
                {c.top_locations.length > 0 && c.kind !== 'location' && <> · {c.top_locations.join(', ')}</>}
              </p>
              <p className="muted small">since {new Date(c.first_seen).toLocaleDateString()} · {c.ticket_ids.slice(0, 4).map((id) => (
                <Link key={id} href={`/staff/cases/${id}`}>{id} </Link>))}</p>
            </div>
          ))}
        </Card>

        <Card title="Reports by category" icon="chart" className="cats">
          <CategoryBars ov={ov} />
        </Card>

        <Card title="Daily volume" icon="chart" className="daily">
          <DailyColumns data={ov.daily} />
        </Card>

        <Card title="By urgency" icon="alert" className="urg">
          <ul className="statlist">
            {(['critical', 'high', 'normal', 'low'] as const).map((u) => (
              <li key={u}><span className={`badge urg-${u}`}>{URGENCY_LABEL[u]}</span><b>{ov.by_urgency[u] ?? 0}</b></li>
            ))}
          </ul>
        </Card>

        <Card title="By channel" icon="chat" className="chan">
          <ul className="statlist">
            {Object.entries(ov.by_channel).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <li key={c}><span>{CHANNEL_LABEL[c] ?? c}</span><b>{n}</b></li>
            ))}
          </ul>
        </Card>
      </div>
      </>)}
    </div>
  )
}

function Kpi({ label, value, tone, icon }: { label: string; value: number | string; tone?: 'crit' | 'warn'; icon?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span>{icon && <Icon name={icon} size={14} />} {label}</span>
      <b>{value}</b>
    </div>
  )
}

function Answer({ a }: { a: AnalystAnswer }) {
  return (
    <>
      <div className="md">{a.answer.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l.replace(/\*\*/g, '').replace(/^\s*[*-]\s+/, '• ')}</p>)}</div>
      {a.tools_used.length > 0 && (
        <p className="muted small"><Icon name="rules" size={12} /> Analyst agent used: {[...new Set(a.tools_used)].join(', ')}</p>
      )}
    </>
  )
}

function CategoryBars({ ov }: { ov: Overview }) {
  const max = Math.max(1, ...ov.by_category.map((c) => c.count))
  return (
    <table className="bars">
      <caption className="sr">Complaints per category in the last 30 days, with this week versus last week</caption>
      <tbody>
        {ov.by_category.map((c) => {
          const d = c.this_week - c.prev_week
          return (
            <tr key={c.id} title={`${c.label}: ${c.count} (this week ${c.this_week}, last week ${c.prev_week})`}>
              <th scope="row">{c.label}</th>
              <td className="bar-cell">
                <span className="bar" style={{ width: `${(c.count / max) * 100}%` }} />
                <span className="val">{c.count}</span>
              </td>
              <td className={`delta ${d > 0 ? 'up' : ''}`}>{d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '–'}<span className="sr"> vs last week</span></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DailyColumns({ data }: { data: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const days: { date: string; count: number }[] = []
  const map = Object.fromEntries(data.map((d) => [d.date, d.count]))
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)
    days.push({ date: d, count: map[d] ?? 0 })
  }
  const max = Math.max(1, ...days.map((d) => d.count))
  const W = 600, H = 160, pad = 24, bw = (W - pad) / days.length
  const ticks = [0, Math.ceil(max / 2), max]
  return (
    <div className="daily-wrap">
      <svg viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Complaints per day for the last 30 days" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => {
          const y = H - (t / max) * (H - 10)
          return (
            <g key={t}>
              <line x1={pad} x2={W} y1={y} y2={y} className="grid" />
              <text x={pad - 6} y={y + 4} className="axis" textAnchor="end">{t}</text>
            </g>
          )
        })}
        {days.map((d, i) => {
          const h = (d.count / max) * (H - 10)
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={pad + i * bw} y={0} width={bw} height={H} fill="transparent" />
              {d.count > 0 && (
                <path className={`col ${hover === i ? 'on' : ''}`}
                  d={`M${pad + i * bw + 2},${H} v${-(h - 4)} q0,-4 4,-4 h${bw - 12} q4,0 4,4 v${h - 4} z`} />
              )}
            </g>
          )
        })}
        {[0, 14, 29].map((i) => (
          <text key={i} x={pad + i * bw + bw / 2} y={H + 16} className="axis" textAnchor="middle">
            {new Date(days[i].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
      {hover != null && (
        <div className="tip" style={{ left: `${((pad + hover * bw + bw / 2) / W) * 100}%` }}>
          <b>{days[hover].count}</b> on {new Date(days[hover].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  )
}
