'use client'

import { Avatar } from '../Avatar'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Brand, Footer } from '../Brand'
import { localize } from '@/lib/i18n'
import { LangSwitch, useLang, useT } from '../Lang'
import { Icon, ago } from '../ui'
import { StaffProvider, useStaff } from './StaffProvider'

const ROLES = [
  { id: 'leader', label: 'Head of office' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'officer', label: 'Caseworkers' },
]

type Role = 'leader' | 'supervisor' | 'officer'

/** What each role sees: caseworkers work their cases; the supervisor runs the desk and its setup (channels, AI,
 * settings); the head of office watches trends and the procedures, with no technical pages. */
const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: '/staff/insights', label: 'Insights', icon: 'chart', roles: ['leader'] },
  { href: '/staff/inbox', label: 'Inbox', icon: 'inbox', roles: ['leader', 'supervisor', 'officer'] },
  { href: '/staff/team', label: 'Team', icon: 'user', roles: ['leader', 'supervisor'] },
  { href: '/staff/knowledge', label: 'Knowledge base', icon: 'book', roles: ['leader', 'supervisor', 'officer'] },
  { href: '/staff/case-types', label: 'Case types', icon: 'rules', roles: ['leader', 'supervisor', 'officer'] },
  { href: '/staff/resources', label: 'Resources', icon: 'globe', roles: ['leader', 'supervisor', 'officer'] },
  { href: '/staff/integrations', label: 'Channels', icon: 'chat', roles: ['supervisor'] },
  { href: '/staff/ai', label: 'AI control', icon: 'shield', roles: ['supervisor'] },
  { href: '/staff/settings', label: 'Settings', icon: 'form', roles: ['supervisor'] },
]

export const HOME: Record<Role, string> = {
  leader: '/staff/insights',
  supervisor: '/staff/inbox',
  officer: '/staff/inbox',
}

function allowed(path: string, role: Role) {
  if (path.startsWith('/staff/cases')) return true
  const item = NAV.find((n) => path.startsWith(n.href))
  return !item || item.roles.includes(role)
}

export function StaffShell({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <StaffProvider fallback={<p className="muted pad">{t('Loading…')}</p>}>
      <Frame>{children}</Frame>
    </StaffProvider>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const t = useT()
  const { me, agency } = useStaff()
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
      <nav className="rail" aria-label={t('Staff workspace')}>
        {NAV.filter((n) => n.roles.includes(me.role)).map((n) => {
          const on = path.startsWith(n.href) || (n.href === '/staff/inbox' && path.startsWith('/staff/cases'))
          return (
            <Link key={n.href} href={n.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
              <span className="rail-ic">
                <Icon name={n.icon} size={20} />
              </span>
              <span>{t(n.label)}</span>
            </Link>
          )
        })}
        <Link href={`/report?agency=${agency.id}`} className="rail-out" title={t('Open the citizen report form')}>
          <span className="rail-ic">
            <Icon name="send" size={20} />
          </span>
          <span>{t('Citizen form')}</span>
        </Link>
      </nav>
      <main className="staff-main">{ok ? children : null}</main>
      <Footer />
    </div>
  )
}

function Pickers() {
  const { t, lang } = useLang()
  const { agency: raw, me, pickMe } = useStaff()
  const agency = localize(raw, lang)
  return (
    <div className="pickers">
      <Link href={`/a/${agency.id}`} className="agency-chip" title={`${agency.name} · ${t('agency home')}`}>
        <Icon name="building" size={16} /> <span>{agency.short_name}</span>
      </Link>
      <LangSwitch />
      <Bell />
      <label className="tenant persona" title={t('Demo sign-in: switch between team members')}>
        <Avatar agency={agency.id} id={me.id} name={me.name} />
        <select value={me.id} onChange={(e) => pickMe(e.target.value)} aria-label={t('Signed in as')}>
          {ROLES.map((r) => (
            <optgroup key={r.id} label={t(r.label)}>
              {agency.team
                .filter((m) => m.role === r.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  )
}

function Bell() {
  const t = useT()
  const { notes, me } = useStaff()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    addEventListener('click', close)
    return () => removeEventListener('click', close)
  }, [])
  return (
    <div className="bell" ref={ref}>
      <button
        className="icon-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('Notifications ({n})', { n: notes.length })}
      >
        <Icon name="bell" size={20} />
        {notes.length > 0 && <span className="bell-n">{notes.length}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <h3>{t('Notifications for {name}', { name: me.name.split(' ')[0] })}</h3>
          {notes.length === 0 && <p className="muted small">{t('Nothing new.')}</p>}
          {notes.slice(0, 8).map((n) => (
            <Link
              key={n.id ?? n.at + n.ticket_id}
              href={`/staff/cases/${n.ticket_id}`}
              className={`note ${n.kind}`}
              onClick={() => setOpen(false)}
            >
              <span>{n.text}</span>
              <small className="muted">
                {ago(n.at, t)} · {t('delivered via Pub/Sub')}
              </small>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
