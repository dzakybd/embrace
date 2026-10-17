import Link from 'next/link'
import { AgencyPicker } from '@/components/AgencyPicker'
import { Brand, Footer } from '@/components/Brand'
import { Icon, TELEGRAM_URL } from '@/components/ui'

const ROLES = [
  { href: '/report', icon: 'send', title: 'I need help', who: 'Citizen', body: 'Report a problem in your own words and language: chat with us on Telegram, or use the web form. Voice notes and photos welcome.', main: true },
  { href: '/staff/inbox?as=officer', icon: 'inbox', title: 'Handle my cases', who: 'Caseworker (person in charge)', body: 'Your cases and your team’s queue, AI-drafted replies citing the agency’s documents, delegation and notifications.' },
  { href: '/staff/inbox?as=supervisor', icon: 'alert', title: 'Watch escalations', who: 'Duty supervisor', body: 'Emergencies first: the escalation inbox, alerts delivered in seconds, delegate cases to caseworkers.' },
  { href: '/staff/insights?as=leader', icon: 'chart', title: 'See the big picture', who: 'Head of office', body: 'KPIs, an AI weekly brief, early warnings when reports cluster, and an analyst to ask.' },
]

export default function Home() {
  return (
    <div className="public">
      <header className="top">
        <Brand sub="The AI front door for social complaints" />
      </header>
      <main className="landing">
        <section className="hero">
          <h1>Any social complaint, read, routed and answered within minutes</h1>
          <p className="lead">
            Embrace is an open-source team of AI agents for any social services complaint desk: social aid, disability and
            elderly care, homelessness, disaster relief, violence and child protection. The demo runs two Indonesian desks,
            the Demak Regency Social Affairs Office and the Indonesian Child Protection Commission (KPAI), with their own
            units, service flows and regulations; any agency, in any country and language, can be added from the main menu.
          </p>
        </section>
        <AgencyPicker />
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
        <p className="muted small center">Demo: no passwords. Staff can switch account from the top bar; each role sees its own menu. Synthetic data only. Built with Google ADK and Gemini on Firebase App Hosting, Firestore, Pub/Sub and Cloud Functions.</p>
      </main>
      <Footer />
    </div>
  )
}
