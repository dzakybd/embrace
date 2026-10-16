'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Brand, Footer } from '../Brand'
import { Icon, ago } from '../ui'
import { StaffProvider, useStaff } from './StaffProvider'

const NAV = [
  { href: '/staff/inbox', label: 'Inbox', icon: 'inbox' },
  { href: '/staff/insights', label: 'Insights', icon: 'chart' },
  { href: '/staff/knowledge', label: 'Knowledge', icon: 'book' },
  { href: '/staff/team', label: 'Team', icon: 'user' },
]

export function StaffShell({ children }: { children: ReactNode }) {
  return (
    <StaffProvider fallback={<p className="muted pad">Loading…</p>}>
      <Frame>{children}</Frame>
    </StaffProvider>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname()
  return (
    <div className="staff">
      <header className="top">
        <Brand sub="Staff workspace" href="/staff/inbox" />
        <Pickers />
      </header>
      <nav className="rail" aria-label="Staff">
        {NAV.map((n) => {
          const on = path.startsWith(n.href) || (n.href === '/staff/inbox' && path.startsWith('/staff/cases'))
          return (
            <Link key={n.href} href={n.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
              <span className="rail-ic"><Icon name={n.icon} size={20} /></span>
              <span>{n.label}</span>
            </Link>
          )
        })}
        <Link href="/report" className="rail-out" title="Open the citizen report form">
          <span className="rail-ic"><Icon name="send" size={20} /></span>
          <span>Citizen form</span>
        </Link>
      </nav>
      <main className="staff-main">{children}</main>
      <Footer />
    </div>
  )
}

function Pickers() {
  const { agencies, agency, me, pickAgency, pickMe } = useStaff()
  return (
    <div className="pickers">
      <label className="tenant">
        <span>Agency</span>
        <select value={agency.id} onChange={(e) => pickAgency(e.target.value)}>
          {agencies.map((a) => <option key={a.id} value={a.id}>{a.short_name}</option>)}
        </select>
      </label>
      <Bell />
      <label className="tenant persona" title="Demo sign-in: switch between team members">
        <span className="avatar" aria-hidden="true">{me.name[0]}</span>
        <select value={me.id} onChange={(e) => pickMe(e.target.value)} aria-label="Signed in as">
          {agency.team.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
        </select>
      </label>
    </div>
  )
}

function Bell() {
  const { notes, me } = useStaff()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    addEventListener('click', close)
    return () => removeEventListener('click', close)
  }, [])
  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Notifications (${notes.length})`}>
        <Icon name="bell" size={20} />
        {notes.length > 0 && <span className="bell-n">{notes.length}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <h3>Notifications for {me.name.split(' ')[0]}</h3>
          {notes.length === 0 && <p className="muted small">Nothing new.</p>}
          {notes.slice(0, 8).map((n) => (
            <Link key={n.id ?? n.at + n.ticket_id} href={`/staff/cases/${n.ticket_id}`} className={`note ${n.kind}`} onClick={() => setOpen(false)}>
              <span>{n.text}</span>
              <small className="muted">{ago(n.at)} · delivered via Pub/Sub</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
