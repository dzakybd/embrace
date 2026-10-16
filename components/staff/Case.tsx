'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, type Agency, type Citation, type TeamMember, type Ticket, type TraceStep } from '../api'
import { AGENT_META, CHANNEL_ICON, CHANNEL_LABEL, Card, Citations, Icon, StatusBadge, UrgencyBadge, ago, slaLeft } from '../ui'
import { useStaff } from './StaffProvider'

const TABS = [
  { id: 'case', label: 'Case' },
  { id: 'trace', label: 'Agent trace' },
  { id: 'history', label: 'History' },
]

export default function Case({ id }: { id: string }) {
  const { agency, me, refreshNotes } = useStaff()
  const [t, setT] = useState<Ticket | null>(null)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState('case')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.ticket(id).then(setT).catch(() => setMissing(true))
  }, [id])

  if (missing) return <div className="page"><p className="muted">Case {id} not found. <Link href="/staff/inbox">Back to inbox</Link></p></div>
  if (!t) return <div className="page"><div className="shimmer tall" /></div>
  if (t.agency_id !== agency.id) return <div className="page"><p className="muted">This case belongs to another agency. Switch agency in the top bar.</p></div>

  const act = async (action: string, extra: Record<string, string> = {}) => {
    setBusy(true)
    try {
      setT(await api.act(t.id, { action, officer: me.name, ...extra }))
      refreshNotes()
    } finally {
      setBusy(false)
    }
  }
  const category = agency.categories.find((c) => c.id === t.triage?.category)
  const sla = t.status === 'resolved' ? null : slaLeft(t.created_at, t.policy?.sla_hours, t.responded_at)

  return (
    <div className="page case">
      <Link href="/staff/inbox" className="back"><Icon name="back" size={16} /> Inbox</Link>
      <header className="ticket-h">
        <code>{t.id}</code>
        <h1>{t.triage?.summary ?? 'Untriaged report'}</h1>
        <div className="tags">
          <StatusBadge s={t.status} />
          <UrgencyBadge u={t.policy?.final_urgency} />
          {category && <span className="tag">{category.label}</span>}
          <span className="tag"><Icon name={CHANNEL_ICON[t.channel]} size={12} /> {CHANNEL_LABEL[t.channel]}</span>
          {sla && <span className={`sla ${sla.tone}`}><Icon name="clock" size={12} /> {sla.text}</span>}
          {t.seeded && <span className="tag muted">synthetic history</span>}
        </div>
      </header>
      {t.status === 'escalated' && (
        <div className="banner crit">
          <Icon name="alert" />
          <span>
            Escalated to <b>{agency.escalation_contact}</b>
            {t.alert_delivered_at ? ` · alert delivered via Pub/Sub at ${new Date(t.alert_delivered_at).toLocaleTimeString()}` : t.alerted_at ? ' · alert queued' : ''}
          </span>
        </div>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>

      {tab === 'case' && (
        <div className="case-grid">
          <div className="col">
            <Report t={t} />
            <Reply t={t} busy={busy} act={act} />
          </div>
          <div className="col">
            <Pic t={t} agency={agency} me={me} busy={busy} act={act} />
            <Card title="Actions" icon="rules">
              <div className="actions">
                {t.status !== 'in_progress' && t.status !== 'resolved' && <button disabled={busy} onClick={() => act('start')}>Start handling</button>}
                {t.status !== 'resolved'
                  ? <button disabled={busy} onClick={() => act('resolve')}><Icon name="check" size={14} /> Mark resolved</button>
                  : <button disabled={busy} onClick={() => act('reopen')}>Reopen</button>}
              </div>
              <label className="field">
                <span>Move to another team</span>
                <select value={t.policy?.queue} disabled={busy} onChange={(e) => act('reassign', { queue: e.target.value })}>
                  {Object.entries(agency.queues).map(([qid, name]) => <option key={qid} value={qid}>{name}</option>)}
                </select>
              </label>
            </Card>
            {t.draft?.next_step && (
              <Card title="Suggested next step" icon="spark"><p className="small-body">{t.draft.next_step}</p></Card>
            )}
          </div>
        </div>
      )}
      {tab === 'trace' && <Trace t={t} />}
      {tab === 'history' && (
        <Card title="History" icon="clock">
          <ol className="history">
            {t.history.map((h, i) => (
              <li key={i}>
                <span className="muted">{new Date(h.at).toLocaleString()}</span> <b>{h.actor}</b> · {h.action.replaceAll('_', ' ')}
                {h.note && <div className="muted">{h.note}</div>}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}

function Report({ t }: { t: Ticket }) {
  const [reveal, setReveal] = useState(false)
  return (
    <Card title="Report" icon="chat" action={
      <button className="ghost small" onClick={() => setReveal(!reveal)} aria-pressed={reveal}>
        <Icon name="eye" size={14} /> {reveal ? 'Hide personal data' : 'Show original'}
      </button>}>
      <p className="complaint">{reveal ? t.text : (t.intake?.masked_text ?? t.text)}</p>
      {t.followups?.map((f, i) => (
        <p key={i} className="followup"><Icon name="chat" size={13} /> <b>Follow-up {new Date(f.at).toLocaleString()}:</b> {f.text}</p>
      ))}
      {t.media?.transcript && <p className="media-out"><Icon name="mic" size={13} /> <b>Voice note:</b> “{t.media.transcript}”</p>}
      {t.media?.photo_description && <p className="media-out"><Icon name="image" size={13} /> <b>Photo:</b> {t.media.photo_description}</p>}
      {!reveal && t.intake?.pii_types?.length ? (
        <p className="pii"><Icon name="shield" size={13} /> Masked by the intake agent: {t.intake.pii_types.join(', ')}</p>
      ) : null}
      <p className="muted small">Received {ago(t.created_at)} · {new Date(t.created_at).toLocaleString()}</p>
    </Card>
  )
}

function Reply({ t, busy, act }: { t: Ticket; busy: boolean; act: (a: string, e?: Record<string, string>) => Promise<void> }) {
  const [reply, setReply] = useState(t.sent_reply || t.draft?.reply || '')
  return (
    <Card title="Reply to citizen" icon="send">
      {t.sent_reply ? (
        <>
          <pre className="draft">{t.sent_reply}</pre>
          <p className="muted"><Icon name="check" size={13} /> Sent {t.responded_at && ago(t.responded_at)}</p>
        </>
      ) : t.draft ? (
        <>
          <p className="muted small"><Icon name="spark" size={13} /> Drafted by AI from the agency&apos;s SOP. Edit freely; nothing is sent until you approve.
            {t.telegram_chat_id && <> Approving sends it to the citizen&apos;s <b>Telegram</b> chat.</>}</p>
          <textarea rows={9} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply draft" />
          {t.sop && t.sop.length > 0 && (
            <details className="sources"><summary>Sources cited in this draft ({t.sop.length})</summary><Citations items={t.sop} /></details>
          )}
          <button className="primary" disabled={busy || !reply.trim()} onClick={() => act('send_reply', { reply })}>
            <Icon name="send" size={14} /> Approve &amp; send
          </button>
        </>
      ) : <p className="muted">No draft for this case (historical record).</p>}
    </Card>
  )
}

function Pic({ t, agency, me, busy, act }: {
  t: Ticket; agency: Agency; me: TeamMember; busy: boolean; act: (a: string, e?: Record<string, string>) => Promise<void>
}) {
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const pic = agency.team.find((m) => m.id === t.assignee)
  return (
    <Card title="Person in charge" icon="user">
      <div className="pic-row">
        <span className="avatar big" aria-hidden="true">{pic?.name[0] ?? '?'}</span>
        <div>
          <b>{pic?.name ?? 'Unassigned'}</b>{t.assignee === me.id && <span className="tag you">you</span>}
          <div className="muted small">{pic?.title}</div>
        </div>
      </div>
      <form className="delegate" onSubmit={(e) => { e.preventDefault(); if (to) act('assign', { assignee: to, note }).then(() => { setTo(''); setNote('') }) }}>
        <label className="field">
          <span>Delegate to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}>
            <option value="">Choose a colleague…</option>
            {agency.team.filter((m) => m.id !== t.assignee).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Handover note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={300} />
        </label>
        <button className="primary" disabled={busy || !to}>Delegate</button>
      </form>
      <p className="muted small">They are notified through Pub/Sub and find the case under My cases.</p>
    </Card>
  )
}

function Trace({ t }: { t: Ticket }) {
  return (
    <div className="case-grid">
      <div className="col">
        <Card title="Why this case is here" icon="spark">
          {t.trace.length === 0 && t.policy && <p className="muted">Historical case: routed by the policy rules from its labels.</p>}
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
        </Card>
      </div>
      <div className="col">
        {t.policy && (
          <Card title="Routing decision" icon="rules">
            <div className="tags">
              <span className={`tag route route-${t.policy.route}`}>{t.policy.route.replace('_', ' ')}</span>
              <UrgencyBadge u={t.policy.final_urgency} />
              <span className="tag">SLA {t.policy.sla_hours} h</span>
            </div>
            <ul className="reasons">{t.policy.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </Card>
        )}
        {t.sop && t.sop.length > 0 && <Card title="SOP passages used" icon="book"><Citations items={t.sop} /></Card>}
      </div>
    </div>
  )
}

function TraceBody({ agent, out: raw }: { agent: string; out: TraceStep['output'] }) {
  if (agent === 'sop_agent') {
    const cites = raw as Citation[]
    return <p>{cites.length ? cites.map((c) => `[${c.n}] ${c.doc}, ${c.loc}`).join(' · ') : 'No matching SOP passage'}</p>
  }
  const out = raw as Record<string, unknown>
  if (agent === 'media_reader') {
    return <p>{out.transcript ? `Voice note: “${String(out.transcript)}”` : ''}{out.photo_description ? ` Photo: ${String(out.photo_description)}` : ''}{out.safety_concern ? <> · <b>safety concern</b>: {String(out.safety_reason)}</> : ''}</p>
  }
  if (agent === 'intake_agent') {
    const ents = Object.entries((out.entities as Record<string, string | null>) ?? {}).filter(([, v]) => v)
    return <p>Language <b>{String(out.language)}</b>{ents.map(([k, v]) => <span key={k}> · {k.replace('_', ' ')}: <b>{v}</b></span>)}<br /><span className="muted">{String(out.restated ?? '')}</span></p>
  }
  if (agent === 'triage_agent') {
    return (
      <p>
        <b>{String(out.category)}</b> · {String(out.urgency)} · {String(out.sentiment)} · confidence {Math.round(Number(out.confidence) * 100)}%
        {Array.isArray(out.flags) && out.flags.length > 0 && <> · flags: {(out.flags as string[]).join(', ')}</>}
        <br /><span className="quote">“{String(out.urgency_reason)}”</span>
      </p>
    )
  }
  if (agent === 'policy_agent') return <p>Route <b>{String(out.route).replace('_', ' ')}</b> → queue <b>{String(out.queue)}</b>, SLA {String(out.sla_hours)} h</p>
  return <p>{String(out.next_step ?? '')}</p>
}
