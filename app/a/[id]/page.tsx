import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiTelegram, SiWhatsapp } from 'react-icons/si'
import { Monogram } from '@/components/AgencyPicker'
import { Brand, Footer } from '@/components/Brand'
import { TrackBox } from '@/components/citizen/TrackBox'
import { LangSwitch } from '@/components/Lang'
import { ChannelIcon, Icon, telegramUrl } from '@/components/ui'
import { agencyById } from '@/lib/agencies'
import { localize, translator } from '@/lib/i18n'
import { getLang } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const agency = await agencyById((await params).id)
  return { title: agency ? localize(agency, await getLang()).short_name : 'Agency' }
}

const STAFF = [
  { as: 'officer', page: 'inbox', icon: 'inbox', title: 'Caseworker', body: 'My cases and AI-drafted replies' },
  { as: 'supervisor', page: 'inbox', icon: 'alert', title: 'Supervisor', body: 'Escalations first, delegate cases' },
  {
    as: 'leader',
    page: 'insights',
    icon: 'chart',
    title: 'Head of office',
    body: 'KPIs, weekly AI brief, early warnings',
  },
]

const MANAGE = [
  {
    as: 'supervisor',
    page: 'integrations',
    icon: 'chat',
    title: 'Channels',
    body: 'Telegram bot token, WhatsApp, email and more',
  },
  {
    as: 'supervisor',
    page: 'knowledge',
    icon: 'book',
    title: 'Knowledge base',
    body: 'Laws, SOPs, court decisions and web pages; ask the document agent',
  },
  {
    as: 'supervisor',
    page: 'policies',
    icon: 'rules',
    title: 'Policies',
    body: 'Who handles each case, when it escalates, its steps and legal basis',
  },
  {
    as: 'supervisor',
    page: 'resources',
    icon: 'globe',
    title: 'Resources',
    body: 'Official channels, social media, hotlines and partner agencies',
  },
  {
    as: 'supervisor',
    page: 'settings',
    icon: 'form',
    title: 'Agency settings',
    body: 'Profile, people and teams',
  },
  {
    as: 'supervisor',
    page: 'ai',
    icon: 'shield',
    title: 'AI control tower',
    body: 'Models, API key, guardrails, traces and metrics',
  },
]

const FLOW = [
  { icon: 'check', text: 'Report number in seconds, personal data masked' },
  { icon: 'alert', text: 'Urgent cases alert the supervisor' },
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
  // Official channels, social media and links only: emergency numbers are not shown as a banner here (user, 18 Oct).
  const publicRes = (agency.resources ?? []).filter(
    (r) => r.public && r.kind !== 'hotline' && r.kind !== 'partner' && (r.url || r.phone),
  )
  return (
    <div className="public">
      <header className="top">
        <Brand sub={agency.short_name} />
        <nav className="top-links" aria-label="Main">
          <Link href="/">
            <Icon name="back" size={16} /> {t('All agencies')}
          </Link>
          <LangSwitch />
        </nav>
      </header>
      <main className="agency-page">
        <section className="hero agency-hero">
          <Monogram agency={{ id: agency.id, short_name: agency.short_name, logo: agency.logo ?? null }} size={64} />
          <div>
            <p className="muted small">
              {agency.country}
              {agency.custom ? ` · ${t('created in Embrace')}` : ''}
              {agency.logo ? ` · ${t('independent demo, not an official service')}` : ''}
            </p>
            <h1>{agency.name}</h1>
            {agency.description && <p className="lead clamp">{agency.description}</p>}
          </div>
        </section>

        <h2 className="pick-h">{t('Get help')}</h2>
        <section className="hub-grid">
          <Link href={`/report?agency=${agency.id}`} className="role-card main">
            <span className="entry-ic">
              <Icon name="form" size={24} />
            </span>
            <b>{t('Report a problem')}</b>
            <span className="muted">{t('Text, voice note or photo')}</span>
            <span className="go">
              {t('Open the form')} <Icon name="send" size={14} />
            </span>
          </Link>
          {tg && (
            <a href={tg} target="_blank" rel="noreferrer" className="role-card">
              <span className="entry-ic brand-ic" style={{ background: '#26A5E4' }}>
                <SiTelegram size={24} color="#fff" aria-hidden="true" />
              </span>
              <b>Telegram</b>
              <span className="muted">@{agency.telegram_bot}</span>
              <span className="go">
                {t('Open chat')} <Icon name="send" size={14} />
              </span>
            </a>
          )}
          <div className="role-card off">
            <span className="entry-ic brand-ic" style={{ background: '#25D366' }}>
              <SiWhatsapp size={24} color="#fff" aria-hidden="true" />
            </span>
            <b>
              WhatsApp <span className="soon">{t('Soon')}</span>
            </b>
            <span className="muted channel-row">
              <ChannelIcon c="instagram" /> <ChannelIcon c="threads" /> <ChannelIcon c="email" />{' '}
              {t('and more, same inbox')}
            </span>
          </div>
          <TrackBox />
        </section>
        {publicRes.length > 0 && (
          <ul className="official-links" aria-label={t('Official links')}>
            {publicRes.map((r) => {
              const name = lang === 'id' && r.name_id ? r.name_id : r.name
              return (
                <li key={r.id}>
                  {r.url ? (
                    <a className="chip" href={r.url} target="_blank" rel="noreferrer">
                      {r.kind === 'social' ? <ChannelIcon c="instagram" size={14} /> : <Icon name="globe" size={14} />}{' '}
                      {name}
                    </a>
                  ) : (
                    <span className="chip">
                      <Icon name="chat" size={14} /> {name}: <b>{r.phone}</b>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <h2 className="pick-h">
          {t('How a report is handled')}{' '}
          {(agency.procedures?.length ?? 0) > 0 && (
            <Link className="h-link" href={`/a/${agency.id}/guide`}>
              {t('Every case type, step by step')} →
            </Link>
          )}
        </h2>
        <ol className="steps-row flow">
          {FLOW.map((f, i) => (
            <li key={f.text}>
              <span className="entry-ic small">
                <Icon name={f.icon} size={18} />
              </span>
              <span>
                <small className="muted">{t('Step {n}', { n: i + 1 })}</small>
                {t(f.text)}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="pick-h">{t('Staff workspace')}</h2>
        <section className="hub-grid three">
          {STAFF.map((s) => (
            <Link key={s.as} href={`/staff/${s.page}?agency=${agency.id}&as=${s.as}`} className="role-card staff-tile">
              <span className="entry-ic small">
                <Icon name={s.icon} size={22} />
              </span>
              <span>
                <b>{t(s.as === 'leader' ? (agency.leader_label ?? s.title) : s.title)}</b>
                <span className="muted">{t(s.body)}</span>
              </span>
              <Icon name="send" size={16} />
            </Link>
          ))}
        </section>

        <h2 className="pick-h">{t('Manage this agency')}</h2>
        <section className="hub-grid three">
          {MANAGE.map((s) => (
            <Link
              key={s.page}
              href={`/staff/${s.page}?agency=${agency.id}&as=${s.as}`}
              className="role-card staff-tile"
            >
              <span className="entry-ic small">
                <Icon name={s.icon} size={22} />
              </span>
              <span>
                <b>{t(s.title)}</b>
                <span className="muted">{t(s.body)}</span>
              </span>
              <span className="tile-marks" aria-hidden="true">
                {s.page === 'integrations' && (
                  <>
                    <ChannelIcon c="telegram" size={18} />
                    <ChannelIcon c="whatsapp" size={18} />
                    <ChannelIcon c="email" size={18} />
                  </>
                )}
              </span>
              <Icon name="send" size={16} />
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  )
}
