'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api, type SopSource } from '../api'
import { useLang } from '../Lang'
import { ACTORS, catLabel, procTitle, type ProcedureT } from '../Procedures'
import { Card, Icon } from '../ui'
import { FlowDiagram } from '../ProcedureFlow'
import { useStaff } from './StaffProvider'

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50) || 'procedure'

/** Case types and their procedures: the head of office edits stages, who does each, requirements and the legal basis;
 * everyone else reads them. The diagram updates as you type, and the agents use what is saved here. */
export default function CaseTypes() {
  const { agency } = useStaff()
  // A fresh editor per agency (and after each save reloads it), so its state starts from the saved procedures.
  return <Editor key={`${agency.id}:${JSON.stringify(agency.procedures ?? []).length}`} />
}

function Editor() {
  const { t, lang } = useLang()
  const { agency, me, reload } = useStaff()
  const canEdit = me.role === 'leader' || me.role === 'supervisor'
  const [procs, setProcs] = useState<ProcedureT[]>(agency.procedures ?? [])
  const [laws, setLaws] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(agency.categories.map((c) => [c.id, c.laws ?? []])),
  )
  const [sel, setSel] = useState(0)
  const [docs, setDocs] = useState<SopSource[]>([])
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const [err, setErr] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.sop(agency.id, '').then((r) => setDocs(r.sources))
  }, [agency.id])

  const p = procs[sel]
  const legal = useMemo(() => docs.filter((d) => d.kind === 'law' || d.kind === 'regulation'), [docs])
  const edit = (fn: (p: ProcedureT) => ProcedureT) => {
    setProcs((ps) => ps.map((x, i) => (i === sel ? fn(x) : x)))
    setDirty(true)
    setState('')
  }
  const moveStage = (i: number, d: number) =>
    edit((x) => {
      const s = [...x.stages]
      ;[s[i], s[i + d]] = [s[i + d], s[i]]
      return { ...x, stages: s }
    })
  const add = () => {
    const n = {
      id: slug(`procedure ${procs.length + 1} ${Date.now().toString(36)}`),
      title: t('New procedure'),
      categories: [agency.categories[0].id],
      stages: [{ title: t('Report received'), who: 'desk' }],
    }
    setProcs([...procs, n])
    setSel(procs.length)
    setDirty(true)
  }
  const save = async () => {
    setState('saving')
    setErr('')
    try {
      await api.saveProcedures(agency.id, { procedures: procs, laws, by: { name: me.name, role: me.role } })
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
    <div className="page case-types">
      <div className="page-h">
        <div>
          <h1>{t('Case types')}</h1>
          <p className="muted">
            {t(
              'The procedure each kind of case follows, who does each stage, and the law behind it. Staff tick the stages on each case, citizens see them when tracking, and the reply drafter tells citizens what comes next.',
            )}
          </p>
        </div>
        <Link className="btn tonal small" href={`/a/${agency.id}/guide`} target="_blank">
          {t('Public guide')} ↗
        </Link>
      </div>

      <div className="ct-grid">
        <nav className="ct-list" aria-label={t('Procedures')}>
          {procs.map((x, i) => (
            <button key={x.id} className={`ct-item ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>
              <b>{procTitle(x, lang)}</b>
              <span className="muted small">
                {t('{n} stages', { n: x.stages.length })} ·{' '}
                {x.categories.length === agency.categories.length
                  ? t('all case types')
                  : x.categories
                      .map(
                        (c) =>
                          catLabel(agency.categories.find((k) => k.id === c) ?? { id: c, label: c }, lang).split(
                            ' (',
                          )[0],
                      )
                      .join(', ')}
              </span>
            </button>
          ))}
          {canEdit && (
            <button className="ghost small" onClick={add}>
              <Icon name="plus" size={14} /> {t('New procedure')}
            </button>
          )}
        </nav>

        {p && (
          <div className="col">
            <Card title={procTitle(p, lang)} icon="rules">
              <FlowDiagram stages={p.stages} lang={lang} t={t} />
            </Card>
            {canEdit ? (
              <Card title={t('Edit procedure')} icon="form">
                <div className="row2">
                  <label className="field">
                    <span>{t('Name (English)')}</span>
                    <input value={p.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{t('Name (Indonesian)')}</span>
                    <input
                      value={p.title_id ?? ''}
                      onChange={(e) => edit((x) => ({ ...x, title_id: e.target.value }))}
                    />
                  </label>
                </div>
                <fieldset className="ct-cats">
                  <legend className="hint">{t('Case types it applies to')}</legend>
                  {agency.categories.map((c) => (
                    <label key={c.id} className="check">
                      <input
                        type="checkbox"
                        checked={p.categories.includes(c.id)}
                        onChange={(e) =>
                          edit((x) => ({
                            ...x,
                            categories: e.target.checked
                              ? [...x.categories, c.id]
                              : x.categories.filter((k) => k !== c.id),
                          }))
                        }
                      />
                      {catLabel(c, lang)}
                    </label>
                  ))}
                </fieldset>
                <h3 className="sub-h">{t('Stages')}</h3>
                <ol className="ct-stages">
                  {p.stages.map((s, i) => (
                    <li key={i}>
                      <span className="pdot">{i + 1}</span>
                      <input
                        aria-label={t('Stage {n} (English)', { n: i + 1 })}
                        value={s.title}
                        onChange={(e) =>
                          edit((x) => ({
                            ...x,
                            stages: x.stages.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)),
                          }))
                        }
                      />
                      <input
                        aria-label={t('Stage {n} (Indonesian)', { n: i + 1 })}
                        placeholder={t('Indonesian')}
                        value={s.title_id ?? ''}
                        onChange={(e) =>
                          edit((x) => ({
                            ...x,
                            stages: x.stages.map((y, j) => (j === i ? { ...y, title_id: e.target.value } : y)),
                          }))
                        }
                      />
                      <select
                        aria-label={t('Who')}
                        value={s.who ?? 'caseworker'}
                        onChange={(e) =>
                          edit((x) => ({
                            ...x,
                            stages: x.stages.map((y, j) => (j === i ? { ...y, who: e.target.value } : y)),
                          }))
                        }
                      >
                        {ACTORS.map((a) => (
                          <option key={a.id} value={a.id}>
                            {t(a.label)}
                          </option>
                        ))}
                      </select>
                      <span className="ct-btns">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t('Move up')}
                          disabled={i === 0}
                          onClick={() => moveStage(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t('Move down')}
                          disabled={i === p.stages.length - 1}
                          onClick={() => moveStage(i, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t('Remove stage')}
                          disabled={p.stages.length === 1}
                          onClick={() => edit((x) => ({ ...x, stages: x.stages.filter((_, j) => j !== i) }))}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => edit((x) => ({ ...x, stages: [...x.stages, { title: '', who: 'caseworker' }] }))}
                >
                  <Icon name="plus" size={14} /> {t('Add stage')}
                </button>
                <div className="row2">
                  <label className="field">
                    <span>{t('What to bring, one per line (English)')}</span>
                    <textarea
                      rows={3}
                      value={(p.requirements ?? []).join('\n')}
                      onChange={(e) => edit((x) => ({ ...x, requirements: lines(e.target.value) }))}
                    />
                  </label>
                  <label className="field">
                    <span>{t('What to bring, one per line (Indonesian)')}</span>
                    <textarea
                      rows={3}
                      value={(p.requirements_id ?? []).join('\n')}
                      onChange={(e) => edit((x) => ({ ...x, requirements_id: lines(e.target.value) }))}
                    />
                  </label>
                </div>
                <div className="row2">
                  <label className="field">
                    <span>{t('Note for citizens (English)')}</span>
                    <textarea
                      rows={2}
                      value={p.note ?? ''}
                      onChange={(e) => edit((x) => ({ ...x, note: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>{t('Note for citizens (Indonesian)')}</span>
                    <textarea
                      rows={2}
                      value={p.note_id ?? ''}
                      onChange={(e) => edit((x) => ({ ...x, note_id: e.target.value }))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="ghost small danger"
                  disabled={procs.length === 1}
                  onClick={() => {
                    setProcs(procs.filter((_, i) => i !== sel))
                    setSel(0)
                    setDirty(true)
                  }}
                >
                  {t('Delete this procedure')}
                </button>
              </Card>
            ) : (
              <p className="muted small">{t('Only the supervisor or the head of office changes procedures.')}</p>
            )}
          </div>
        )}
      </div>

      <Card title={t('Legal basis by case type')} icon="book">
        <p className="muted small">
          {t(
            'Indonesian laws and regulations from the agency documents. The guide, the case page and the drafter cite them.',
          )}
        </p>
        <table className="law-table">
          <tbody>
            {agency.categories.map((c) => (
              <tr key={c.id}>
                <th scope="row">{catLabel(c, lang)}</th>
                <td>
                  <div className="law-pick">
                    {legal.map((d) => {
                      const on = (laws[c.id] ?? []).includes(d.short)
                      return (
                        <button
                          key={d.short}
                          type="button"
                          className={`chip ${on ? 'on' : ''}`}
                          aria-pressed={on}
                          disabled={!canEdit}
                          title={d.title}
                          onClick={() => {
                            setLaws({
                              ...laws,
                              [c.id]: on ? laws[c.id].filter((l) => l !== d.short) : [...(laws[c.id] ?? []), d.short],
                            })
                            setDirty(true)
                            setState('')
                          }}
                        >
                          {on && <Icon name="check" size={12} />} {d.short}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {canEdit && (
        <div className="savebar">
          <span className={err ? 'error small' : 'muted small'}>
            {err ||
              (state === 'saved'
                ? t('Saved. The agents use it on the next report.')
                : dirty
                  ? t('Unsaved changes')
                  : t('Changes apply to new reports and the public guide at once.'))}
          </span>
          <button className="primary" disabled={!dirty || state === 'saving'} onClick={save}>
            {state === 'saving' ? t('Saving…') : t('Save')}
          </button>
        </div>
      )}
    </div>
  )
}
