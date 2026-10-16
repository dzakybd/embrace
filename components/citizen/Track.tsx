'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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
}

export default function Track({ id }: { id: string }) {
  const [t, setT] = useState<Tracked | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    const load = () => fetch(`/api/track/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setT).catch(() => setMissing(true))
    load()
    const timer = setInterval(load, 15_000)
    return () => clearInterval(timer)
  }, [id])

  if (missing) return <section className="card citizen-card"><h1>Report not found</h1><p className="muted">Check the report number {id}.</p><Link className="btn" href="/report">Send a report</Link></section>
  if (!t) return <section className="card citizen-card"><div className="shimmer tall" /></section>

  const due = t.sla_hours ? new Date(Date.parse(t.created_at) + t.sla_hours * 3600_000) : null
  const steps = [
    { label: 'Received', at: t.created_at, ok: true },
    { label: t.team ? `With the ${t.team}` : 'Being reviewed', at: t.created_at, ok: !!t.team },
    { label: 'Reply sent', at: t.responded_at, ok: !!t.responded_at },
    { label: 'Resolved', at: t.resolved_at, ok: !!t.resolved_at },
  ]
  return (
    <section className="card citizen-card">
      <p className="muted small">{t.agency}</p>
      <h1>Report {t.id}</h1>
      {t.escalated && !t.resolved_at && (
        <div className="banner crit"><Icon name="alert" /><span>Marked urgent: a supervisor has been alerted. If anyone is in danger right now, call {t.emergency_line}.</span></div>
      )}
      <ol className="progress">
        {steps.map((s, i) => (
          <li key={i} className={s.ok ? 'ok' : ''}>
            <span className="pdot">{s.ok ? <Icon name="check" size={14} /> : i + 1}</span>
            <span>{s.label}{s.ok && s.at && <span className="muted small"> · {new Date(s.at).toLocaleString()}</span>}</span>
          </li>
        ))}
      </ol>
      {!t.responded_at && due && <p className="lead">First response expected by <b>{due.toLocaleString()}</b>.</p>}
      {t.reply && (
        <div className="reply-box">
          <p className="muted small">Reply from {t.agency}</p>
          <pre className="draft">{t.reply}</pre>
        </div>
      )}
      <div className="actions">
        <Link className="btn tonal" href="/report">Send another report</Link>
      </div>
    </section>
  )
}
