import { AgencyPicker } from '@/components/AgencyPicker'
import { Brand, Footer } from '@/components/Brand'
import { LangSwitch } from '@/components/Lang'
import { Icon } from '@/components/ui'
import { getT } from '@/lib/i18n-server'

const STEPS = [
  { icon: 'chat', text: 'Citizens report by form, chat or voice' },
  { icon: 'spark', text: 'Gemini agents read and route' },
  { icon: 'alert', text: 'Emergencies escalate at once' },
  { icon: 'check', text: 'Staff approve every reply' },
]

export default async function Home() {
  const t = await getT()
  return (
    <div className="public">
      <header className="top">
        <Brand sub="AI agents for social services desks" />
        <LangSwitch />
      </header>
      <main className="landing">
        <section className="hero">
          <h1>{t('Every social complaint, read, routed and answered in minutes')}</h1>
          <p className="lead">
            {t(
              'For any social services desk: social aid, disability and elderly care, homelessness, disaster relief, violence and child protection.',
            )}
          </p>
          <ul className="steps-row" aria-label={t('How it works')}>
            {STEPS.map((s) => (
              <li key={s.text}>
                <span className="entry-ic small">
                  <Icon name={s.icon} size={18} />
                </span>
                {t(s.text)}
              </li>
            ))}
          </ul>
        </section>
        <h2 className="pick-h">{t('Choose an agency')}</h2>
        <AgencyPicker />
        <p className="muted small center">
          {t('Demo: no passwords, synthetic data only.')}{' '}
          {t(
            'Agency emblems belong to their institutions; Embrace is an independent prototype, not an official service.',
          )}
        </p>
      </main>
      <Footer />
    </div>
  )
}
