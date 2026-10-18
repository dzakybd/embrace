'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api, type Row } from '../api'
import { Avatar, ChannelIcon, Icon, UrgencyBadge, ago, slaLeft } from '../ui'
import { useT } from '../Lang'
import { useStaff } from './StaffProvider'

const FILTERS = [
  { id: 'mine', label: 'My cases', icon: 'user' },
  { id: 'team', label: 'My team', icon: 'inbox' },
  { id: 'escalated', label: 'Escalated', icon: 'alert' },
  { id: 'manual_review', label: 'Manual review', icon: 'eye' },
  { id: 'assigned', label: 'Assigned', icon: 'inbox' },
  { id: 'in_progress', label: 'In progress', icon: 'clock' },
  { id: 'resolved', label: 'Resolved', icon: 'check' },
  { id: '', label: 'All', icon: 'rules' },
]
// Caseworkers see their own cases and their team's queue; the supervisor and the head see the whole desk.
const ROLE_FILTERS = {
  officer: ['mine', 'team', 'resolved'],
  supervisor: ['escalated', 'manual_review', 'assigned', 'in_progress', 'resolved', ''],
  leader: ['', 'escalated', 'in_progress', 'resolved'],
}
const URG_RANK = { critical: 0, high: 1, normal: 2, low: 3 }

export default function Inbox() {
  const t = useT()
  const { agency, me } = useStaff()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(() => api.tickets(agency.id).then(setRows), [agency.id])
  useEffect(() => {
    setRows(null)
    load()
  }, [load])
  useEffect(() => setFilter(ROLE_FILTERS[me.role][0]), [me.id, me.role])

  const names = Object.fromEntries(agency.team.map((m) => [m.id, m.name]))
  const filters = ROLE_FILTERS[me.role].map((id) => FILTERS.find((f) => f.id === id)!)
  const mineOrTeam = (r: Row) => r.assignee === me.id || me.queues.includes(r.queue ?? '')
  const match = (r: Row, f: string) =>
    f === 'mine' ? r.assignee === me.id && r.status !== 'resolved'
      : f === 'team' ? me.queues.includes(r.queue ?? '') && r.status !== 'resolved'
        : me.role === 'officer' && f === 'resolved' ? mineOrTeam(r) && r.status === 'resolved'
          : !f || r.status === f
  const all = rows ?? []
  const counts = Object.fromEntries(filters.map((f) => [f.id, all.filter((r) => match(r, f.id)).length]))
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
          <h1>{t('Inbox')}</h1>
          <p className="muted">{t('Signed in as {name}, {title}', { name: me.name, title: me.title })}</p>
        </div>
        <button className="ghost small" onClick={() => api.resetDemo(agency.id).then(load)} title={t('Restore the synthetic demo data')}>
          <Icon name="refresh" size={14} /> {t('Reset demo data')}
        </button>
      </div>
      <div className="filters" role="tablist" aria-label={t('Case filters')}>
        {filters.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={`filter ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
            <Icon name={f.icon} size={16} /> {t(f.label)}
            <b className={f.id === 'escalated' && counts[f.id] ? 'hot' : ''}>{counts[f.id]}</b>
          </button>
        ))}
        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search cases')} aria-label={t('Search cases')} />
      </div>
      <section className="table card" aria-label={t('Cases')}>
        {rows === null && <div className="shimmer tall" />}
        {rows && shown.length === 0 && <p className="muted pad">{t('No cases here.')}</p>}
        {shown.map((r) => {
          const sla = r.status === 'resolved' ? null : slaLeft(r.created_at, r.sla_hours, null, t)
          return (
            <Link key={r.id} href={`/staff/cases/${r.id}`} className="case-row">
              <UrgencyBadge u={r.urgency} />
              <div className="case-main">
                <p>{r.summary}</p>
                <span className="muted small"><code>{r.id}</code> · <ChannelIcon c={r.channel} size={12} /> {ago(r.created_at, t)} · {agency.queues[r.queue ?? ''] ?? '—'}</span>
              </div>
              <span className="case-pic"><Avatar agency={agency.id} id={r.assignee} name={r.assignee ? names[r.assignee] : undefined} />{r.assignee ? names[r.assignee] : t('Unassigned')}</span>
              {sla ? <span className={`sla ${sla.tone}`}>{r.sla_breached ? t('SLA breached') : sla.text}</span> : <span className="sla ok">{t('Resolved')}</span>}
            </Link>
          )
        })}
      </section>
    </div>
  )
}
