'use client'

import { useEffect, useState } from 'react'
import { api, type Row } from '../api'
import { Card } from '../ui'
import { useT } from '../Lang'
import { Avatar } from '../Avatar'
import { useStaff } from './StaffProvider'

export default function Team() {
  const t = useT()
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
          <h1>{t('Team')}</h1>
          <p className="muted">{t('Who handles what. New cases go to the person in charge of their team; escalations also alert the supervisor.')}</p>
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
                <Avatar agency={agency.id} id={m.id} name={m.name} big />
                <div>
                  <b>{m.name}</b>{m.id === me.id && <span className="tag you">{t('you')}</span>}
                  <div className="muted small">{m.title}{m.role === 'supervisor' ? ` · ${t('receives escalations')}` : m.role === 'leader' ? ` · ${t('sees Insights')}` : ''}</div>
                </div>
              </div>
              <div className="tags">
                {m.queues.map((q) => <span key={q} className="tag">{agency.queues[q]}</span>)}
              </div>
              <ul className="statlist compact">
                <li><span>{t('Open cases')}</span><b>{mine.length}</b></li>
                <li><span>{t('High or critical')}</span><b>{urgent}</b></li>
                <li><span>{t('Past SLA')}</span><b>{late}</b></li>
              </ul>
              {m.id !== me.id && <button className="ghost small" onClick={() => pickMe(m.id)}>{t('Sign in as {name}', { name: m.name.split(' ')[0] })}</button>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
