'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api, type Row } from '../api'
import { CHANNEL_ICON, Icon, UrgencyBadge, ago, slaLeft } from '../ui'
import { useStaff } from './StaffProvider'

const FILTERS = [
  { id: 'mine', label: 'My cases', icon: 'user' },
  { id: 'escalated', label: 'Escalated', icon: 'alert' },
  { id: 'manual_review', label: 'Manual review', icon: 'eye' },
  { id: 'assigned', label: 'Assigned', icon: 'inbox' },
  { id: 'in_progress', label: 'In progress', icon: 'clock' },
  { id: 'resolved', label: 'Resolved', icon: 'check' },
  { id: '', label: 'All', icon: 'rules' },
]
const URG_RANK = { critical: 0, high: 1, normal: 2, low: 3 }

export default function Inbox() {
  const { agency, me } = useStaff()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(() => api.tickets(agency.id).then(setRows), [agency.id])
  useEffect(() => {
    setRows(null)
    load()
  }, [load])
  useEffect(() => setFilter(me.role === 'supervisor' ? 'escalated' : me.role === 'leader' ? '' : 'mine'), [me.id, me.role])

  const names = Object.fromEntries(agency.team.map((m) => [m.id, m.name]))
  const match = (r: Row, f: string) => (f === 'mine' ? r.assignee === me.id && r.status !== 'resolved' : !f || r.status === f)
  const all = rows ?? []
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, all.filter((r) => match(r, f.id)).length]))
  const q = query.trim().toLowerCase()
  const shown = all
    .filter((r) => match(r, filter) && (!q || `${r.id} ${r.summary}`.toLowerCase().includes(q)))
    .sort((a, b) =>
      filter === 'resolved' ? b.created_at.localeCompare(a.created_at) :
        (URG_RANK[a.urgency ?? 'low'] - URG_RANK[b.urgency ?? 'low']) || b.created_at.localeCompare(a.created_at))

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Inbox</h1>
          <p className="muted">{agency.name} · signed in as {me.name}, {me.title}</p>
        </div>
        <button className="ghost small" onClick={() => api.resetDemo(agency.id).then(load)} title="Restore the synthetic demo data">
          <Icon name="refresh" size={14} /> Reset demo data
        </button>
      </div>
      <div className="filters" role="tablist" aria-label="Case filters">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={`filter ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
            <Icon name={f.icon} size={16} /> {f.label}
            <b className={f.id === 'escalated' && counts[f.id] ? 'hot' : ''}>{counts[f.id]}</b>
          </button>
        ))}
        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cases" aria-label="Search cases" />
      </div>
      <section className="table card" aria-label="Cases">
        {rows === null && <div className="shimmer tall" />}
        {rows && shown.length === 0 && <p className="muted pad">No cases here.</p>}
        {shown.map((r) => {
          const sla = r.status === 'resolved' ? null : slaLeft(r.created_at, r.sla_hours)
          return (
            <Link key={r.id} href={`/staff/cases/${r.id}`} className="case-row">
              <UrgencyBadge u={r.urgency} />
              <div className="case-main">
                <p>{r.summary}</p>
                <span className="muted small"><code>{r.id}</code> · <Icon name={CHANNEL_ICON[r.channel]} size={12} /> {ago(r.created_at)} · {agency.queues[r.queue ?? ''] ?? '—'}</span>
              </div>
              <span className="case-pic"><span className="avatar" aria-hidden="true">{r.assignee ? names[r.assignee]?.[0] : '?'}</span>{r.assignee ? names[r.assignee] : 'Unassigned'}</span>
              {sla ? <span className={`sla ${sla.tone}`}>{r.sla_breached ? 'SLA breached' : sla.text}</span> : <span className="sla ok">Resolved</span>}
            </Link>
          )
        })}
      </section>
    </div>
  )
}
