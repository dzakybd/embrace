import { useCallback, useEffect, useState } from 'react'
import { api, type Citation, type Row, type Agency, type Notification, type TeamMember, type Ticket, type TraceStep } from '../api'
import { AGENT_META, CHANNEL_ICON, CHANNEL_LABEL, Card, Citations, Icon, StatusBadge, UrgencyBadge, ago, slaLeft } from '../ui'

const FILTERS = [
  { id: 'mine', label: 'My cases', icon: 'user' },
  { id: 'escalated', label: 'Escalation inbox', icon: 'alert' },
  { id: 'manual_review', label: 'Manual review', icon: 'eye' },
  { id: 'assigned', label: 'Assigned', icon: 'inbox' },
  { id: 'in_progress', label: 'In progress', icon: 'clock' },
  { id: 'resolved', label: 'Resolved', icon: 'check' },
  { id: '', label: 'All', icon: 'rules' },
]

const URG_RANK = { critical: 0, high: 1, normal: 2, low: 3 }

export default function Console({ agency, me, selected }: { agency: Agency; me: TeamMember; selected?: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState(selected ? '' : me.role === 'supervisor' ? 'escalated' : 'mine')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [notes, setNotes] = useState<Notification[]>([])

  const load = useCallback(() => {
    api.notifications(agency.id, me.id).then(setNotes).catch(() => setNotes([]))
    return api.tickets(agency.id).then(setRows)
  }, [agency.id, me.id])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (selected) api.ticket(selected).then(setTicket).catch(() => setTicket(null))
    else setTicket(null)
  }, [selected])

  const open = (r: Row) => r.status !== 'resolved'
  const match = (r: Row, f: string) => (f === 'mine' ? r.assignee === me.id && open(r) : !f || r.status === f)
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => match(r, f.id)).length]))
  const names = Object.fromEntries(agency.team.map((m) => [m.id, m.name]))
  const shown = rows
    .filter((r) => match(r, filter))
    .sort((a, b) =>
      filter === 'resolved' ? b.created_at.localeCompare(a.created_at) :
        (URG_RANK[a.urgency ?? 'low'] - URG_RANK[b.urgency ?? 'low']) || b.created_at.localeCompare(a.created_at))

  const onChange = (t: Ticket) => {
    setTicket(t)
    load()
  }

  return (
    <div className="console">
      <aside className="queues" aria-label="Queues">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            <Icon name={f.icon} /> <span>{f.label}</span> <b className={f.id === 'escalated' && counts[f.id] ? 'hot' : ''}>{counts[f.id]}</b>
          </button>
        ))}
        <div className="notes" aria-label="Notifications">
          <h3><Icon name="bell" size={14} /> Notifications</h3>
          {notes.length === 0 && <p className="muted small">Nothing new for {me.name.split(' ')[0]}.</p>}
          {notes.slice(0, 5).map((n) => (
            <a key={n.id ?? n.at + n.ticket_id} href={`#/console/${n.ticket_id}`} className={`note ${n.kind}`}>
              <span>{n.text}</span>
              <small className="muted">{ago(n.at)} · via Pub/Sub</small>
            </a>
          ))}
        </div>
        <button className="ghost small" onClick={() => api.resetDemo(agency.id).then(load)} title="Restore the synthetic demo data">
          <Icon name="refresh" size={14} /> Reset demo data
        </button>
      </aside>
      <section className="list" aria-label="Tickets">
        {shown.length === 0 && <p className="muted pad">Nothing here.</p>}
        {shown.map((r) => {
          const sla = r.status === 'resolved' ? null : slaLeft(r.created_at, r.sla_hours)
          return (
            <a key={r.id} href={`#/console/${r.id}`} className={`row ${ticket?.id === r.id ? 'on' : ''}`}>
              <div className="row-h">
                <UrgencyBadge u={r.urgency} />
                <span className="muted"><Icon name={CHANNEL_ICON[r.channel]} size={12} /> {ago(r.created_at)}</span>
                {sla && <span className={`sla ${sla.tone}`}>{r.sla_breached ? 'SLA breached' : sla.text}</span>}
              </div>
              <p>{r.summary}</p>
              <div className="row-f">
                <code>{r.id}</code>
                <span>{r.assignee ? names[r.assignee] : agency.queues[r.queue ?? ''] ?? '—'}</span>
              </div>
            </a>
          )
        })}
      </section>
      <section className="detail">
        {ticket ? <Detail key={ticket.id} t={ticket} agency={agency} me={me} onChange={onChange} /> : (
          <div className="empty pad">
            <Icon name="inbox" size={40} />
            <p>Select a ticket. Critical cases sit at the top of the escalation inbox; every ticket shows which agent decided what, and why.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function Detail({ t, agency, me, onChange }: { t: Ticket; agency: Agency; me: TeamMember; onChange: (t: Ticket) => void }) {
  const [reveal, setReveal] = useState(false)
  const [reply, setReply] = useState(t.sent_reply || t.draft?.reply || '')
  const [busy, setBusy] = useState(false)
  const category = agency.categories.find((c) => c.id === t.triage?.category)
  const sla = t.status === 'resolved' ? null : slaLeft(t.created_at, t.policy?.sla_hours, t.responded_at)

  const act = async (action: string, extra: Record<string, string> = {}) => {
    setBusy(true)
    try {
      onChange(await api.act(t.id, { action, officer: me.name, ...extra }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ticket">
      <header className="ticket-h">
        <div>
          <code>{t.id}</code>
          <h1>{t.triage?.summary ?? 'Untriaged complaint'}</h1>
          <div className="tags">
            <StatusBadge s={t.status} />
            <UrgencyBadge u={t.policy?.final_urgency} />
            {category && <span className="tag">{category.label}</span>}
            <span className="tag"><Icon name={CHANNEL_ICON[t.channel]} size={12} /> {CHANNEL_LABEL[t.channel]}</span>
            {sla && <span className={`sla ${sla.tone}`}><Icon name="clock" size={12} /> {sla.text}</span>}
            {t.seeded && <span className="tag muted">synthetic history</span>}
          </div>
        </div>
      </header>

      {t.status === 'escalated' && (
        <div className="banner crit">
          <Icon name="alert" />
          <span>
            Escalated to <b>{agency.escalation_contact}</b>
            {t.alert_delivered_at ? ` — alert delivered via Pub/Sub at ${new Date(t.alert_delivered_at).toLocaleTimeString()}.` : t.alerted_at ? ' — alert queued.' : '.'}
          </span>
        </div>
      )}

      <Card title="Complaint" icon="chat" action={
        <button className="ghost small" onClick={() => setReveal(!reveal)} aria-pressed={reveal}>
          <Icon name="eye" size={14} /> {reveal ? 'Hide personal data' : 'Show original'}
        </button>}>
        <p className="complaint">{reveal ? t.text : (t.intake?.masked_text ?? t.text)}</p>
        {t.media?.transcript && <p className="media-out"><Icon name="mic" size={13} /> <b>Voice note:</b> “{t.media.transcript}”</p>}
        {t.media?.photo_description && <p className="media-out"><Icon name="image" size={13} /> <b>Photo:</b> {t.media.photo_description}</p>}
        {!reveal && t.intake?.pii_types?.length ? (
          <p className="pii"><Icon name="shield" size={13} /> Masked by the intake agent: {t.intake.pii_types.join(', ')}</p>
        ) : null}
      </Card>

      <Delegate t={t} agency={agency} me={me} busy={busy} act={act} />

      <Card title="Reply to citizen" icon="send">
        {t.sent_reply ? (
          <>
            <pre className="draft">{t.sent_reply}</pre>
            <p className="muted"><Icon name="check" size={13} /> Sent {t.responded_at && ago(t.responded_at)}</p>
          </>
        ) : t.draft ? (
          <>
            <p className="muted"><Icon name="spark" size={13} /> Drafted by AI. Edit freely; nothing is sent until you approve.</p>
            <textarea rows={9} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply draft" />
            <p className="muted"><b>Suggested next step:</b> {t.draft.next_step}</p>
            {t.sop && t.sop.length > 0 && (
              <div className="sources"><b className="small">Sources cited in this draft</b><Citations items={t.sop} /></div>
            )}
            <button className="primary" disabled={busy || !reply.trim()} onClick={() => act('send_reply', { reply })}>
              <Icon name="send" size={14} /> Approve &amp; send
            </button>
          </>
        ) : <p className="muted">No draft for this ticket.</p>}
      </Card>

      <div className="actions">
        {t.status !== 'in_progress' && t.status !== 'resolved' && (
          <button disabled={busy} onClick={() => act('start')}>Start handling</button>
        )}
        {t.status !== 'resolved' ? (
          <button disabled={busy} onClick={() => act('resolve')}><Icon name="check" size={14} /> Mark resolved</button>
        ) : (
          <button disabled={busy} onClick={() => act('reopen')}>Reopen</button>
        )}
        <label className="reassign">
          <span>Reassign</span>
          <select value={t.policy?.queue} disabled={busy} onChange={(e) => act('reassign', { queue: e.target.value })}>
            {Object.entries(agency.queues).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>

      <Card title="Agent trace — why this ticket is here" icon="spark">
        {t.trace.length === 0 && t.policy && (
          <p className="muted">Historical ticket: routed by the policy rules from its labels.</p>
        )}
        <ol className="trace">
          {t.trace.map((s) => (
            <li key={s.agent} className={s.kind}>
              <div className="trace-h">
                <b>{AGENT_META[s.agent]?.label ?? s.agent}</b>
                <span className="muted">{s.kind === 'rules' ? 'deterministic rules' : s.kind === 'search' ? 'SOP search, no AI tokens' : `Gemini · ${(s.ms / 1000).toFixed(1)} s`}</span>
              </div>
              <TraceBody agent={s.agent} out={s.output} />
            </li>
          ))}
        </ol>
        {t.policy && (
          <ul className="reasons">{t.policy.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        )}
      </Card>

      <AskSop agency={agency} />

      <Card title="History" icon="clock">
        <ol className="history">
          {t.history.map((h, i) => (
            <li key={i}>
              <span className="muted">{new Date(h.at).toLocaleString()}</span> <b>{h.actor}</b> · {h.action.replace('_', ' ')}
              {h.note && <div className="muted">{h.note}</div>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function TraceBody({ agent, out: raw }: { agent: string; out: TraceStep['output'] }) {
  if (agent === 'sop_agent') {
    const cites = raw as Citation[]
    return <p>{cites.length ? cites.map((c) => `[${c.n}] ${c.doc} ${c.loc}`).join(' · ') : 'No matching SOP passage'}</p>
  }
  const out = raw as Record<string, unknown>
  if (agent === 'media_reader') {
    return <p>{out.transcript ? 'Voice note transcribed' : ''}{out.transcript && out.photo_description ? ' · ' : ''}{out.photo_description ? 'Photo described' : ''}{out.safety_concern ? <> · <b>safety concern</b>: {String(out.safety_reason)}</> : ''}</p>
  }
  if (agent === 'intake_agent') {
    const ents = Object.entries((out.entities as Record<string, string | null>) ?? {}).filter(([, v]) => v)
    return <p>Language <b>{String(out.language)}</b>{ents.map(([k, v]) => <span key={k}> · {k.replace('_', ' ')}: <b>{v}</b></span>)}</p>
  }
  if (agent === 'triage_agent') {
    return (
      <p>
        <b>{String(out.category)}</b> · {String(out.urgency)} · {String(out.sentiment)} · confidence {Math.round(Number(out.confidence) * 100)}%
        <br /><span className="quote">“{String(out.urgency_reason)}”</span>
      </p>
    )
  }
  if (agent === 'policy_agent') return <p>Route <b>{String(out.route).replace('_', ' ')}</b> → queue <b>{String(out.queue)}</b>, SLA {String(out.sla_hours)} h</p>
  return <p>{String(out.next_step ?? '')}</p>
}

function AskSop({ agency }: { agency: Agency }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Omit<Citation, 'n'>[] | null>(null)
  const [busy, setBusy] = useState(false)
  const ask = async () => {
    setBusy(true)
    try {
      setRes((await api.sop(agency.id, q)).results)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="Ask the SOP" icon="book">
      <form className="ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask() }}>
        <label htmlFor="ask-sop" className="sr">Question about the agency&apos;s procedures</label>
        <input id="ask-sop" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. what to do when a payment is late" />
        <button className="primary" disabled={busy || q.trim().length < 3}>Search</button>
      </form>
      {res && <Citations items={res} />}
      <p className="muted small">Searches {agency.short_name}&apos;s SOP and regulation documents directly. No AI tokens used.</p>
    </Card>
  )
}

function Delegate({ t, agency, me, busy, act }: {
  t: Ticket; agency: Agency; me: TeamMember; busy: boolean; act: (action: string, extra?: Record<string, string>) => Promise<void>
}) {
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const pic = agency.team.find((m) => m.id === t.assignee)
  const mine = t.assignee === me.id
  return (
    <Card title="Person in charge" icon="user" className="pic">
      <div className="pic-row">
        <span className="avatar big" aria-hidden="true">{pic?.name[0] ?? '?'}</span>
        <div>
          <b>{pic?.name ?? 'Unassigned'}</b>{mine && <span className="tag you">you</span>}
          <div className="muted small">{pic?.title}</div>
        </div>
      </div>
      <form className="delegate" onSubmit={(e) => { e.preventDefault(); if (to) act('assign', { assignee: to, note }).then(() => { setTo(''); setNote('') }) }}>
        <label className="sr" htmlFor={`to-${t.id}`}>Delegate to</label>
        <select id={`to-${t.id}`} value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}>
          <option value="">Delegate to…</option>
          {agency.team.filter((m) => m.id !== t.assignee).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for them (optional)" aria-label="Handover note" maxLength={300} />
        <button className="primary" disabled={busy || !to}>Delegate</button>
      </form>
      <p className="muted small">They get a notification through Pub/Sub and see the case under My cases.</p>
    </Card>
  )
}
