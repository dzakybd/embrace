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

function stored(): string {
  try {
    return localStorage.getItem('agency') || 'child_protection'
  } catch {
    return 'child_protection'
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
  const [agencyId, setAgencyId] = useState('child_protection')
  const [error, setError] = useState('')
  const [track, setTrack] = useState<((name: string, params?: Record<string, string>) => void) | null>(null)

  useEffect(() => {
    setAgencyId(stored())
    api.agencies().then(setAgencies).catch((e) => setError(String(e)))
    startAnalytics().then((log) => log && setTrack(() => log)).catch(() => {})
  }, [])

  const [, view, param] = hash.split('/')
  useEffect(() => {
    track?.('screen_view', { screen_name: view, agency: agencyId })
  }, [track, view, agencyId])

  const pick = (id: string) => {
    setAgencyId(id)
    try {
      localStorage.setItem('agency', id)
    } catch {
      /* private mode */
    }
  }

  const agency = agencies.find((t) => t.id === agencyId) ?? agencies[0]

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
            <small>AI agents for public complaint desks</small>
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
        <label className="tenant">
          <span>Agency</span>
          <select value={agency?.id ?? ''} onChange={(e) => pick(e.target.value)}>
            {agencies.map((t) => (
              <option key={t.id} value={t.id}>{t.short_name}</option>
            ))}
          </select>
        </label>
      </header>
      <main>
        {error && <p className="error">Could not reach the API: {error}</p>}
        {agency && view === 'intake' && <Intake agency={agency} />}
        {agency && view === 'console' && <Console agency={agency} selected={param} />}
        {agency && view === 'dashboard' && <Dashboard agency={agency} />}
      </main>
      <footer className="foot">
        Embrace prototype for AI Builder Cup · synthetic data only · Google ADK + Gemini on Firebase App Hosting (Cloud Run) + Firestore
      </footer>
    </div>
  )
}
