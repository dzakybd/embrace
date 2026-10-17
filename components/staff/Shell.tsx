'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Brand, Footer } from '../Brand'
import { Icon, ago } from '../ui'
import { StaffProvider, useStaff } from './StaffProvider'

const ROLES = [
  { id: 'leader', label: 'Head of office' },
  { id: 'supervisor', label: 'Duty supervisor' },
  { id: 'officer', label: 'Caseworkers' },
]

type Role = 'leader' | 'supervisor' | 'officer'

/** What each role sees: caseworkers work their cases, the duty supervisor runs the desk, the head of office watches trends. */
const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: '/staff/insights', label: 'Insights', icon: 'chart', roles: ['leader'] },
  { href: '/staff/inbox', label: 'Inbox', icon: 'inbox', roles: ['leader', 'supervisor', 'officer'] },
  { href: '/staff/team', label: 'Team', icon: 'user', roles: ['leader', 'supervisor'] },
  { href: '/staff/knowledge', label: 'Knowledge', icon: 'book', roles: ['leader', 'supervisor', 'officer'] },
]

export const HOME: Record<Role, string> = { leader: '/staff/insights', supervisor: '/staff/inbox', officer: '/staff/inbox' }

function allowed(path: string, role: Role) {
  if (path.startsWith('/staff/cases')) return true
  const item = NAV.find((n) => path.startsWith(n.href))
  return !item || item.roles.includes(role)
}

export function StaffShell({ children }: { children: ReactNode }) {
  return (
    <StaffProvider fallback={<p className="muted pad">Loading…</p>}>
      <Frame>{children}</Frame>
    </StaffProvider>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { me } = useStaff()
  const ok = allowed(path, me.role)
  // Switching to an account without access to this page sends it to its own start page.
  useEffect(() => {
    if (!ok) router.replace(HOME[me.role])
  }, [ok, me.role, router])
  return (
    <div className="staff">
      <header className="top">
        <Brand sub="Staff workspace" href="/" />
        <Pickers />
      </header>
      <nav className="rail" aria-label="Staff">
        {NAV.filter((n) => n.roles.includes(me.role)).map((n) => {
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
      <main className="staff-main">{ok ? children : null}</main>
      <Footer />
    </div>
  )
}

function Pickers() {
  const { agency, me, pickMe } = useStaff()
  return (
    <div className="pickers">
      <Link href="/" className="agency-chip" title={`${agency.name} · change agency on the main menu`}>
        <Icon name="building" size={16} /> <span>{agency.short_name}</span>
      </Link>
      <Bell />
      <label className="tenant persona" title="Demo sign-in: switch between team members">
        <span className="avatar" aria-hidden="true">{me.name[0]}</span>
        <select value={me.id} onChange={(e) => pickMe(e.target.value)} aria-label="Signed in as">
          {ROLES.map((r) => (
            <optgroup key={r.id} label={r.label}>
              {agency.team.filter((m) => m.role === r.id).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
            </optgroup>
          ))}
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
