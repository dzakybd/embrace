'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, type Agency, type NewAgency, type TeamMember, type Urgency } from './api'
import { save } from './storage'
import { Card, Icon } from './ui'
import { useT } from './Lang'
import { useAgencies } from './useAgencies'

type Cat = NewAgency['categories'][number]
type Member = NewAgency['team'][number]
type Doc = NewAgency['docs'][number] & { size: number }

const ROLE_LABEL: Record<TeamMember['role'], string> = {
  leader: 'Head of office',
  supervisor: 'Supervisor',
  officer: 'Caseworker',
}
const MAX_PDF = 4 * 1024 * 1024
const URGENCIES: Urgency[] = ['critical', 'high', 'normal', 'low']
const FLAG_LABEL: Record<string, string> = {
  child_safety: 'A child is unsafe',
  immediate_danger: 'Someone is in danger now',
  self_harm: 'Self-harm or suicide risk',
  basic_needs_crisis: 'No food or shelter today',
  repeat_complaint: 'Repeat complaint',
  possible_fraud: 'Possible fraud',
  insufficient_info: 'Not enough information',
}

/** A new agency's settings, copied from a template without its names, staff ids or documents. */
function settingsOf(t: Agency) {
  return {
    name: '',
    short: '',
    country: t.country,
    description: '',
    nameId: '',
    shortId: '',
    descId: '',
    signature: '',
    cats: t.categories.map(
      (c): Cat => ({
        label: c.label,
        team: t.queues[c.queue] ?? c.queue,
        escalate: t.escalation.always_escalate_categories.includes(c.id),
        min_urgency: c.min_urgency === 'critical' ? undefined : c.min_urgency,
      }),
    ),
    team: t.team.map(
      (m): Member => ({
        name: m.name,
        role: m.role,
        title: m.title,
        teams: m.queues.map((q) => t.queues[q] ?? q),
      }),
    ),
    keywords: t.escalation.keywords.join(', '),
    flags: t.escalation.escalate_flags,
    sla: t.sla_hours,
    floor: t.escalation.confidence_floor ?? 0.7,
  }
}

const toBase64 = async (f: File) => {
  const bytes = new Uint8Array(await f.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Creates a new agency from a template: its profile, rules, case types, staff and documents. Once created, each part
 * is edited where it is used (Settings, Case types, Knowledge base). */
export default function AgencyForm() {
  const tr = useT()
  const router = useRouter()
  const { templates } = useAgencies()
  const [template, setTemplate] = useState('')
  const [f, setF] = useState<ReturnType<typeof settingsOf> | null>(null)
  const [keepDocs, setKeepDocs] = useState(true)
  const [docs, setDocs] = useState<Doc[]>([])
  const [paste, setPaste] = useState({ title: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const apply = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setTemplate(id)
    setF(settingsOf(t))
  }
  useEffect(() => {
    if (!template && templates.length) apply(templates[0].id)
  })

  if (!f)
    return (
      <div className="new-agency">
        <div className="shimmer tall" />
      </div>
    )
  const set = (patch: Partial<typeof f>) => {
    setF({ ...f, ...patch })
  }
  const teams = [...new Set(f.cats.map((c) => c.team.trim()).filter(Boolean))]
  const setCat = (i: number, c: Partial<Cat>) => set({ cats: f.cats.map((x, j) => (j === i ? { ...x, ...c } : x)) })
  const setMember = (i: number, m: Partial<Member>) =>
    set({ team: f.team.map((x, j) => (j === i ? { ...x, ...m } : x)) })

  const addFiles = async (files: FileList | null) => {
    setErr('')
    for (const file of Array.from(files ?? [])) {
      const title = file.name.replace(/\.[^.]+$/, '').replaceAll(/[-_]+/g, ' ')
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size > MAX_PDF) {
          setErr(tr('{name} is larger than 4 MB', { name: file.name }))
          continue
        }
        const pdf_base64 = await toBase64(file)
        setDocs((d) => [...d, { title, text: '', pdf_base64, size: file.size }])
      } else {
        const text = await file.text()
        setDocs((d) => [...d, { title, text, size: file.size }])
      }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const allDocs = paste.text.trim()
        ? [...docs, { title: paste.title || 'Pasted document', text: paste.text, size: paste.text.length }]
        : docs
      const body: NewAgency = {
        template,
        name: f.name,
        short_name: f.short,
        country: f.country,
        description: f.description,
        name_id: f.nameId,
        short_name_id: f.shortId,
        description_id: f.descId,
        reply_signature: f.signature || `Complaints desk, ${f.name}`,
        categories: f.cats.filter((c) => c.label.trim() && c.team.trim()),
        team: f.team
          .filter((m) => m.name.trim())
          .map((m) => ({ ...m, teams: m.role === 'officer' ? m.teams.filter((t) => teams.includes(t)) : [] })),
        keywords: f.keywords
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 1),
        escalate_flags: f.flags,
        sla_hours: f.sla,
        confidence_floor: f.floor,
        keep_template_docs: keepDocs,
        docs: allDocs.map(({ title, text, pdf_base64 }) => ({ title, text, pdf_base64 })),
      }
      const created = await api.createAgency(body)
      save('agency', created.id)
      router.push(`/a/${created.id}`)
    } catch (e2) {
      const msg = String(e2).replace(/^Error: \d+ /, '')
      try {
        setErr(JSON.parse(msg).error)
      } catch {
        setErr(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const tpl = templates.find((t) => t.id === template)
  return (
    <form className="new-agency" onSubmit={submit}>
      <>
        <div>
          <h1>{tr('Create an agency')}</h1>
          <p className="muted">
            {tr(
              'Every social services desk runs on the same agents; only its rules, categories, teams, staff and documents change.',
            )}
          </p>
        </div>
        <Card title={tr('1. Start from')} icon="building">
          <label className="field">
            <span>{tr('Template (copies categories, teams, roles and rules)')}</span>
            <select value={template} onChange={(e) => apply(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {tpl?.description && <p className="hint">{tpl.description}</p>}
        </Card>
      </>

      <Card title={tr('2. Agency')} icon="home">
        <div className="grid2">
          <label className="field">
            <span>{tr('Full name')}</span>
            <input
              required
              value={f.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Department of Social Welfare, Cebu City"
            />
          </label>
          <label className="field">
            <span>{tr('Short name')}</span>
            <input
              required
              value={f.short}
              onChange={(e) => set({ short: e.target.value })}
              placeholder="e.g. DSWD Cebu"
              maxLength={40}
            />
          </label>
          <label className="field">
            <span>{tr('Country')}</span>
            <input required value={f.country} onChange={(e) => set({ country: e.target.value })} />
          </label>
          <label className="field">
            <span>{tr('Reply signature')}</span>
            <input
              value={f.signature}
              onChange={(e) => set({ signature: e.target.value })}
              placeholder={f.name ? `Complaints desk, ${f.name}` : 'Complaints desk, …'}
            />
          </label>
          <label className="field">
            <span>{tr('What the agency does (optional)')}</span>
            <input value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={400} />
          </label>
          <label className="field">
            <span>{tr('Full name in Indonesian (optional)')}</span>
            <input value={f.nameId} onChange={(e) => set({ nameId: e.target.value })} maxLength={160} />
          </label>
          <label className="field">
            <span>{tr('Short name in Indonesian (optional)')}</span>
            <input value={f.shortId} onChange={(e) => set({ shortId: e.target.value })} maxLength={40} />
          </label>
          <label className="field">
            <span>{tr('What the agency does, in Indonesian (optional)')}</span>
            <input value={f.descId} onChange={(e) => set({ descId: e.target.value })} maxLength={400} />
          </label>
        </div>
      </Card>

      <Card title={tr('3. Rules')} icon="shield">
        <p className="hint">
          {tr(
            'Deterministic rules decide escalation, never the AI alone. A caseworker always approves every reply before it is sent.',
          )}
        </p>
        <div className="sla-grid">
          {URGENCIES.map((u) => (
            <label key={u} className="field">
              <span>{tr('Respond within (hours), {u}', { u: tr(u) })}</span>
              <input
                type="number"
                min={1}
                max={2000}
                required
                value={f.sla[u]}
                onChange={(e) => set({ sla: { ...f.sla, [u]: Number(e.target.value) } })}
              />
            </label>
          ))}
        </div>
        <fieldset className="flags">
          <legend className="hint">{tr('Safety signals from the AI that always alert the supervisor')}</legend>
          {Object.entries(FLAG_LABEL).map(([id, label]) => (
            <label key={id} className="check">
              <input
                type="checkbox"
                checked={f.flags.includes(id)}
                onChange={(e) => set({ flags: e.target.checked ? [...f.flags, id] : f.flags.filter((x) => x !== id) })}
              />{' '}
              {tr(label)}
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>{tr('Escalation words (comma separated): a match always alerts the supervisor')}</span>
          <textarea rows={2} value={f.keywords} onChange={(e) => set({ keywords: e.target.value })} />
        </label>
        <label className="field">
          <span>
            {tr('Send to manual review when the AI is less sure than {n}%', { n: Math.round(f.floor * 100) })}
          </span>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={f.floor}
            onChange={(e) => set({ floor: Number(e.target.value) })}
          />
        </label>
      </Card>

      <Card title={tr('4. Categories and the team that handles each')} icon="rules">
        <p className="hint">
          {tr(
            'Per category: the team that gets it, whether it always escalates, and a minimum urgency the AI cannot go below.',
          )}
        </p>
        <div className="rows">
          {f.cats.map((c, i) => (
            <div key={i} className="row cat">
              <input
                value={c.label}
                onChange={(e) => setCat(i, { label: e.target.value })}
                aria-label={tr('Category')}
                placeholder={tr('Category')}
              />
              <input
                value={c.team}
                onChange={(e) => setCat(i, { team: e.target.value })}
                aria-label={tr('Team')}
                placeholder={tr('Team')}
                list="teams"
              />
              <select
                value={c.min_urgency ?? ''}
                onChange={(e) => setCat(i, { min_urgency: (e.target.value || undefined) as Cat['min_urgency'] })}
                aria-label={tr('Minimum urgency')}
                disabled={c.escalate}
              >
                <option value="">{tr('Any urgency')}</option>
                <option value="normal">{tr('At least normal')}</option>
                <option value="high">{tr('At least high')}</option>
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={c.escalate}
                  onChange={(e) => setCat(i, { escalate: e.target.checked })}
                />{' '}
                {tr('Always escalate')}
              </label>
              <button
                type="button"
                className="ghost small"
                onClick={() => set({ cats: f.cats.filter((_, j) => j !== i) })}
                aria-label={tr('Remove category')}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
        <datalist id="teams">
          {teams.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          type="button"
          className="small"
          onClick={() =>
            set({
              cats: [
                ...f.cats,
                { id: undefined, label: '', team: teams[0] ?? '', escalate: false, min_urgency: undefined },
              ],
            })
          }
        >
          <Icon name="plus" size={14} /> {tr('Add category')}
        </button>
      </Card>

      <Card title={tr('5. Staff')} icon="user">
        <p className="hint">
          {tr(
            'Needs a head of office, a supervisor (receives escalations) and caseworkers (each in charge of one or more teams). Use made-up names; clear a name to drop that row.',
          )}
        </p>
        <div className="rows">
          {f.team.map((m, i) => (
            <div key={i} className="row member">
              <input
                value={m.name}
                onChange={(e) => setMember(i, { name: e.target.value })}
                aria-label={tr('Name')}
                placeholder={tr('Name')}
              />
              <select
                value={m.role}
                onChange={(e) => setMember(i, { role: e.target.value as Member['role'] })}
                aria-label={tr('Role')}
              >
                {Object.entries(ROLE_LABEL).map(([r, l]) => (
                  <option key={r} value={r}>
                    {tr(l)}
                  </option>
                ))}
              </select>
              <input
                value={m.title}
                onChange={(e) => setMember(i, { title: e.target.value })}
                aria-label={tr('Job title')}
                placeholder={tr('Job title')}
              />
              {m.role === 'officer' ? (
                <select
                  multiple
                  value={m.teams}
                  onChange={(e) => setMember(i, { teams: Array.from(e.target.selectedOptions, (o) => o.value) })}
                  aria-label={tr('Teams')}
                  size={Math.min(3, Math.max(1, teams.length))}
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="hint">
                  {m.role === 'supervisor' ? tr('Gets every escalation') : tr('Sees Insights and Settings')}
                </span>
              )}
              <button
                type="button"
                className="ghost small"
                onClick={() => set({ team: f.team.filter((_, j) => j !== i) })}
                aria-label={tr('Remove person')}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="small"
          onClick={() =>
            set({
              team: [...f.team, { id: undefined, name: '', role: 'officer' as const, title: 'Caseworker', teams: [] }],
            })
          }
        >
          <Icon name="plus" size={14} /> {tr('Add person')}
        </button>
      </Card>

      <Card title={tr('6. Knowledge: SOPs, service flows, regulations')} icon="book">
        <p className="hint">
          {tr(
            'The SOP agent searches these documents and the drafter cites them. Upload PDF (with a text layer, up to 4 MB), Markdown or text, or paste text.',
          )}
        </p>
        <label className="check">
          <input type="checkbox" checked={keepDocs} onChange={(e) => setKeepDocs(e.target.checked)} />{' '}
          {tr('Keep the template’s documents')}
        </label>
        <input
          type="file"
          multiple
          accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
          aria-label={tr('Upload documents')}
        />
        {docs.map((d, i) => (
          <div key={i} className="doc">
            <span>
              <Icon name="plus" size={14} /> {d.title}{' '}
              <span className="muted small">
                ({Math.round(d.size / 1024)} KB{d.pdf_base64 ? ', PDF' : ''})
              </span>
            </span>
            <button
              type="button"
              className="ghost small"
              onClick={() => setDocs(docs.filter((_, j) => j !== i))}
              aria-label={tr('Remove document')}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        <div className="grid2">
          <label className="field">
            <span>{tr('Pasted document title')}</span>
            <input value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>{tr('Or paste a procedure')}</span>
          <textarea rows={4} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
        </label>
      </Card>

      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      <div className="form-actions">
        <button className="primary" disabled={busy || !template}>
          {busy ? tr('Saving…') : tr('Create agency')}
        </button>
        <span className="muted small">
          {tr('Demo: created agencies are public to everyone using this prototype; use made-up staff names.')}
        </span>
      </div>
    </form>
  )
}
