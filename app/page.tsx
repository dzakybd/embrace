import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import { Icon, TELEGRAM_URL } from '@/components/ui'

const ROLES = [
  { href: '/report', icon: 'send', title: 'I need help', who: 'Citizen', body: 'Report a problem in your own words and language: chat with us on Telegram, or use the web form. Voice notes and photos welcome.', main: true },
  { href: '/staff/inbox?as=officer', icon: 'inbox', title: 'Handle my cases', who: 'Officer (person in charge)', body: 'Cases assigned to you, AI-drafted replies citing the SOP, delegation and notifications.' },
  { href: '/staff/inbox?as=supervisor', icon: 'alert', title: 'Watch escalations', who: 'On-call supervisor', body: 'Emergencies first: the escalation inbox, alerts delivered in seconds, assign and reassign.' },
  { href: '/staff/insights?as=leader', icon: 'chart', title: 'See the big picture', who: 'Head of office', body: 'KPIs, an AI weekly brief, early warnings when reports cluster, and an analyst to ask.' },
]

export default function Home() {
  return (
    <div className="public">
      <header className="top">
        <Brand sub="AI agents for social services desks" />
      </header>
      <main className="landing">
        <section className="hero">
          <h1>Every report read, routed and answered, in the citizen’s own language</h1>
          <p className="lead">
            Embrace is an open-source team of AI agents for social services desks: social aid, disability and elderly care,
            homelessness, disaster relief, violence and child protection.
          </p>
        </section>
        <h2 className="pick-h">Who are you?</h2>
        <section className="roles" aria-label="Choose your role">
          {ROLES.map((r) => r.main ? (
            <div key={r.href} className="role-card main">
              <span className="entry-ic"><Icon name={r.icon} size={24} /></span>
              <span className="muted small">{r.who}</span>
              <b>{r.title}</b>
              <span className="muted">{r.body}</span>
              <div className="role-actions">
                <a className="btn light" href={TELEGRAM_URL} target="_blank" rel="noreferrer">Chat on Telegram</a>
                <Link className="go" href={r.href}>Use the web form <Icon name="send" size={14} /></Link>
              </div>
            </div>
          ) : (
            <Link key={r.href} href={r.href} className="role-card">
              <span className="entry-ic"><Icon name={r.icon} size={24} /></span>
              <span className="muted small">{r.who}</span>
              <b>{r.title}</b>
              <span className="muted">{r.body}</span>
              <span className="go">Continue <Icon name="send" size={14} /></span>
            </Link>
          ))}
        </section>
        <p className="muted small center">Demo: no passwords. Staff can switch role or person any time from the top bar. Synthetic data only. Built with Google ADK and Gemini on Firebase App Hosting, Firestore, Pub/Sub and Cloud Functions.</p>
      </main>
      <Footer />
    </div>
  )
}
