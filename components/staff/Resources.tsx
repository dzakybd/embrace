'use client'

import { useState } from 'react'
import { api, type Resource } from '../api'
import { useLang } from '../Lang'
import { Card, Icon } from '../ui'
import { useStaff } from './StaffProvider'

export const KINDS: { id: Resource['kind']; label: string; icon: string }[] = [
  { id: 'official', label: 'Official channels', icon: 'building' },
  { id: 'social', label: 'Social media', icon: 'share' },
  { id: 'hotline', label: 'Hotlines', icon: 'alert' },
  { id: 'partner', label: 'Partner agencies', icon: 'user' },
  { id: 'link', label: 'Other links', icon: 'globe' },
]

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'resource'

export const resName = (r: Resource, lang: string) => (lang === 'id' && r.name_id ? r.name_id : r.name)
export const resNote = (r: Resource, lang: string) => (lang === 'id' && r.note_id ? r.note_id : r.note)

/** The agency's links and contacts: official channels, social media, hotlines, partner agencies and other links.
 * The supervisor and the head of office edit them; public ones show on the agency page, and the reply drafter may
 * name partners and hotlines. */
export default function Resources() {
  const { agency } = useStaff()
  // A fresh editor per agency and after each save, so its state starts from the saved list.
  return <Editor key={`${agency.id}:${JSON.stringify(agency.resources ?? []).length}`} />
}

function Editor() {
  const { t, lang } = useLang()
  const { agency, me, reload } = useStaff()
  const canEdit = me.role === 'leader' || me.role === 'supervisor'
  const [items, setItems] = useState<Resource[]>(agency.resources ?? [])
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const [err, setErr] = useState('')
  const set = (i: number, f: Partial<Resource>) => {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...f } : x)))
    setDirty(true)
    setState('')
  }
  const add = (kind: Resource['kind']) => {
    setItems([...items, { id: '', kind, name: '', public: kind !== 'partner' }])
    setDirty(true)
  }
  const save = async () => {
    setState('saving')
    setErr('')
    try {
      const clean = items.map((r, i) => ({ ...r, id: r.id || `${slug(r.name)}_${i + 1}` }))
      await api.saveResources(agency.id, { resources: clean, by: { name: me.name, role: me.role } })
      setState('saved')
      setDirty(false)
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

  return (
    <div className="page resources">
      <div className="page-h">
        <div>
          <h1>{t('Resources')}</h1>
          <p className="muted">
            {t(
              'Links and contacts of the agency and the services it works with. Public official channels, social media and links show on the agency page; the reply drafter may name partners and hotlines.',
            )}
          </p>
        </div>
        {canEdit && (
          <button className={editing ? 'primary small' : 'tonal small'} onClick={() => setEditing(!editing)}>
            <Icon name={editing ? 'check' : 'form'} size={14} /> {editing ? t('Done editing') : t('Edit')}
          </button>
        )}
      </div>

      {KINDS.map((k) => {
        const list = items.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === k.id)
        if (!list.length && !editing) return null
        return (
          <section key={k.id} className="res-group">
            <h2 className="section-h">
              <Icon name={k.icon} size={18} /> {t(k.label)}
            </h2>
            <div className="res-grid">
              {list.map(({ r, i }) =>
                editing ? (
                  <Card key={r.id || `new-${i}`} className="res-card editing">
                    <div className="row2">
                      <label className="field">
                        <span>{t('Name (English)')}</span>
                        <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                      </label>
                      <label className="field">
                        <span>{t('Name (Indonesian)')}</span>
                        <input value={r.name_id ?? ''} onChange={(e) => set(i, { name_id: e.target.value })} />
                      </label>
                    </div>
                    <div className="row2">
                      <label className="field">
                        <span>{t('Link (https://…)')}</span>
                        <input
                          value={r.url ?? ''}
                          placeholder="https://"
                          onChange={(e) => set(i, { url: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>{t('Phone or WhatsApp')}</span>
                        <input value={r.phone ?? ''} onChange={(e) => set(i, { phone: e.target.value })} />
                      </label>
                    </div>
                    <div className="row2">
                      <label className="field">
                        <span>{t('Note (English)')}</span>
                        <textarea rows={2} value={r.note ?? ''} onChange={(e) => set(i, { note: e.target.value })} />
                      </label>
                      <label className="field">
                        <span>{t('Note (Indonesian)')}</span>
                        <textarea
                          rows={2}
                          value={r.note_id ?? ''}
                          onChange={(e) => set(i, { note_id: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="res-foot">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={r.public}
                          onChange={(e) => set(i, { public: e.target.checked })}
                        />{' '}
                        {t('Show on the public agency page')}
                      </label>
                      {r.kind === 'hotline' && (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={!!r.urgent}
                            onChange={(e) => set(i, { urgent: e.target.checked })}
                          />{' '}
                          {t('Give in urgent replies (emergency line)')}
                        </label>
                      )}
                      <select
                        aria-label={t('Kind')}
                        value={r.kind}
                        onChange={(e) => set(i, { kind: e.target.value as Resource['kind'] })}
                      >
                        {KINDS.map((x) => (
                          <option key={x.id} value={x.id}>
                            {t(x.label)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost small danger"
                        onClick={() => {
                          setItems(items.filter((_, j) => j !== i))
                          setDirty(true)
                        }}
                      >
                        {t('Remove')}
                      </button>
                    </div>
                  </Card>
                ) : (
                  <ResourceCard key={r.id} r={r} lang={lang} t={t} />
                ),
              )}
              {editing && (
                <button type="button" className="res-add" onClick={() => add(k.id)}>
                  <Icon name="plus" size={16} /> {t('Add to {kind}', { kind: t(k.label).toLowerCase() })}
                </button>
              )}
            </div>
          </section>
        )
      })}

      {canEdit && editing && (
        <div className="savebar">
          <span className={err ? 'error small' : 'muted small'}>
            {err ||
              (state === 'saved'
                ? t('Saved.')
                : dirty
                  ? t('Unsaved changes')
                  : t('Changes show on the agency page and reach the agents at once.'))}
          </span>
          <button className="primary" disabled={!dirty || state === 'saving'} onClick={save}>
            {state === 'saving' ? t('Saving…') : t('Save')}
          </button>
        </div>
      )}
    </div>
  )
}

function ResourceCard({ r, lang, t }: { r: Resource; lang: string; t: (s: string) => string }) {
  const note = resNote(r, lang)
  return (
    <Card className="res-card">
      <div className="res-h">
        <b>{resName(r, lang)}</b>
        {!r.public && <span className="tag muted">{t('staff only')}</span>}
        {r.urgent && <span className="tag flag">{t('emergency line')}</span>}
      </div>
      {r.phone && (
        <p className="res-phone">
          <Icon name="chat" size={14} /> {r.phone}
        </p>
      )}
      {note && <p className="muted small">{note}</p>}
      {r.url && (
        <a className="small" href={r.url} target="_blank" rel="noreferrer">
          {r.url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗
        </a>
      )}
    </Card>
  )
}
