'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api, type Agency, type SetupBody, type SopSource, type Urgency } from '../api'
import { useLang } from '../Lang'
import { ACTORS, catLabel, procTitle, type ProcedureT } from '../Procedures'
import { FlowDiagram } from '../ProcedureFlow'
import { KIND } from './Knowledge'
import { Card, Icon, URGENCY_LABEL, duration } from '../ui'
import { useStaff } from './StaffProvider'

type Rules = NonNullable<SetupBody['rules']>
type CaseType = Rules['categories'][number]

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
    .slice(0, 40) || 'case_type'

const URGENCIES: Urgency[] = ['critical', 'high', 'normal', 'low']
/** Safety signals the triage agent raises; the agency picks which always alert the supervisor. */
const FLAGS: { id: string; label: string; icon: string }[] = [
  { id: 'child_safety', label: 'A child is unsafe', icon: 'user' },
  { id: 'immediate_danger', label: 'Someone is in danger now', icon: 'alert' },
  { id: 'self_harm', label: 'Self-harm or suicide risk', icon: 'alert' },
  { id: 'basic_needs_crisis', label: 'No food or shelter today', icon: 'home' },
  { id: 'repeat_complaint', label: 'Repeat complaint', icon: 'refresh' },
  { id: 'possible_fraud', label: 'Possible fraud', icon: 'shield' },
  { id: 'insufficient_info', label: 'Not enough information', icon: 'form' },
]
/** How a case type escalates, from strictest to the AI's own judgement. */
const LEVELS = [
  { id: 'always', label: 'Always escalate' },
  { id: 'high', label: 'At least high' },
  { id: 'normal', label: 'At least normal' },
  { id: 'ai', label: 'AI decides' },
] as const
const levelOf = (c: CaseType) => (c.always_escalate ? 'always' : (c.min_urgency ?? 'ai'))

function rulesOf(a: Agency): Rules {
  return {
    categories: a.categories.map((c) => ({
      id: c.id,
      label: c.label,
      label_id: c.label_id ?? '',
      team: a.queues[c.queue] ?? c.queue,
      always_escalate: a.escalation.always_escalate_categories.includes(c.id),
      min_urgency: c.min_urgency === 'normal' || c.min_urgency === 'high' ? c.min_urgency : undefined,
    })),
    keywords: a.escalation.keywords,
    flags: a.escalation.escalate_flags,
    custom_signals: (a.escalation.custom_signals ?? []).map((x) => ({ ...x, label_id: x.label_id ?? '' })),
    confidence_floor: a.escalation.confidence_floor ?? 0.7,
    sla_hours: a.sla_hours,
  }
}

/** Case types and their rules in one place: who handles each kind of case, when it escalates, its legal basis and the
 * procedure it follows, plus the escalation rules for every case. Supervisor and head of office edit; others read. */
export default function CaseTypes() {
  const { agency } = useStaff()
  // A fresh editor per agency and after each save, so its state starts from what is saved.
  const key = `${agency.id}:${JSON.stringify([agency.categories, agency.escalation, agency.procedures]).length}`
  return <Editor key={key} />
}

function Editor() {
  const { t, lang } = useLang()
  const { agency, me, reload } = useStaff()
  const canEdit = me.role === 'leader' || me.role === 'supervisor'
  const [tab, setTab] = useState<'types' | 'rules'>('types')
  const [rules, setRules] = useState<Rules>(() => rulesOf(agency))
  const [procs, setProcs] = useState<ProcedureT[]>(agency.procedures ?? [])
  const [laws, setLaws] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(agency.categories.map((c) => [c.id, c.laws ?? []])),
  )
  const [sel, setSel] = useState(agency.categories[0]?.id ?? '')
  const [docs, setDocs] = useState<SopSource[]>([])
  const [dirty, setDirty] = useState({ rules: false, procs: false })
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api.knowledge(agency.id).then((r) => setDocs(r.sources))
  }, [agency.id])
  const teams = [...new Set(rules.categories.map((c) => c.team.trim()).filter(Boolean))]
  const cat = rules.categories.find((c) => c.id === sel) ?? rules.categories[0]
  const label = (c: CaseType) => (lang === 'id' && c.label_id ? c.label_id : c.label)

  const touch = (k: 'rules' | 'procs') => {
    setDirty((d) => ({ ...d, [k]: true }))
    setState('')
  }
  const setRule = (patch: Partial<Rules>) => {
    setRules((r) => ({ ...r, ...patch }))
    touch('rules')
  }
  const setCat = (patch: Partial<CaseType>) =>
    setRule({ categories: rules.categories.map((c) => (c.id === cat.id ? { ...c, ...patch } : c)) })
  const addCat = () => {
    const id = `${slug(t('New case type'))}_${Date.now().toString(36).slice(-4)}`
    setRule({
      categories: [
        ...rules.categories,
        { id, label: t('New case type'), label_id: '', team: teams[0] ?? '', always_escalate: false },
      ],
    })
    setSel(id)
  }
  const removeCat = () => {
    const rest = rules.categories.filter((c) => c.id !== cat.id)
    setRule({ categories: rest })
    setProcs((ps) =>
      ps
        .map((p) => ({ ...p, categories: p.categories.filter((c) => c !== cat.id) }))
        .filter((p) => p.categories.length),
    )
    touch('procs')
    setSel(rest[0]?.id ?? '')
  }

  const save = async () => {
    setState('saving')
    setErr('')
    try {
      if (dirty.rules) await api.saveSetup(agency.id, { rules })
      if (dirty.procs) {
        const ids = rules.categories.map((c) => c.id!)
        await api.saveProcedures(agency.id, {
          procedures: procs.map((p) => ({ ...p, categories: p.categories.filter((c) => ids.includes(c)) })),
          laws: Object.fromEntries(ids.map((id) => [id, laws[id] ?? []])),
          by: { name: me.name, role: me.role },
        })
      }
      setState('saved')
      setDirty({ rules: false, procs: false })
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
    <div className="page case-types policies">
      <div className="page-h">
        <div>
          <h1>{t('Policies')}</h1>
          <p className="muted">
            {t(
              'Per case type: who handles it, when it escalates, its legal basis and its steps; and the rules for every case.',
            )}
          </p>
        </div>
        <Link className="btn tonal small" href={`/a/${agency.id}/guide`} target="_blank">
          {t('Public guide')} ↗
        </Link>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'types'}
          className={tab === 'types' ? 'on' : ''}
          onClick={() => setTab('types')}
        >
          <Icon name="rules" size={14} /> {t('Case types')}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'rules'}
          className={tab === 'rules' ? 'on' : ''}
          onClick={() => setTab('rules')}
        >
          <Icon name="shield" size={14} /> {t('Escalation rules')}
        </button>
      </div>

      {tab === 'types' && cat && (
        <div className="ct-grid">
          <label className="field ct-pick">
            <span>{t('Case type')}</span>
            <select value={cat.id} onChange={(e) => setSel(e.target.value)}>
              {rules.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c).split(' (')[0]}
                </option>
              ))}
            </select>
          </label>
          <nav className="ct-list" aria-label={t('Case types')}>
            {rules.categories.map((c) => {
              const lv = levelOf(c)
              return (
                <button key={c.id} className={`ct-item ${c.id === cat.id ? 'on' : ''}`} onClick={() => setSel(c.id!)}>
                  <b>{label(c).split(' (')[0]}</b>
                  <span className="ct-meta">
                    <span className="muted small">{c.team}</span>
                    {lv === 'always' && <span className="tag flag">{t('escalates')}</span>}
                    {lv === 'high' && <span className="tag">{t('high+')}</span>}
                  </span>
                </button>
              )
            })}
            {canEdit && (
              <button className="ghost small" onClick={addCat}>
                <Icon name="plus" size={14} /> {t('Add case type')}
              </button>
            )}
          </nav>

          <div className="col">
            <Card title={t('Routing and escalation')} icon="rules">
              <div className="row2">
                <label className="field">
                  <span>{t('Name (English)')}</span>
                  <input value={cat.label} disabled={!canEdit} onChange={(e) => setCat({ label: e.target.value })} />
                </label>
                <label className="field">
                  <span>{t('Name (Indonesian)')}</span>
                  <input
                    value={cat.label_id}
                    disabled={!canEdit}
                    onChange={(e) => setCat({ label_id: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span>{t('Team that handles it')}</span>
                <input
                  value={cat.team}
                  list="ct-teams"
                  disabled={!canEdit}
                  onChange={(e) => setCat({ team: e.target.value })}
                />
                <datalist id="ct-teams">
                  {teams.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </label>
              <div className="field">
                <span>{t('Escalation')}</span>
                <div className="segmented" role="radiogroup" aria-label={t('Escalation')}>
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={levelOf(cat) === l.id}
                      className={levelOf(cat) === l.id ? 'on' : ''}
                      disabled={!canEdit}
                      onClick={() =>
                        setCat({
                          always_escalate: l.id === 'always',
                          min_urgency: l.id === 'high' || l.id === 'normal' ? l.id : undefined,
                        })
                      }
                    >
                      {t(l.label)}
                    </button>
                  ))}
                </div>
                <small className="muted">
                  {levelOf(cat) === 'always'
                    ? t('Every report of this type alerts the supervisor at once.')
                    : levelOf(cat) === 'ai'
                      ? t('The AI rates urgency; the escalation rules still apply.')
                      : t('The AI may rate it higher, never lower.')}
                </small>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="ghost small danger"
                  disabled={rules.categories.length === 1}
                  onClick={removeCat}
                >
                  {t('Remove this case type')}
                </button>
              )}
            </Card>

            <LegalBasis
              chosen={laws[cat.id!] ?? []}
              docs={docs}
              canEdit={canEdit}
              onChange={(next) => {
                setLaws({ ...laws, [cat.id!]: next })
                touch('procs')
              }}
            />

            <Procedures
              key={cat.id}
              cat={cat.id!}
              procs={procs}
              canEdit={canEdit}
              categories={rules.categories}
              onChange={(next) => {
                setProcs(next)
                touch('procs')
              }}
            />
          </div>
        </div>
      )}

      {tab === 'rules' && <EscalationRules rules={rules} canEdit={canEdit} set={setRule} />}

      {canEdit && (
        <div className="savebar">
          <span className={err ? 'error small' : 'muted small'}>
            {err ||
              (state === 'saved'
                ? t('Saved. The agents use it on the next report.')
                : dirty.rules || dirty.procs
                  ? t('Unsaved changes')
                  : t('Changes apply to new reports and the public guide at once.'))}
          </span>
          <button className="primary" disabled={!(dirty.rules || dirty.procs) || state === 'saving'} onClick={save}>
            {state === 'saving' ? t('Saving…') : t('Save')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Order of the document categories in the legal-basis picker. */
const KIND_ORDER = ['law', 'regulation', 'court', 'guideline', 'sop', 'service-flow', 'template', 'website', 'other']

/** The documents that are a case type's legal basis: chosen ones as chips, and every knowledge-base document grouped
 * by category with its summary, so staff know what "UU 12/2022" is before choosing it. */
function LegalBasis({
  chosen,
  docs,
  canEdit,
  onChange,
}: {
  chosen: string[]
  docs: SopSource[]
  canEdit: boolean
  onChange: (next: string[]) => void
}) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const about = (d: SopSource) => (lang === 'id' && d.summary_id) || d.summary || d.title
  const byShort = Object.fromEntries(docs.map((d) => [d.short, d]))
  const groups = [...new Set(docs.map((d) => d.kind))].sort(
    (a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99),
  )
  const toggle = (short: string) =>
    onChange(chosen.includes(short) ? chosen.filter((x) => x !== short) : [...chosen, short])
  return (
    <Card
      title={t('Legal basis')}
      icon="book"
      action={
        canEdit ? (
          <button type="button" className={open ? 'primary small' : 'tonal small'} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'check' : 'plus'} size={14} /> {open ? t('Done') : t('Choose documents')}
          </button>
        ) : undefined
      }
    >
      {chosen.length ? (
        <ul className="lb-chosen">
          {chosen.map((short) => {
            const d = byShort[short]
            return (
              <li key={short}>
                <b>{short}</b>
                <span className="muted small">{d ? about(d) : t('Not in the knowledge base any more')}</span>
                {canEdit && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Remove {word}', { word: short })}
                    onClick={() => toggle(short)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted small">{t('No legal basis chosen yet.')}</p>
      )}
      {open && (
        <div className="lb-pick">
          {groups.map((g) => (
            <section key={g}>
              <h4>{t(KIND[g] ?? 'Document')}</h4>
              {docs
                .filter((d) => d.kind === g)
                .map((d) => (
                  <label key={d.short} className={`lb-doc ${chosen.includes(d.short) ? 'on' : ''}`}>
                    <input type="checkbox" checked={chosen.includes(d.short)} onChange={() => toggle(d.short)} />
                    <span>
                      <b>{d.short}</b> <span className="muted small">{d.title}</span>
                      <span className="small lb-sum">{about(d)}</span>
                    </span>
                  </label>
                ))}
            </section>
          ))}
          {!docs.length && <p className="muted small">{t('Add laws on the Knowledge base page.')}</p>}
        </div>
      )}
    </Card>
  )
}

/** The procedures this case type follows, as diagrams; editing opens below the diagram. */
function Procedures({
  cat,
  procs,
  canEdit,
  categories,
  onChange,
}: {
  cat: string
  procs: ProcedureT[]
  canEdit: boolean
  categories: CaseType[]
  onChange: (p: ProcedureT[]) => void
}) {
  const { t, lang } = useLang()
  const mine = procs.map((p, i) => ({ p, i })).filter(({ p }) => p.categories.includes(cat))
  const [pick, setPick] = useState(0)
  const [editing, setEditing] = useState(false)
  const cur = mine[Math.min(pick, mine.length - 1)]
  const edit = (fn: (p: ProcedureT) => ProcedureT) => onChange(procs.map((x, i) => (i === cur.i ? fn(x) : x)))
  const add = () => {
    const n: ProcedureT = {
      id: slug(`procedure ${cat} ${Date.now().toString(36)}`),
      title: t('New procedure'),
      categories: [cat],
      stages: [{ title: t('Report received'), who: 'desk' }],
    }
    onChange([...procs, n])
    setPick(mine.length)
    setEditing(true)
  }

  return (
    <Card
      title={t('Procedure')}
      icon="form"
      action={
        canEdit && cur ? (
          <button
            type="button"
            className={editing ? 'primary small' : 'tonal small'}
            onClick={() => setEditing(!editing)}
          >
            <Icon name={editing ? 'check' : 'form'} size={14} /> {editing ? t('Done') : t('Edit steps')}
          </button>
        ) : undefined
      }
    >
      {mine.length > 1 && (
        <div className="samples">
          {mine.map(({ p }, k) => (
            <button key={p.id} className={`chip ${k === pick ? 'on' : ''}`} onClick={() => setPick(k)}>
              {procTitle(p, lang)}
            </button>
          ))}
        </div>
      )}
      {cur ? (
        <>
          {mine.length === 1 && <h3 className="sub-h">{procTitle(cur.p, lang)}</h3>}
          <FlowDiagram stages={cur.p.stages} lang={lang} t={t} />
          {editing && <StepsEditor p={cur.p} edit={edit} categories={categories} />}
          {editing && (
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onChange(procs.filter((_, i) => i !== cur.i))
                setPick(0)
                setEditing(false)
              }}
            >
              {t('Delete this procedure')}
            </button>
          )}
        </>
      ) : (
        <p className="muted small">{t('No procedure yet for this case type.')}</p>
      )}
      {canEdit && (
        <button type="button" className="ghost small" onClick={add}>
          <Icon name="plus" size={14} /> {t('New procedure')}
        </button>
      )}
    </Card>
  )
}

function StepsEditor({
  p,
  edit,
  categories,
}: {
  p: ProcedureT
  edit: (fn: (p: ProcedureT) => ProcedureT) => void
  categories: CaseType[]
}) {
  const { t, lang } = useLang()
  const setStage = (i: number, patch: Partial<ProcedureT['stages'][number]>) =>
    edit((x) => ({ ...x, stages: x.stages.map((y, j) => (j === i ? { ...y, ...patch } : y)) }))
  const move = (i: number, d: number) =>
    edit((x) => {
      const s = [...x.stages]
      ;[s[i], s[i + d]] = [s[i + d], s[i]]
      return { ...x, stages: s }
    })
  return (
    <div className="steps-editor">
      <div className="row2">
        <label className="field">
          <span>{t('Name (English)')}</span>
          <input value={p.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} />
        </label>
        <label className="field">
          <span>{t('Name (Indonesian)')}</span>
          <input value={p.title_id ?? ''} onChange={(e) => edit((x) => ({ ...x, title_id: e.target.value }))} />
        </label>
      </div>
      <h3 className="sub-h">{t('Stages')}</h3>
      <ol className="ct-stages">
        {p.stages.map((s, i) => (
          <li key={i}>
            <span className="pdot">{i + 1}</span>
            <input
              aria-label={t('Stage {n} (English)', { n: i + 1 })}
              value={s.title}
              onChange={(e) => setStage(i, { title: e.target.value })}
            />
            <input
              aria-label={t('Stage {n} (Indonesian)', { n: i + 1 })}
              placeholder={t('Indonesian')}
              value={s.title_id ?? ''}
              onChange={(e) => setStage(i, { title_id: e.target.value })}
            />
            <select
              aria-label={t('Who')}
              value={s.who ?? 'caseworker'}
              onChange={(e) => setStage(i, { who: e.target.value })}
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
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('Move down')}
                disabled={i === p.stages.length - 1}
                onClick={() => move(i, 1)}
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
      <details className="more">
        <summary>{t('What to bring, notes and other case types')}</summary>
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
            <textarea rows={2} value={p.note ?? ''} onChange={(e) => edit((x) => ({ ...x, note: e.target.value }))} />
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
        <fieldset className="ct-cats">
          <legend className="hint">{t('Case types it applies to')}</legend>
          {categories.map((c) => (
            <label key={c.id} className="check">
              <input
                type="checkbox"
                checked={p.categories.includes(c.id!)}
                onChange={(e) =>
                  edit((x) => ({
                    ...x,
                    categories: e.target.checked ? [...x.categories, c.id!] : x.categories.filter((k) => k !== c.id),
                  }))
                }
              />
              {catLabel({ ...c, id: c.id! }, lang)}
            </label>
          ))}
        </fieldset>
      </details>
    </div>
  )
}

/** Rules for every case: response times, safety signals, escalation words and when a person checks the triage. */
function EscalationRules({
  rules,
  canEdit,
  set,
}: {
  rules: Rules
  canEdit: boolean
  set: (p: Partial<Rules>) => void
}) {
  const { t, lang } = useLang()
  const [word, setWord] = useState('')
  const setSignal = (i: number, patch: Partial<Rules['custom_signals'][number]>) =>
    set({ custom_signals: rules.custom_signals.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const addWord = () => {
    const w = word.trim().toLowerCase()
    if (w.length > 1 && !rules.keywords.includes(w)) set({ keywords: [...rules.keywords, w] })
    setWord('')
  }
  return (
    <div className="rules-grid">
      <Card title={t('Respond within')} icon="clock">
        <div className="sla-row">
          {URGENCIES.map((u) => (
            <label key={u} className="sla-cell">
              <span className={`badge urg-${u}`}>{t(URGENCY_LABEL[u])}</span>
              <span className="sla-input">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={rules.sla_hours[u]}
                  disabled={!canEdit}
                  onChange={(e) => set({ sla_hours: { ...rules.sla_hours, [u]: Number(e.target.value) } })}
                />
                {t('h')}
              </span>
              {rules.sla_hours[u] >= 24 && <span className="muted small">= {duration(rules.sla_hours[u], t)}</span>}
            </label>
          ))}
        </div>
      </Card>

      <Card title={t('Always alert the supervisor when the AI sees')} icon="alert">
        <div className="toggles">
          {[
            ...FLAGS,
            ...rules.custom_signals.map((x) => ({
              id: x.id,
              label: lang === 'id' && x.label_id ? x.label_id : x.label,
              icon: 'spark',
              own: true,
            })),
          ].map((f) => {
            const on = rules.flags.includes(f.id)
            return (
              <button
                key={f.id}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={!canEdit}
                className={`toggle ${on ? 'on' : ''}`}
                onClick={() => set({ flags: on ? rules.flags.filter((x) => x !== f.id) : [...rules.flags, f.id] })}
              >
                <Icon name={f.icon} size={16} />
                <span>{'own' in f ? f.label : t(f.label)}</span>
                <span className="switch" aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <p className="muted small">{t('Turn off the signals your agency does not handle, or add its own.')}</p>
        {rules.custom_signals.map((x, i) => (
          <div key={x.id} className="own-signal">
            <div className="row2">
              <label className="field">
                <span>{t('Name (English)')}</span>
                <input value={x.label} disabled={!canEdit} onChange={(e) => setSignal(i, { label: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Name (Indonesian)')}</span>
                <input
                  value={x.label_id}
                  disabled={!canEdit}
                  onChange={(e) => setSignal(i, { label_id: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>{t('When the AI should raise it')}</span>
              <textarea
                rows={2}
                value={x.description}
                disabled={!canEdit}
                placeholder={t('e.g. Tidal flood water has entered homes and families cannot stay tonight.')}
                onChange={(e) => setSignal(i, { description: e.target.value })}
              />
            </label>
            {canEdit && (
              <button
                type="button"
                className="ghost small danger"
                onClick={() =>
                  set({
                    custom_signals: rules.custom_signals.filter((_, j) => j !== i),
                    flags: rules.flags.filter((f) => f !== x.id),
                  })
                }
              >
                {t('Remove this signal')}
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              const id = `x_${Date.now().toString(36)}`
              set({
                custom_signals: [
                  ...rules.custom_signals,
                  { id, label: t('New signal'), label_id: '', description: '' },
                ],
                flags: [...rules.flags, id],
              })
            }}
          >
            <Icon name="plus" size={14} /> {t('Add a signal')}
          </button>
        )}
      </Card>

      <Card title={t('Escalation words')} icon="chat">
        <p className="muted small">{t('A report with any of these words always alerts the supervisor.')}</p>
        <div className="word-chips">
          {rules.keywords.map((k) => (
            <span key={k} className="chip-s">
              {k}
              {canEdit && (
                <button
                  type="button"
                  aria-label={t('Remove {word}', { word: k })}
                  onClick={() => set({ keywords: rules.keywords.filter((x) => x !== k) })}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault()
              addWord()
            }}
          >
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder={t('Add a word, then Enter')} />
            <button className="tonal small" disabled={word.trim().length < 2}>
              {t('Add')}
            </button>
          </form>
        )}
      </Card>

      <Card title={t('Manual review')} icon="eye">
        <label className="field">
          <span>
            {t('A person checks the triage when the AI is less than {n}% sure', {
              n: Math.round(rules.confidence_floor * 100),
            })}
          </span>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={rules.confidence_floor}
            disabled={!canEdit}
            onChange={(e) => set({ confidence_floor: Number(e.target.value) })}
          />
        </label>
        <p className="muted small">{t('Escalation is decided by these rules in code, never by the AI alone.')}</p>
      </Card>
    </div>
  )
}
