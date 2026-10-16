'use client'

import { useEffect, useState } from 'react'
import { api, type Agency } from './api'
import { startAnalytics } from './firebase'
import { Icon } from './ui'
import Intake from './views/Intake'
import Console from './views/Console'
import Dashboard from './views/Dashboard'

function useHash() {
  const [hash, setHash] = useState('#/intake')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/intake')
    on()
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

function stored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

const NAV = [
  { href: '#/intake', label: 'Report', sub: 'Citizen', icon: 'send' },
  { href: '#/console', label: 'Officer console', sub: 'Officer', icon: 'inbox' },
  { href: '#/dashboard', label: 'Insights', sub: 'Leadership', icon: 'chart' },
]

export default function App() {
  const hash = useHash()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [agencyId, setAgencyId] = useState('social_services')
  const [personas, setPersonas] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [track, setTrack] = useState<((name: string, params?: Record<string, string>) => void) | null>(null)

  useEffect(() => {
    setAgencyId(stored('agency', 'social_services'))
    api.agencies().then(setAgencies).catch((e) => setError(String(e)))
    startAnalytics().then((log) => log && setTrack(() => log)).catch(() => {})
  }, [])

  const [, view, param] = hash.split('/')
  useEffect(() => {
    track?.('screen_view', { screen_name: view, agency: agencyId })
  }, [track, view, agencyId])

  const pick = (id: string) => {
    setAgencyId(id)
    save('agency', id)
  }

  const agency = agencies.find((t) => t.id === agencyId) ?? agencies[0]
  // Demo sign-in: pick who you are on the agency's team (no passwords in the prototype).
  const supervisorId = agency?.team.find((m) => m.role === 'supervisor')?.id ?? ''
  const meId = agency ? personas[agency.id] ?? stored(`persona:${agency.id}`, supervisorId) : ''
  const me = agency?.team.find((m) => m.id === meId) ?? agency?.team[0]
  const setMe = (id: string) => {
    if (!agency) return
    setPersonas((p) => ({ ...p, [agency.id]: id }))
    save(`persona:${agency.id}`, id)
  }

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#/intake" aria-label="Embrace home">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--brand)" />
            <path d="M8 18c3 5 13 5 16 0M10 13a6 6 0 0 1 12 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <circle cx="16" cy="13" r="2.4" fill="var(--accent)" />
          </svg>
          <span>
            <b>Embrace</b>
            <small>AI agents for social services desks</small>
          </span>
        </a>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={hash.startsWith(n.href) ? 'on' : ''}
              aria-current={hash.startsWith(n.href) ? 'page' : undefined}>
              <Icon name={n.icon} /> <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="pickers">
          <label className="tenant">
            <span>Agency</span>
            <select value={agency?.id ?? ''} onChange={(e) => pick(e.target.value)}>
              {agencies.map((t) => (
                <option key={t.id} value={t.id}>{t.short_name}</option>
              ))}
            </select>
          </label>
          {agency && me && (
            <label className="tenant persona" title="Demo sign-in: switch between team members">
              <span className="avatar" aria-hidden="true">{me.name[0]}</span>
              <select value={me.id} onChange={(e) => setMe(e.target.value)} aria-label="Signed in as">
                {agency.team.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} · {m.title}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>
      <main>
        {error && <p className="error">Could not reach the API: {error}</p>}
        {agency && view === 'intake' && <Intake agency={agency} />}
        {agency && me && view === 'console' && <Console key={`${agency.id}-${me.id}`} agency={agency} me={me} selected={param} />}
        {agency && view === 'dashboard' && <Dashboard agency={agency} />}
      </main>
      <footer className="foot">
        Embrace prototype for AI Builder Cup · synthetic data only · Google ADK + Gemini on Firebase App Hosting (Cloud Run) + Firestore
      </footer>
    </div>
  )
}
