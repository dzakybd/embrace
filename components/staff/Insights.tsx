'use client'

import { useEffect, useState } from 'react'
import { api, type AnalystAnswer, type Overview } from '../api'
import Link from 'next/link'
import { CHANNEL_LABEL, ChannelIcon, Card, Icon, URGENCY_LABEL } from '../ui'
import { useLang, useT } from '../Lang'
import { useStaff } from './StaffProvider'
import { CountUp } from '../CountUp'
import { CaseMap, CategoryChart, ChannelDonut, DailyChart, UrgencyDonut } from './InsightCharts'

const SUGGESTED: Record<string, string[]> = {
  dinsos_demak: [
    'Which village needs attention first this week?',
    'Is there a pattern of illegal levies in aid distribution?',
    'How many tidal flood reports are still open?',
  ],
  kpai: [
    'Which school has the most complaints this month?',
    'Which clusters grew this week vs last week?',
    'How many critical cases have no response yet?',
  ],
}

export default function Insights() {
  const { t, lang } = useLang()
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
    api
      .brief(agency.id, false, lang)
      .then(setBrief)
      .catch((e) => setBriefErr(String(e)))
  }, [agency.id, lang])

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
    api
      .brief(agency.id, true, lang)
      .then(setBrief)
      .catch((e) => setBriefErr(String(e)))
  }

  if (!ov)
    return (
      <div className="page">
        <div className="shimmer tall" />
      </div>
    )

  const askPanel = (
    <Card title={t('Ask the analyst agent')} icon="spark" className="brief">
      <p className="muted small">{t('Answers from live case data through tools. It never sees personal data.')}</p>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) ask(q)
        }}
      >
        <label htmlFor="ask" className="sr">
          {t('Ask the analyst agent')}
        </label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Ask about your reports…')} />
        <button className="primary" disabled={asking || q.trim().length < 3}>
          {t('Ask')}
        </button>
      </form>
      <div className="samples">
        {SUGGESTED[agency.id]?.map((s) => (
          <button key={s} className="chip" onClick={() => ask(t(s))}>
            {t(s)}
          </button>
        ))}
      </div>
      {asking && <div className="shimmer tall" />}
      {history.map((h, i) => (
        <div key={i} className="answer">
          <p className="q">
            <b>{h.q}</b>
          </p>
          <Answer a={h.a} />
        </div>
      ))}
      {!asking && !history.length && answer && (
        <div className="answer">
          <Answer a={answer} />
        </div>
      )}
    </Card>
  )

  return (
    <div className="page dash">
      <div className="page-h">
        <div>
          <h1>{t('Insights')}</h1>
          <p className="muted">{t('Last 30 days, no personal data')}</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'overview'}
          className={tab === 'overview' ? 'on' : ''}
          onClick={() => setTab('overview')}
        >
          {t('Overview')}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'ask'}
          className={tab === 'ask' ? 'on' : ''}
          onClick={() => setTab('ask')}
        >
          {t('Ask the analyst')}
        </button>
      </div>
      {tab === 'ask' ? (
        askPanel
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Reports, 30 days" value={ov.total} />
            <Kpi label="Open now" value={ov.open} />
            <Kpi label="Escalated" value={ov.escalated} tone="crit" icon="alert" />
            <Kpi
              label="Open past SLA"
              value={ov.sla_breached_open}
              tone={ov.sla_breached_open ? 'warn' : undefined}
              icon="clock"
            />
            <Kpi
              label="Median first response"
              value={ov.median_first_response_h == null ? '—' : `${ov.median_first_response_h} ${t('h')}`}
            />
          </div>

          <div className="dash-grid">
            <Card
              title={t('AI weekly brief')}
              icon="spark"
              className="brief"
              action={
                <button className="ghost small" onClick={refreshBrief} aria-label={t('Regenerate brief')}>
                  <Icon name="refresh" size={14} />
                </button>
              }
            >
              {brief ? (
                <Answer a={brief} />
              ) : briefErr ? (
                <p className="error">{briefErr}</p>
              ) : (
                <div className="shimmer tall" aria-label={t('Analyst agent is reading the data')} />
              )}
              <button className="ghost small" onClick={() => setTab('ask')}>
                <Icon name="chat" size={14} /> {t('Ask a follow-up question')}
              </button>
            </Card>

            <Card title={t('Early warning: related reports')} icon="pin" className="clusters">
              {ov.clusters.length === 0 && <p className="muted">{t('No clusters in the last 14 days.')}</p>}
              {ov.clusters.map((c) => (
                <div key={c.kind + c.display} className="cluster">
                  <div className="cluster-h">
                    <b>{c.display}</b>
                    <span className="count">{t('{n} reports', { n: c.count })}</span>
                  </div>
                  <p className="muted">
                    {t(c.kind.replace('_', ' '))} · {c.top_categories.join(', ')}
                    {c.top_locations.length > 0 && c.kind !== 'location' && <> · {c.top_locations.join(', ')}</>}
                  </p>
                  <p className="muted small">
                    {t('since')} {new Date(c.first_seen).toLocaleDateString()} ·{' '}
                    {c.ticket_ids.slice(0, 4).map((id) => (
                      <Link key={id} href={`/staff/cases/${id}`}>
                        {id}{' '}
                      </Link>
                    ))}
                  </p>
                </div>
              ))}
            </Card>

            {ov.map && (
              <Card
                title={ov.map.level === 'province' ? t('Reports across Indonesia') : t('Reports across Demak regency')}
                icon="pin"
                className="geo"
              >
                <p className="muted small">
                  {t('Hover a region for its figures, scroll to zoom, click to open its cases.')}
                </p>
                <CaseMap ov={ov} />
              </Card>
            )}

            <Card title={t('Reports by category')} icon="chart" className="cats">
              <CategoryChart ov={ov} agency={agency} />
            </Card>

            <Card title={t('Daily volume')} icon="chart" className="daily">
              <DailyChart ov={ov} />
            </Card>

            <Card title={t('By urgency')} icon="alert" className="urg">
              <UrgencyDonut ov={ov} />
            </Card>

            <Card title={t('By channel')} icon="chat" className="chan">
              <ChannelDonut ov={ov} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number | string
  tone?: 'crit' | 'warn'
  icon?: string
}) {
  const t = useT()
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span>
        {icon && <Icon name={icon} size={14} />} {t(label)}
      </span>
      <b>{typeof value === 'number' ? <CountUp value={value} /> : value}</b>
    </div>
  )
}

function Answer({ a }: { a: AnalystAnswer }) {
  const t = useT()
  return (
    <>
      <div className="md">
        {a.answer
          .split('\n')
          .filter(Boolean)
          .map((l, i) => (
            <p key={i}>{l.replace(/\*\*/g, '').replace(/^\s*[*-]\s+/, '• ')}</p>
          ))}
      </div>
      {a.tools_used.length > 0 && (
        <p className="muted small">
          <Icon name="rules" size={12} /> {t('Analyst agent used:')} {[...new Set(a.tools_used)].join(', ')}
        </p>
      )}
    </>
  )
}
