'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLang } from '../Lang'
import { procTitle, stageTitle } from '../Procedures'
import { Icon } from '../ui'

interface Tracked {
  id: string
  agency: string
  status: string
  created_at: string
  team: string | null
  sla_hours: number | null
  escalated: boolean
  emergency_line: string
  responded_at: string | null
  resolved_at: string | null
  reply: string | null
  agency_id: string
  agency_name_id: string | null
  procedure: { id: string; title: string; title_id?: string; stages: { title: string; title_id?: string }[]; done: number[] } | null
}

export default function Track({ id }: { id: string }) {
  const { t: tr, lang } = useLang()
  const [t, setT] = useState<Tracked | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    const load = () => fetch(`/api/track/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setT).catch(() => setMissing(true))
    load()
    const timer = setInterval(load, 15_000)
    return () => clearInterval(timer)
  }, [id])

  if (missing) return <section className="card citizen-card"><h1>{tr('Report not found')}</h1><p className="muted">{tr('Check the report number {id}.', { id })}</p><Link className="btn" href="/report">{tr('Send a report')}</Link></section>
  if (!t) return <section className="card citizen-card"><div className="shimmer tall" /></section>

  const due = t.sla_hours ? new Date(Date.parse(t.created_at) + t.sla_hours * 3600_000) : null
  const steps = [
    { label: tr('Received'), at: t.created_at, ok: true },
    { label: t.team ? tr('With: {team}', { team: t.team }) : tr('Being reviewed'), at: t.created_at, ok: !!t.team },
    { label: tr('Reply sent'), at: t.responded_at, ok: !!t.responded_at },
    { label: tr('Resolved'), at: t.resolved_at, ok: !!t.resolved_at },
  ]
  return (
    <section className="card citizen-card">
      <p className="muted small">{lang === 'id' && t.agency_name_id ? t.agency_name_id : t.agency}</p>
      <h1>{tr('Report')} {t.id}</h1>
      {t.escalated && !t.resolved_at && (
        <div className="banner crit"><Icon name="alert" /><span>{tr('Marked urgent: a supervisor has been alerted.')} {tr('If anyone is in danger right now, call {line}.', { line: t.emergency_line })}</span></div>
      )}
      <ol className="progress">
        {steps.map((s, i) => (
          <li key={i} className={s.ok ? 'ok' : ''}>
            <span className="pdot">{s.ok ? <Icon name="check" size={14} /> : i + 1}</span>
            <span>{s.label}{s.ok && s.at && <span className="muted small"> · {new Date(s.at).toLocaleString()}</span>}</span>
          </li>
        ))}
      </ol>
      {!t.responded_at && due && <p className="lead">{tr('First response expected by')} <b>{due.toLocaleString()}</b>.</p>}
      {t.procedure && <Stages p={t.procedure} agencyId={t.agency_id} lang={lang} tr={tr} />}
      {t.reply && (
        <div className="reply-box">
          <p className="muted small">{tr('Reply from {agency}', { agency: t.agency })}</p>
          <pre className="draft">{t.reply}</pre>
        </div>
      )}
      <div className="actions">
        <Link className="btn tonal" href="/report">{tr('Send another report')}</Link>
      </div>
    </section>
  )
}

/** The agency procedure for this report: stages done, the current one, and what comes after. */
function Stages({ p, agencyId, lang, tr }: { p: NonNullable<Tracked['procedure']>; agencyId: string; lang: string; tr: ReturnType<typeof useLang>['t'] }) {
  const next = p.stages.findIndex((_, i) => !p.done.includes(i))
  return (
    <div className="track-proc">
      <h2>{procTitle(p, lang)}</h2>
      <p className="muted small">{tr('{done} of {n} stages done', { done: p.done.length, n: p.stages.length })} · <Link href={`/a/${agencyId}/guide#${p.id}`}>{tr('About this procedure')}</Link></p>
      <ol className="proc-stages">
        {p.stages.map((s, i) => (
          <li key={i} className={p.done.includes(i) ? 'done' : i === next ? 'now' : ''} aria-current={i === next ? 'step' : undefined}>
            <span className="pdot">{p.done.includes(i) ? <Icon name="check" size={12} /> : i + 1}</span>{stageTitle(s, lang)}
          </li>
        ))}
      </ol>
    </div>
  )
}
