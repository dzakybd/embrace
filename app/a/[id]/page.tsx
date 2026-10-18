import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiTelegram, SiWhatsapp } from 'react-icons/si'
import { Monogram } from '@/components/AgencyPicker'
import { Brand, Footer } from '@/components/Brand'
import { TrackBox } from '@/components/citizen/TrackBox'
import { LangSwitch } from '@/components/Lang'
import { catLabel } from '@/components/Procedures'
import { ChannelIcon, Icon, telegramUrl } from '@/components/ui'
import { agencyById } from '@/lib/agencies'
import { localize, translator } from '@/lib/i18n'
import { getLang } from '@/lib/i18n-server'
import { sourcesFor } from '@/lib/sop'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const agency = await agencyById((await params).id)
  return { title: agency ? localize(agency, await getLang()).short_name : 'Agency' }
}

const STAFF = [
  { as: 'officer', page: 'inbox', icon: 'inbox', title: 'Caseworker', body: 'My cases and AI-drafted replies' },
  { as: 'supervisor', page: 'inbox', icon: 'alert', title: 'Duty supervisor', body: 'Escalations first, delegate cases' },
  { as: 'leader', page: 'insights', icon: 'chart', title: 'Head of office', body: 'KPIs, weekly AI brief, early warnings' },
]

const MANAGE = [
  { as: 'supervisor', page: 'integrations', icon: 'chat', title: 'Channels', body: 'Telegram bot token, WhatsApp, email and more' },
  { as: 'leader', page: 'settings', icon: 'rules', title: 'Settings', body: 'Names, rules, categories, teams, staff and documents' },
  { as: 'leader', page: 'ai', icon: 'shield', title: 'AI control tower', body: 'Models, API key, guardrails, traces and metrics' },
]

const FLOW = [
  { icon: 'check', text: 'Report number in seconds, personal data masked' },
  { icon: 'alert', text: 'Urgent cases alert the duty supervisor' },
  { icon: 'user', text: 'A caseworker gets a cited draft reply' },
  { icon: 'send', text: 'A person approves every reply' },
]

/** Agency home: the citizen's ways in, the staff workspace by role, and what the agency handles. */
export default async function AgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const found = await agencyById((await params).id)
  if (!found) notFound()
  const lang = await getLang()
  const t = translator(lang)
  const agency = localize(found, lang)
  const tg = telegramUrl(agency.telegram_bot)
  const byTeam = Object.entries(agency.queues).map(([q, team]) => ({ team, cats: agency.categories.filter((c) => c.queue === q) })).filter((t) => t.cats.length)
  const docs = sourcesFor(agency.id).filter((s) => !s.title.includes('(Indonesian original)'))
  return (
    <div className="public">
      <header className="top">
        <Brand sub={agency.short_name} />
        <nav className="top-links" aria-label="Main"><Link href="/"><Icon name="back" size={16} /> {t('All agencies')}</Link><LangSwitch /></nav>
      </header>
      <main className="agency-page">
        <section className="hero agency-hero">
          <Monogram agency={{ id: agency.id, short_name: agency.short_name, logo: agency.logo ?? null }} size={64} />
          <div>
            <p className="muted small">{agency.country}{agency.custom ? ` · ${t('created in Embrace')}` : ''}{agency.logo ? ` · ${t('independent demo, not an official service')}` : ''}</p>
            <h1>{agency.name}</h1>
            {agency.description && <p className="lead clamp">{agency.description}</p>}
          </div>
        </section>

        <h2 className="pick-h">{t('Get help')}</h2>
        <section className="hub-grid">
          <Link href={`/report?agency=${agency.id}`} className="role-card main">
            <span className="entry-ic"><Icon name="form" size={24} /></span>
            <b>{t('Report a problem')}</b>
            <span className="muted">{t('Text, voice note or photo')}</span>
            <span className="go">{t('Open the form')} <Icon name="send" size={14} /></span>
          </Link>
          {tg && (
            <a href={tg} target="_blank" rel="noreferrer" className="role-card">
              <span className="entry-ic brand-ic" style={{ background: '#26A5E4' }}><SiTelegram size={24} color="#fff" aria-hidden="true" /></span>
              <b>Telegram</b>
              <span className="muted">@{agency.telegram_bot}</span>
              <span className="go">{t('Open chat')} <Icon name="send" size={14} /></span>
            </a>
          )}
          <div className="role-card off">
            <span className="entry-ic brand-ic" style={{ background: '#25D366' }}><SiWhatsapp size={24} color="#fff" aria-hidden="true" /></span>
            <b>WhatsApp <span className="soon">{t('Soon')}</span></b>
            <span className="muted channel-row">
              <ChannelIcon c="instagram" /> <ChannelIcon c="threads" /> <ChannelIcon c="email" /> {t('and more, same inbox')}
            </span>
          </div>
          <TrackBox />
        </section>

        <h2 className="pick-h">{t('Staff workspace')}</h2>
        <section className="hub-grid three">
          {STAFF.map((s) => (
            <Link key={s.as} href={`/staff/${s.page}?agency=${agency.id}&as=${s.as}`} className="role-card staff-tile">
              <span className="entry-ic small"><Icon name={s.icon} size={22} /></span>
              <span>
                <b>{t(s.title)}</b>
                <span className="muted">{t(s.body)}</span>
              </span>
              <Icon name="send" size={16} />
            </Link>
          ))}
        </section>

        <h2 className="pick-h">{t('Manage this agency')}</h2>
        <section className="hub-grid three">
          {MANAGE.map((s) => (
            <Link key={s.page} href={`/staff/${s.page}?agency=${agency.id}&as=${s.as}`} className="role-card staff-tile">
              <span className="entry-ic small"><Icon name={s.icon} size={22} /></span>
              <span>
                <b>{t(s.title)}</b>
                <span className="muted">{t(s.body)}</span>
              </span>
              <span className="tile-marks" aria-hidden="true">
                {s.page === 'integrations' && <><ChannelIcon c="telegram" size={18} /><ChannelIcon c="whatsapp" size={18} /><ChannelIcon c="email" size={18} /></>}
              </span>
              <Icon name="send" size={16} />
            </Link>
          ))}
        </section>

        <h2 className="pick-h">{t('How a report is handled')}</h2>
        <ol className="steps-row flow">
          {FLOW.map((f, i) => <li key={f.text}><span className="entry-ic small"><Icon name={f.icon} size={18} /></span><span><small className="muted">{t('Step {n}', { n: i + 1 })}</small>{t(f.text)}</span></li>)}
        </ol>
        {(agency.procedures?.length ?? 0) > 0 && (
          <Link href={`/a/${agency.id}/guide`} className="role-card staff-tile guide-tile">
            <span className="entry-ic small"><Icon name="rules" size={22} /></span>
            <span>
              <b>{t('Case types and procedures')}</b>
              <span className="muted">{t('{n} procedures, the stages of each and the laws behind them', { n: agency.procedures!.length })}</span>
            </span>
            <Icon name="send" size={16} />
          </Link>
        )}

        <details className="card more">
          <summary><Icon name="rules" /> {t('What this agency handles')} <span className="muted small">{t('{n} teams', { n: byTeam.length })}</span></summary>
          <section className="teams-grid">
            {byTeam.map((t) => (
              <div key={t.team}>
                <h3>{t.team}</h3>
                <ul>{t.cats.map((c) => <li key={c.id}>{catLabel(c, lang)}</li>)}</ul>
              </div>
            ))}
          </section>
        </details>

        {docs.length > 0 && (
          <details className="card more">
            <summary><Icon name="book" /> {t('Procedures and regulations the replies follow')} <span className="muted small">{t('{n} documents', { n: docs.length })}</span></summary>
            <ul className="docs-list">
              {docs.map((d) => <li key={d.file}>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a> : d.title} <span className="muted small">· {d.issuer}</span></li>)}
            </ul>
          </details>
        )}
      </main>
      <Footer />
    </div>
  )
}
