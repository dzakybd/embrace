import { AgencyPicker } from '@/components/AgencyPicker'
import { Brand, Footer } from '@/components/Brand'
import { Icon } from '@/components/ui'

const STEPS = [
  { icon: 'chat', text: 'Citizens write in any language' },
  { icon: 'spark', text: 'Gemini agents read and route' },
  { icon: 'alert', text: 'Emergencies escalate at once' },
  { icon: 'check', text: 'Staff approve every reply' },
]

export default function Home() {
  return (
    <div className="public">
      <header className="top">
        <Brand sub="AI agents for social services desks" />
      </header>
      <main className="landing">
        <section className="hero">
          <h1>Every social complaint, read, routed and answered in minutes</h1>
          <ul className="steps-row" aria-label="How it works">
            {STEPS.map((s) => <li key={s.text}><span className="entry-ic small"><Icon name={s.icon} size={18} /></span>{s.text}</li>)}
          </ul>
        </section>
        <h2 className="pick-h">Choose an agency</h2>
        <AgencyPicker />
        <p className="muted small center">Demo: no passwords, synthetic data only.</p>
      </main>
      <Footer />
    </div>
  )
}
