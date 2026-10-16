'use client'

import { useEffect, useState } from 'react'
import { api, type Row } from '../api'
import { Card } from '../ui'
import { useStaff } from './StaffProvider'

export default function Team() {
  const { agency, me, pickMe } = useStaff()
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    api.tickets(agency.id).then(setRows)
  }, [agency.id])
  const open = rows.filter((r) => r.status !== 'resolved')

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Team</h1>
          <p className="muted">Who handles what at {agency.name}. New cases go to the person in charge of their queue; escalations also alert the supervisor.</p>
        </div>
      </div>
      <div className="team-grid">
        {agency.team.map((m) => {
          const mine = open.filter((r) => r.assignee === m.id)
          const urgent = mine.filter((r) => r.urgency === 'critical' || r.urgency === 'high').length
          const late = mine.filter((r) => r.sla_breached).length
          return (
            <Card key={m.id} className={`member ${m.id === me.id ? 'me' : ''}`}>
              <div className="pic-row">
                <span className="avatar big" aria-hidden="true">{m.name[0]}</span>
                <div>
                  <b>{m.name}</b>{m.id === me.id && <span className="tag you">you</span>}
                  <div className="muted small">{m.title}{m.role === 'supervisor' ? ' · receives escalations' : ''}</div>
                </div>
              </div>
              <div className="tags">
                {m.queues.map((q) => <span key={q} className="tag">{agency.queues[q]}</span>)}
              </div>
              <ul className="statlist compact">
                <li><span>Open cases</span><b>{mine.length}</b></li>
                <li><span>High or critical</span><b>{urgent}</b></li>
                <li><span>Past SLA</span><b>{late}</b></li>
              </ul>
              {m.id !== me.id && <button className="ghost small" onClick={() => pickMe(m.id)}>Sign in as {m.name.split(' ')[0]}</button>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
