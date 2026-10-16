import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import { Icon } from '@/components/ui'

const STEPS = [
  { icon: 'chat', title: 'Any channel, any language', body: 'Web, WhatsApp, email, social media, voice notes and photos. Personal data is masked on arrival.' },
  { icon: 'alert', title: 'Urgent cases first', body: 'Gemini agents judge urgency; the agency’s own rules decide escalation and alert the supervisor in seconds.' },
  { icon: 'user', title: 'A person in charge', body: 'Every case goes to the right officer, who can delegate with a handover note.' },
  { icon: 'book', title: 'Replies that cite the SOP', body: 'A draft in the citizen’s language, citing the agency’s procedures. An officer approves every reply.' },
]

export default function Home() {
  return (
    <div className="public">
      <header className="top">
        <Brand sub="AI agents for social services desks" />
        <nav className="top-links" aria-label="Main">
          <Link href="/report">Report a problem</Link>
          <Link href="/staff/inbox" className="btn">Staff workspace</Link>
        </nav>
      </header>
      <main className="landing">
        <section className="hero">
          <h1>Every report read, routed and answered, in the citizen’s own language</h1>
          <p className="lead">
            Embrace is an open-source team of AI agents for social services desks: social aid, disability and elderly care,
            homelessness, disaster relief, violence and child protection. It gives each case a person in charge and puts emergencies in front of a supervisor in seconds.
          </p>
          <div className="entry">
            <Link href="/report" className="entry-card">
              <span className="entry-ic"><Icon name="send" size={24} /></span>
              <b>Report a problem</b>
              <span className="muted">For citizens. Write, record a voice note or add a photo, in any language.</span>
            </Link>
            <Link href="/staff/inbox" className="entry-card alt">
              <span className="entry-ic"><Icon name="inbox" size={24} /></span>
              <b>Staff workspace</b>
              <span className="muted">For officers, supervisors and leaders. Demo sign-in as any team member.</span>
            </Link>
          </div>
        </section>
        <section className="how" aria-label="How it works">
          {STEPS.map((s) => (
            <div key={s.title} className="how-item">
              <span className="entry-ic small"><Icon name={s.icon} size={20} /></span>
              <b>{s.title}</b>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </section>
        <p className="muted small center">Prototype with synthetic data. Built with Google ADK and Gemini on Firebase App Hosting, Firestore, Pub/Sub and Cloud Functions.</p>
      </main>
      <Footer />
    </div>
  )
}
