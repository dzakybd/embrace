'use client'

import Link from 'next/link'
import { useState } from 'react'
import { api, type Agency } from './api'
import { Icon } from './ui'
import { useAgencies } from './useAgencies'

const TINTS = ['#146c2e', '#e8710a', '#8430ce', '#b3261e', '#00796b', '#0b57d0']

function tint(id: string) {
  let h = 0
  for (const ch of id) h = (h * 7 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

export function Monogram({ agency, size = 48 }: { agency: Pick<Agency, 'id' | 'short_name'>; size?: number }) {
  const letters = agency.short_name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <span className="monogram" style={{ width: size, height: size, background: tint(agency.id) }} aria-hidden="true">{letters || '?'}</span>
}

/** Main menu: every agency as a card that opens its home, plus creating a new one. */
export function AgencyPicker() {
  const { agencies, pick, reload } = useAgencies()
  const [confirm, setConfirm] = useState('')
  if (!agencies.length) return <div className="agency-grid"><div className="shimmer" style={{ height: 180 }} /><div className="shimmer" style={{ height: 180 }} /></div>
  const remove = async (id: string) => {
    await api.deleteAgency(id)
    setConfirm('')
    reload()
  }
  return (
    <section className="agency-grid" aria-label="Agencies">
      {agencies.map((a) => (
        <div key={a.id} className="agency-card">
          <Link href={`/a/${a.id}`} className="agency-card-link" onClick={() => pick(a.id)}>
            <Monogram agency={a} />
            <span className="muted small">{a.country}{a.custom ? ' · created here' : ''}</span>
            <b>{a.short_name}</b>
            <span className="muted clamp">{a.name}</span>
            <span className="chips">
              <span className="chip-s"><Icon name="rules" size={12} /> {Object.keys(a.queues).length} teams</span>
              <span className="chip-s"><Icon name="user" size={12} /> {a.team.length} staff</span>
              <span className="chip-s"><Icon name="book" size={12} /> {a.categories.length} topics</span>
            </span>
            <span className="go">Open <Icon name="send" size={14} /></span>
          </Link>
          {a.custom && (confirm === a.id
            ? <button className="ghost small danger card-del" onClick={() => remove(a.id)}>Delete with its cases?</button>
            : <button className="icon-btn card-del" aria-label={`Delete ${a.short_name}`} onClick={() => setConfirm(a.id)}><Icon name="close" size={16} /></button>)}
        </div>
      ))}
      <Link href="/agencies/new" className="agency-card agency-new">
        <span className="monogram add" aria-hidden="true"><Icon name="plus" size={24} /></span>
        <b>Create an agency</b>
        <span className="muted">Any country, any language. Start from a template or your own documents.</span>
      </Link>
    </section>
  )
}
