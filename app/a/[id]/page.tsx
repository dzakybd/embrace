import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Brand, Footer } from '@/components/Brand'
import { Icon, telegramUrl } from '@/components/ui'
import { agencyById } from '@/lib/agencies'
import { sourcesFor } from '@/lib/sop'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const agency = await agencyById((await params).id)
  return { title: agency?.short_name ?? 'Agency' }
}

/** Public page of one agency: what it handles, how to reach it on every channel, how a report is handled. */
export default async function AgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const agency = await agencyById((await params).id)
  if (!agency || agency.template) notFound()
  const tg = telegramUrl(agency.telegram_bot)
  const byTeam = Object.entries(agency.queues).map(([q, team]) => ({ team, cats: agency.categories.filter((c) => c.queue === q) })).filter((t) => t.cats.length)
  const docs = sourcesFor(agency.id).filter((s) => !s.title.includes('(Indonesian original)'))
  return (
    <div className="public">
      <header className="top">
        <Brand sub={agency.short_name} />
        <nav className="top-links" aria-label="Main"><Link href="/">Main menu</Link><Link href={`/staff/inbox?agency=${agency.id}`}>Staff workspace</Link></nav>
      </header>
      <main className="agency-page">
        <section className="hero">
          <p className="muted small">{agency.country}{agency.custom ? ' · created in Embrace' : ''}</p>
          <h1>{agency.name}</h1>
          {agency.description && <p className="lead">{agency.description}</p>}
          <div className="banner crit"><Icon name="alert" /><span>In danger right now? Call <b>{agency.emergency_line}</b>.</span></div>
        </section>

        <h2 className="pick-h">Report a problem</h2>
        <section className="channels-grid">
          <Link href={`/report?agency=${agency.id}`} className="role-card main">
            <span className="entry-ic"><Icon name="form" size={24} /></span>
            <b>Web form</b>
            <span className="muted">Write in your own words and language, record a voice note or add a photo.</span>
            <span className="go">Open the form <Icon name="send" size={14} /></span>
          </Link>
          {tg ? (
            <a href={tg} target="_blank" rel="noreferrer" className="role-card">
              <span className="entry-ic"><Icon name="send" size={24} /></span>
              <b>Telegram</b>
              <span className="muted">Chat with @{agency.telegram_bot}. The caseworker&apos;s reply comes back to your chat.</span>
              <span className="go">Open Telegram <Icon name="send" size={14} /></span>
            </a>
          ) : null}
          <div className="role-card off">
            <span className="entry-ic"><Icon name="chat" size={24} /></span>
            <b>WhatsApp, Instagram, Threads, email</b>
            <span className="muted">Coming next, on the same agents and inbox.</span>
          </div>
        </section>

        <h2 className="pick-h">What happens to your report</h2>
        <ol className="how card">
          <li><b>Within seconds</b> you get a report number. Personal details are masked before staff read the case.</li>
          <li><b>Urgent cases</b> alert the duty supervisor at once; the reply gives you the emergency number.</li>
          <li><b>A caseworker</b> in the right team is put in charge, starting from a draft reply that cites the agency&apos;s own procedures.</li>
          <li><b>A person approves</b> every reply before it is sent. You can follow your report at any time with its number.</li>
        </ol>

        <h2 className="pick-h">What this agency handles</h2>
        <section className="teams-grid">
          {byTeam.map((t) => (
            <div key={t.team} className="card">
              <h3>{t.team}</h3>
              <ul>{t.cats.map((c) => <li key={c.id}>{c.label}</li>)}</ul>
            </div>
          ))}
        </section>

        {docs.length > 0 && (
          <>
            <h2 className="pick-h">Procedures and regulations the replies follow</h2>
            <ul className="card docs-list">
              {docs.map((d) => <li key={d.file}>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a> : d.title} <span className="muted small">· {d.issuer}</span></li>)}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
