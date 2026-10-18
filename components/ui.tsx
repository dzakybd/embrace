import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { SiGmail, SiInstagram, SiTelegram, SiThreads, SiWhatsapp } from 'react-icons/si'
import type { T } from '@/lib/i18n'
import type { Status, Urgency } from './api'
import { useT } from './Lang'

const PATHS: Record<string, string> = {
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  alert: 'M12 3 2 20h20L12 3zm0 6v5m0 3v.5',
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7H2',
  send: 'M3 11 21 3l-8 18-2-8-8-2z',
  check: 'M4 12l5 5L20 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v5l3 2',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  chat: 'M4 5h16v11H9l-5 4z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  form: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  rules: 'M5 4h14v4H5zM5 10h14v4H5zM5 16h14v4H5z',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9.5a1.5 1.5 0 1 0 0-.01',
  stop: 'M6 6h12v12H6z',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 18l-6-6 6-6',
  home: 'M3 11l9-8 9 8v10H3z',
  plus: 'M12 5v14M5 12h14',
  building: 'M4 21V5l8-3 8 3v16M9 9h1m4 0h1M9 13h1m4 0h1M10 21v-4h4v4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
}

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      <path d={PATHS[name] ?? PATHS.spark} />
    </svg>
  )
}

export const URGENCY_LABEL: Record<Urgency, string> = { critical: 'Critical', high: 'High', normal: 'Normal', low: 'Low' }
const URGENCY_ICON: Record<Urgency, string> = { critical: 'alert', high: 'alert', normal: 'clock', low: 'check' }

export function UrgencyBadge({ u }: { u: Urgency | null | undefined }) {
  const t = useT()
  if (!u) return <span className="badge">—</span>
  return (
    <span className={`badge urg-${u}`}>
      <Icon name={URGENCY_ICON[u]} size={12} /> {t(URGENCY_LABEL[u])}
    </span>
  )
}

export const STATUS_LABEL: Record<Status, string> = {
  received: 'Received',
  escalated: 'Escalated',
  manual_review: 'Manual review',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
}

export function StatusBadge({ s }: { s: Status }) {
  const t = useT()
  return <span className={`status st-${s}`}>{t(STATUS_LABEL[s])}</span>
}

export const CHANNEL_LABEL: Record<string, string> = { web: 'Web form', whatsapp: 'WhatsApp', email: 'Email', social: 'Social media', telegram: 'Telegram' }

/** Brand marks in brand colours for messaging channels; the web form and generic social media use the app's own icons. */
const BRANDS: Record<string, [IconType, string]> = {
  whatsapp: [SiWhatsapp, '#25D366'],
  telegram: [SiTelegram, '#26A5E4'],
  email: [SiGmail, '#EA4335'],
  instagram: [SiInstagram, '#E4405F'],
  threads: [SiThreads, '#000000'],
}

export function ChannelIcon({ c, size = 16 }: { c: string; size?: number }) {
  const b = BRANDS[c]
  if (!b) return <Icon name={c === 'web' ? 'form' : 'globe'} size={size} />
  const [Mark, color] = b
  return <Mark size={size} color={color} aria-hidden="true" className="icon" />
}

/** The citizen chat channel (Telegram bot). */
/** Link to an agency's Telegram bot, if it has one. */
export const telegramUrl = (bot?: string | null) => (bot ? `https://t.me/${bot}` : null)

export const AGENT_META: Record<string, { label: string; role: string }> = {
  media_reader: { label: 'Media agent', role: 'Transcribes voice notes, reads photos' },
  intake_agent: { label: 'Intake agent', role: 'Language, entities, personal-data masking' },
  triage_agent: { label: 'Triage agent', role: 'Category, urgency, sentiment, safety flags' },
  policy_agent: { label: 'Policy rules', role: 'Deterministic escalation & routing' },
  sop_agent: { label: 'SOP lookup', role: 'Finds the agency’s procedure, no AI tokens' },
  drafter_agent: { label: 'Reply drafter', role: 'Reply in the citizen’s language, for approval' },
  analyst_agent: { label: 'Analyst agent', role: 'Insights, weekly brief, questions' },
}

export function Citations({ items }: { items: { n?: number; doc: string; title: string; url: string; loc: string; text: string }[] }) {
  const t = useT()
  if (!items.length) return <p className="muted small">{t('No matching SOP passage: the caseworker confirms the procedure.')}</p>
  return (
    <ol className="cites">
      {items.map((c, i) => (
        <li key={`${c.doc}-${c.loc}-${i}`}>
          <span className="cite-n">[{c.n ?? i + 1}]</span>
          <div>
            <a href={c.url} target="_blank" rel="noreferrer" title={c.title}><b>{c.doc}</b>, {c.loc}</a>
            <p>{c.text.slice(0, 260)}{c.text.length > 260 ? '…' : ''}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Card({ title, icon, action, children, className = '' }: {
  title?: ReactNode; icon?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-h">
          <h2>{icon && <Icon name={icon} />} {title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

const same: T = (s, vars) => Object.entries(vars ?? {}).reduce((o, [k, v]) => o.replaceAll(`{${k}}`, String(v)), s)

export function ago(iso: string, t: T = same): string {
  const m = (Date.now() - new Date(iso).getTime()) / 60000
  if (m < 1) return t('just now')
  if (m < 60) return t('{n} min ago', { n: Math.round(m) })
  if (m < 48 * 60) return t('{n} h ago', { n: Math.round(m / 60) })
  return t('{n} d ago', { n: Math.round(m / 1440) })
}

export function slaLeft(created: string, slaHours: number | null | undefined, responded?: string | null, t: T = same) {
  if (!slaHours) return null
  if (responded) return { text: t('Responded'), tone: 'ok' as const }
  const left = slaHours * 3600_000 - (Date.now() - new Date(created).getTime())
  const h = Math.abs(left) / 3600_000
  const txt = h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`
  return left < 0 ? { text: t('SLA breached {d}', { d: txt }), tone: 'bad' as const } : { text: t('{d} left', { d: txt }), tone: h < 1 ? ('warn' as const) : ('ok' as const) }
}
