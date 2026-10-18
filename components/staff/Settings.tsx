'use client'

import Link from 'next/link'
import { useState } from 'react'
import { api, type Agency, type SetupBody, type TeamMember } from '../api'
import { Avatar } from '../Avatar'
import { useT } from '../Lang'
import { Card, Icon } from '../ui'
import { useStaff } from './StaffProvider'

type Profile = NonNullable<SetupBody['profile']>
type Person = NonNullable<SetupBody['people']>[number]

const ROLES: { id: TeamMember['role']; label: string }[] = [
  { id: 'leader', label: 'Head of office' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'officer', label: 'Caseworker' },
]

const profileOf = (a: Agency): Profile => ({
  name: a.name,
  short_name: a.short_name,
  country: a.country,
  description: a.description ?? '',
  name_id: a.name_id ?? '',
  short_name_id: a.short_name_id ?? '',
  description_id: a.description_id ?? '',
  reply_signature: a.reply_signature,
})

/** Agency settings: its profile and its people. Case types and escalation rules live on Case types, documents in the
 * Knowledge base, channels on Channels. Saving asks for the settings password. */
export default function Settings() {
  const { agency } = useStaff()
  return <Editor key={`${agency.id}:${JSON.stringify([profileOf(agency), agency.team]).length}`} />
}

function Editor() {
  const t = useT()
  const { agency, reload } = useStaff()
  const [tab, setTab] = useState<'profile' | 'people'>('profile')
  const [profile, setProfile] = useState<Profile>(() => profileOf(agency))
  const [people, setPeople] = useState<Person[]>(() => agency.team.map((m) => ({ ...m })))
  const [dirty, setDirty] = useState({ profile: false, people: false })
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const [err, setErr] = useState('')
  const [restoring, setRestoring] = useState(false)

  const setP = (patch: Partial<Profile>) => {
    setProfile({ ...profile, ...patch })
    setDirty({ ...dirty, profile: true })
    setState('')
  }
  const setPerson = (i: number, patch: Partial<Person>) => {
    setPeople(people.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    setDirty({ ...dirty, people: true })
    setState('')
  }
  const save = async () => {
    setState('saving')
    setErr('')
    try {
      await api.saveSetup(agency.id, {
        ...(dirty.profile ? { profile } : {}),
        ...(dirty.people ? { people: people.filter((m) => m.name.trim()) } : {}),
      })
      setState('saved')
      setDirty({ profile: false, people: false })
      reload()
    } catch (e) {
      const m = String(e).replace(/^Error: \d+ /, '')
      try {
        setErr(JSON.parse(m).error)
      } catch {
        setErr(m)
      }
      setState('')
    }
  }
  const restore = async () => {
    setRestoring(true)
    const ok = await api.deleteAgency(agency.id).then(
      () => true,
      () => false,
    )
    setRestoring(false)
    if (ok) reload()
  }

  // One row per setting, English and Indonesian side by side.
  const pair = (
    label: string,
    en: keyof Profile,
    id: keyof Profile | null,
    opts: { long?: boolean; ph?: string } = {},
  ) => (
    <div className="set-row">
      <span className="set-l">{t(label)}</span>
      {[en, id].map((k, n) =>
        k ? (
          <span key={k} className="set-in">
            <span className="set-lang" aria-hidden="true">
              {n ? 'ID' : 'EN'}
            </span>
            {opts.long ? (
              <textarea
                rows={2}
                value={profile[k]}
                aria-label={`${t(label)} (${n ? t('Indonesian') : t('English')})`}
                placeholder={n ? t('Indonesian') : opts.ph}
                onChange={(e) => setP({ [k]: e.target.value })}
              />
            ) : (
              <input
                value={profile[k]}
                aria-label={`${t(label)} (${n ? t('Indonesian') : t('English')})`}
                placeholder={n ? t('Indonesian') : opts.ph}
                onChange={(e) => setP({ [k]: e.target.value })}
              />
            )}
          </span>
        ) : (
          <span key="none" />
        ),
      )}
    </div>
  )

  return (
    <div className="page settings">
      <div className="page-h">
        <div>
          <h1>{t('Agency settings')}</h1>
          <p className="muted">{t('The agency’s profile and its people.')}</p>
        </div>
        {agency.edited && (
          <button
            className="ghost small"
            onClick={restore}
            disabled={restoring}
            title={t('Back to the settings shipped with the demo')}
          >
            <Icon name="refresh" size={14} /> {t('Restore demo settings')}
          </button>
        )}
      </div>

      <nav className="set-links" aria-label={t('Other setup')}>
        <Link href="/staff/policies">
          <Icon name="rules" size={16} /> {t('Policies')}
        </Link>
        <Link href="/staff/knowledge">
          <Icon name="book" size={16} /> {t('Knowledge base')}
        </Link>
        <Link href="/staff/integrations">
          <Icon name="chat" size={16} /> {t('Channels')}
        </Link>
        <Link href="/staff/ai">
          <Icon name="shield" size={16} /> {t('AI control')}
        </Link>
      </nav>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'profile'}
          className={tab === 'profile' ? 'on' : ''}
          onClick={() => setTab('profile')}
        >
          <Icon name="building" size={14} /> {t('Profile')}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'people'}
          className={tab === 'people' ? 'on' : ''}
          onClick={() => setTab('people')}
        >
          <Icon name="user" size={14} /> {t('People and teams')} <b className="count-s">{people.length}</b>
        </button>
      </div>

      {tab === 'profile' && (
        <Card className="set-card">
          <div className="set-row head">
            <span />
            <span>{t('English')}</span>
            <span>{t('Indonesian')}</span>
          </div>
          {pair('Name', 'name', 'name_id')}
          {pair('Short name', 'short_name', 'short_name_id')}
          {pair('About the agency', 'description', 'description_id', { long: true })}
          <div className="set-row two">
            <span className="set-l">{t('Reply signature')}</span>
            <input value={profile.reply_signature} onChange={(e) => setP({ reply_signature: e.target.value })} />
          </div>
          <div className="set-row two">
            <span className="set-l">{t('Country')}</span>
            <input value={profile.country} onChange={(e) => setP({ country: e.target.value })} />
          </div>
        </Card>
      )}

      {tab === 'people' && (
        <>
          <div className="people">
            {people.map((m, i) => (
              <Card key={m.id ?? `new-${i}`} className="person">
                <div className="person-h">
                  <Avatar agency={agency.id} id={m.id ?? ''} name={m.name || '?'} />
                  <input
                    className="person-name"
                    value={m.name}
                    aria-label={t('Name')}
                    placeholder={t('Name')}
                    onChange={(e) => setPerson(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Remove person')}
                    onClick={() => {
                      setPeople(people.filter((_, j) => j !== i))
                      setDirty({ ...dirty, people: true })
                    }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <div className="segmented small" role="radiogroup" aria-label={t('Role')}>
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={m.role === r.id}
                      className={m.role === r.id ? 'on' : ''}
                      onClick={() => setPerson(i, { role: r.id })}
                    >
                      {t(r.id === 'leader' ? agency.leader_label : r.label)}
                    </button>
                  ))}
                </div>
                <input
                  value={m.title}
                  aria-label={t('Job title')}
                  placeholder={t('Job title')}
                  onChange={(e) => setPerson(i, { title: e.target.value })}
                />
                {m.role === 'officer' ? (
                  <div className="team-chips" aria-label={t('Teams')}>
                    {m.queues.map((q) => (
                      <span key={q} className="chip-s">
                        {agency.queues[q] ?? q}
                        <button
                          type="button"
                          aria-label={t('Remove {word}', { word: agency.queues[q] ?? q })}
                          onClick={() => setPerson(i, { queues: m.queues.filter((x) => x !== q) })}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {Object.keys(agency.queues).some((q) => !m.queues.includes(q)) && (
                      <select
                        className="add-team"
                        value=""
                        aria-label={t('Add team')}
                        onChange={(e) => e.target.value && setPerson(i, { queues: [...m.queues, e.target.value] })}
                      >
                        <option value="">+ {t('Add team')}</option>
                        {Object.entries(agency.queues)
                          .filter(([q]) => !m.queues.includes(q))
                          .map(([q, name]) => (
                            <option key={q} value={q}>
                              {name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <p className="muted small">
                    {m.role === 'supervisor' ? t('Receives every escalation') : t('Sees Insights')}
                  </p>
                )}
              </Card>
            ))}
            <button
              type="button"
              className="person-add"
              onClick={() => {
                setPeople([...people, { name: '', role: 'officer', title: t('Caseworker'), queues: [] }])
                setDirty({ ...dirty, people: true })
              }}
            >
              <Icon name="plus" size={18} /> {t('Add person')}
            </button>
          </div>
          <p className="muted small">{t('Teams come from the case types. Use made-up names in this demo.')}</p>
        </>
      )}

      <div className="savebar">
        <span className={err ? 'error small' : 'muted small'}>
          {err ||
            (state === 'saved'
              ? t('Saved.')
              : dirty.profile || dirty.people
                ? t('Unsaved changes')
                : t('Saving asks for the settings password.'))}
        </span>
        <button className="primary" disabled={!(dirty.profile || dirty.people) || state === 'saving'} onClick={save}>
          {state === 'saving' ? t('Saving…') : t('Save')}
        </button>
      </div>
    </div>
  )
}
