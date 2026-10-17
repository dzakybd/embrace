'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, type Agency, type NewAgency, type TeamMember } from './api'
import { save } from './storage'
import { Card, Icon } from './ui'
import { useAgencies } from './useAgencies'

type Cat = NewAgency['categories'][number]
type Member = NewAgency['team'][number]
type Doc = NewAgency['docs'][number] & { size: number }

const ROLE_LABEL: Record<TeamMember['role'], string> = { leader: 'Head of office', supervisor: 'Duty supervisor', officer: 'Caseworker' }
const MAX_PDF = 4 * 1024 * 1024

/** Everything the form copies from a template: categories, teams, staff roles, escalation words, emergency line. */
function fromTemplate(t: Agency) {
  return {
    country: t.country,
    emergency_line: t.emergency_line,
    categories: t.categories.map((c) => ({ label: c.label, team: t.queues[c.queue] ?? c.queue, escalate: t.escalation.always_escalate_categories.includes(c.id) })),
    team: t.team.map((m) => ({ name: m.name, role: m.role, title: m.title, teams: m.queues.map((q) => t.queues[q] ?? q) })),
    keywords: t.escalation.keywords.join(', '),
  }
}

const toBase64 = async (f: File) => {
  const bytes = new Uint8Array(await f.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export default function NewAgencyForm() {
  const router = useRouter()
  const { templates } = useAgencies()
  const [template, setTemplate] = useState('')
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [country, setCountry] = useState('')
  const [description, setDescription] = useState('')
  const [emergency, setEmergency] = useState('')
  const [signature, setSignature] = useState('')
  const [cats, setCats] = useState<Cat[]>([])
  const [team, setTeam] = useState<Member[]>([])
  const [keywords, setKeywords] = useState('')
  const [keepDocs, setKeepDocs] = useState(true)
  const [docs, setDocs] = useState<Doc[]>([])
  const [paste, setPaste] = useState({ title: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const apply = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    const f = fromTemplate(t)
    setTemplate(id)
    setCountry(f.country)
    setEmergency(f.emergency_line)
    setCats(f.categories)
    setTeam(f.team)
    setKeywords(f.keywords)
  }
  useEffect(() => {
    if (!template && templates.length) apply(templates.find((t) => t.id === 'social_services')?.id ?? templates[0].id)
  })

  const teams = [...new Set(cats.map((c) => c.team.trim()).filter(Boolean))]
  const setCat = (i: number, f: Partial<Cat>) => setCats(cats.map((c, j) => (j === i ? { ...c, ...f } : c)))
  const setMember = (i: number, f: Partial<Member>) => setTeam(team.map((m, j) => (j === i ? { ...m, ...f } : m)))

  const addFiles = async (files: FileList | null) => {
    setErr('')
    for (const f of Array.from(files ?? [])) {
      const title = f.name.replace(/\.[^.]+$/, '').replaceAll(/[-_]+/g, ' ')
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        if (f.size > MAX_PDF) { setErr(`${f.name} is larger than 4 MB`); continue }
        const pdf_base64 = await toBase64(f)
        setDocs((d) => [...d, { title, text: '', pdf_base64, size: f.size }])
      } else {
        const text = await f.text()
        setDocs((d) => [...d, { title, text, size: f.size }])
      }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const allDocs = paste.text.trim() ? [...docs, { title: paste.title || 'Pasted document', text: paste.text, size: paste.text.length }] : docs
      const created = await api.createAgency({
        template, name, short_name: short, country, description, emergency_line: emergency,
        reply_signature: signature || `Complaints desk, ${name}`,
        categories: cats.filter((c) => c.label.trim() && c.team.trim()),
        team: team.filter((m) => m.name.trim()).map((m) => ({ ...m, teams: m.role === 'officer' ? m.teams.filter((t) => teams.includes(t)) : [] })),
        keywords: keywords.split(',').map((k) => k.trim()).filter((k) => k.length > 1),
        keep_template_docs: keepDocs,
        docs: allDocs.map(({ title, text, pdf_base64 }) => ({ title, text, pdf_base64 })),
      })
      save('agency', created.id)
      router.push('/staff/inbox?as=supervisor')
    } catch (e2) {
      const msg = String(e2).replace(/^Error: \d+ /, '')
      try { setErr(JSON.parse(msg).error) } catch { setErr(msg) }
    } finally {
      setBusy(false)
    }
  }

  const tpl = templates.find((t) => t.id === template)
  return (
    <form className="new-agency" onSubmit={submit}>
      <div>
        <h1>Create an agency</h1>
        <p className="muted">
          Any social services desk, in any country and language, runs on the same agents: only its categories, teams, staff,
          escalation words and documents change. Start from a template, edit, add your own SOPs or regulations, and the
          agency is live on the web form, the Telegram bot and the staff workspace.
        </p>
      </div>

      <Card title="1. Start from" icon="building">
        <label className="field">
          <span>Template (copies categories, teams, roles and escalation rules)</span>
          <select value={template} onChange={(e) => apply(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        {tpl?.description && <p className="hint">{tpl.description}</p>}
      </Card>

      <Card title="2. Agency" icon="home">
        <div className="grid2">
          <label className="field"><span>Full name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Department of Social Welfare, Cebu City" /></label>
          <label className="field"><span>Short name</span><input required value={short} onChange={(e) => setShort(e.target.value)} placeholder="e.g. DSWD Cebu" maxLength={40} /></label>
          <label className="field"><span>Country</span><input required value={country} onChange={(e) => setCountry(e.target.value)} /></label>
          <label className="field"><span>Emergency line given in urgent replies</span><input required value={emergency} onChange={(e) => setEmergency(e.target.value)} /></label>
          <label className="field"><span>Reply signature</span><input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={name ? `Complaints desk, ${name}` : 'Complaints desk, …'} /></label>
          <label className="field"><span>What the agency does (optional)</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} /></label>
        </div>
      </Card>

      <Card title="3. Categories and the team that handles each" icon="rules">
        <p className="hint">Ticked categories always alert the duty supervisor, whatever the AI says.</p>
        <div className="rows">
          {cats.map((c, i) => (
            <div key={i} className="row cat">
              <input value={c.label} onChange={(e) => setCat(i, { label: e.target.value })} aria-label="Category" placeholder="Category" />
              <input value={c.team} onChange={(e) => setCat(i, { team: e.target.value })} aria-label="Team" placeholder="Team" list="teams" />
              <label className="check"><input type="checkbox" checked={c.escalate} onChange={(e) => setCat(i, { escalate: e.target.checked })} /> Always escalate</label>
              <button type="button" className="ghost small" onClick={() => setCats(cats.filter((_, j) => j !== i))} aria-label="Remove category"><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
        <datalist id="teams">{teams.map((t) => <option key={t} value={t} />)}</datalist>
        <button type="button" className="small" onClick={() => setCats([...cats, { label: '', team: teams[0] ?? '', escalate: false }])}><Icon name="plus" size={14} /> Add category</button>
        <label className="field"><span>Escalation words (comma separated, any language)</span><textarea rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} /></label>
      </Card>

      <Card title="4. Staff" icon="user">
        <p className="hint">Needs a head of office, a duty supervisor (receives escalations) and caseworkers (each in charge of one or more teams). Names are demo accounts (made up); clear a name to drop that row.</p>
        <div className="rows">
          {team.map((m, i) => (
            <div key={i} className="row member">
              <input value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} aria-label="Name" placeholder="Name" />
              <select value={m.role} onChange={(e) => setMember(i, { role: e.target.value as Member['role'] })} aria-label="Role">
                {Object.entries(ROLE_LABEL).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
              </select>
              <input value={m.title} onChange={(e) => setMember(i, { title: e.target.value })} aria-label="Job title" placeholder="Job title" />
              {m.role === 'officer'
                ? <select multiple value={m.teams} onChange={(e) => setMember(i, { teams: Array.from(e.target.selectedOptions, (o) => o.value) })} aria-label="Teams" size={Math.min(3, Math.max(1, teams.length))}>
                  {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                : <span className="hint">{m.role === 'supervisor' ? 'Gets every escalation' : 'Sees Insights'}</span>}
              <button type="button" className="ghost small" onClick={() => setTeam(team.filter((_, j) => j !== i))} aria-label="Remove person"><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="small" onClick={() => setTeam([...team, { name: '', role: 'officer', title: 'Caseworker', teams: [] }])}><Icon name="plus" size={14} /> Add person</button>
      </Card>

      <Card title="5. Knowledge: SOPs, service flows, regulations" icon="book">
        <p className="hint">The SOP agent searches these documents (no AI tokens) and the drafter cites them. Upload PDF (with a text layer, up to 4 MB), Markdown or text files, or paste text. Markdown &quot;## &quot; headings become citable sections.</p>
        <label className="check"><input type="checkbox" checked={keepDocs} onChange={(e) => setKeepDocs(e.target.checked)} /> Keep the template&apos;s documents</label>
        <input type="file" multiple accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} aria-label="Upload documents" />
        {docs.map((d, i) => (
          <div key={i} className="doc">
            <span><Icon name="book" size={14} /> {d.title} <span className="muted small">({Math.round(d.size / 1024)} KB{d.pdf_base64 ? ', PDF' : ''})</span></span>
            <button type="button" className="ghost small" onClick={() => setDocs(docs.filter((_, j) => j !== i))} aria-label="Remove document"><Icon name="close" size={14} /></button>
          </div>
        ))}
        <div className="grid2">
          <label className="field"><span>Pasted document title</span><input value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} /></label>
        </div>
        <label className="field"><span>Or paste a procedure</span><textarea rows={5} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} /></label>
      </Card>

      {err && <p className="error" role="alert">{err}</p>}
      <div>
        <button className="primary" disabled={busy || !template}>{busy ? 'Creating…' : 'Create agency'}</button>
        <span className="muted small"> Demo: created agencies are public to everyone using this prototype; use made-up staff names.</span>
      </div>
    </form>
  )
}
