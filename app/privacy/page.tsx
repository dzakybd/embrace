import type { Metadata } from 'next'
import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import { LangSwitch } from '@/components/Lang'
import { getT } from '@/lib/i18n-server'

export const metadata: Metadata = { title: 'How your report is handled' }

/** The privacy notice the report chat and the Telegram bot link to (Indonesia's Personal Data Protection Law, UU 27/2022). */
export default async function PrivacyPage() {
  const t = await getT()
  const items = [
    ['Who sees your report', 'Only staff of the agency you chose. Your name, phone number and ID numbers are hidden from them by default, and you can report without giving your name.'],
    ['How AI is used', "Google's Gemini reads your report to sort it, find the right team and draft a reply. On the paid Gemini API, Google does not use it to train its models. The AI never decides alone: urgent cases follow fixed rules, and a person approves every reply."],
    ['What is kept', 'Your message, the contact you give, and what the AI read from a voice note or photo. The voice note or photo itself is not stored.'],
    ['Your rights', 'You can ask the agency to show, correct or delete your data, or withdraw your consent, under Law 27/2022 on Personal Data Protection.'],
  ]
  return (
    <div className="public">
      <header className="top">
        <Brand sub="Privacy" />
        <nav className="top-links" aria-label="Main"><Link href="/">{t('All agencies')}</Link><LangSwitch /></nav>
      </header>
      <main className="citizen"><article className="privacy">
        <h1>{t('How your report is handled')}</h1>
        <p className="demo-note">{t('This is a prototype with synthetic data, not an official service. Please do not send real personal data.')}</p>
        <dl>
          {items.map(([h, body]) => (
            <div key={h}><dt>{t(h)}</dt><dd>{t(body)}</dd></div>
          ))}
        </dl>
      </article></main>
      <Footer />
    </div>
  )
}
