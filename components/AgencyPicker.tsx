'use client'

import Link from 'next/link'
import { useState } from 'react'
import { api } from './api'
import { Icon } from './ui'
import { useAgencies } from './useAgencies'

/** Main-menu agency choice: which office you work for or report to, plus creating a new one. */
export function AgencyPicker() {
  const { agencies, agency, pick, reload } = useAgencies()
  const [confirm, setConfirm] = useState(false)
  if (!agency) return <div className="shimmer" style={{ height: 120 }} />
  const remove = async () => {
    await api.deleteAgency(agency.id)
    setConfirm(false)
    pick(agencies.find((a) => a.id !== agency.id)?.id ?? '')
    reload()
  }
  return (
    <section className="agency-pick card" aria-labelledby="agency-h">
      <div className="agency-pick-main">
        <h2 id="agency-h">Agency</h2>
        <select value={agency.id} onChange={(e) => { pick(e.target.value); setConfirm(false) }} aria-label="Agency">
          {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}{a.custom ? ' · created here' : ''}</option>)}
        </select>
        <p className="muted small">
          {agency.description || `${agency.country} · ${agency.categories.length} categories`} · {agency.team.length} staff · {Object.keys(agency.queues).length} teams
        </p>
      </div>
      <div className="agency-pick-actions">
        <Link className="btn" href="/agencies/new"><Icon name="plus" size={16} /> Create a new agency</Link>
        {agency.custom && (confirm
          ? <button className="ghost small danger" onClick={remove}>Delete {agency.short_name} and its cases</button>
          : <button className="ghost small" onClick={() => setConfirm(true)}>Delete</button>)}
      </div>
    </section>
  )
}
