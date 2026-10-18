'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, type Agency, type Citation, type TeamMember, type Ticket, type TraceStep } from '../api'
import {
  AGENT_META,
  ChannelIcon,
  CHANNEL_LABEL,
  Card,
  Citations,
  Icon,
  StatusBadge,
  UrgencyBadge,
  ago,
  slaLeft,
} from '../ui'
import { LABEL, type Slot } from '@/lib/details'
import { useLang, useT } from '../Lang'
import { catLabel, LawLinks, procTitle, stageTitle } from '../Procedures'
import { AGENT_IO } from './AgentMap'
import { LegalResult } from './Knowledge'
import { Avatar } from '../Avatar'
import { useStaff } from './StaffProvider'

const TABS = [
  { id: 'case', label: 'Case' },
  { id: 'trace', label: 'Agent trace' },
  { id: 'history', label: 'Audit trail' },
]

export default function Case({ id }: { id: string }) {
  const { t: tr, lang } = useLang()
  const { agency, me, refreshNotes } = useStaff()
  const [t, setT] = useState<Ticket | null>(null)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState('case')
  const [busy, setBusy] = useState(false)

  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let stop = false
    // Retry transient failures; only a 404 means the case does not exist.
    const load = async (attempt: number): Promise<void> => {
      try {
        const ticket = await api.ticket(id)
        if (!stop) setT(ticket)
      } catch (e) {
        if (stop) return
        if (String(e).startsWith('Error: 404')) setMissing(true)
        else if (attempt < 3) setTimeout(() => load(attempt + 1), 800 * attempt)
        else setFailed(true)
      }
    }
    load(1)
    return () => {
      stop = true
    }
  }, [id])

  if (missing)
    return (
      <div className="page">
        <p className="muted">
          {tr('Case {id} not found.', { id })} <Link href="/staff/inbox">{tr('Back to inbox')}</Link>
        </p>
      </div>
    )
  if (failed)
    return (
      <div className="page">
        <p className="muted">
          {tr('Could not load case {id}.', { id })}{' '}
          <button className="ghost small" onClick={() => location.reload()}>
            {tr('Try again')}
          </button>
        </p>
      </div>
    )
  if (!t)
    return (
      <div className="page">
        <div className="shimmer tall" />
      </div>
    )
  if (t.agency_id !== agency.id)
    return (
      <div className="page">
        <p className="muted">
          {tr('This case belongs to another agency.')} <Link href={`/a/${t.agency_id}`}>{tr('Open its agency')}</Link>.
        </p>
      </div>
    )

  const act = async (action: string, extra: Record<string, string> = {}) => {
    setBusy(true)
    try {
      setT(await api.act(t.id, { action, officer: me.name, ...extra }))
      refreshNotes()
    } finally {
      setBusy(false)
    }
  }
  // The head of office reads cases; caseworkers and the supervisor act on them.
  const readOnly = me.role === 'leader'
  const category = agency.categories.find((c) => c.id === t.triage?.category)
  const sla = t.status === 'resolved' ? null : slaLeft(t.created_at, t.policy?.sla_hours, t.responded_at, tr)

  return (
    <div className="page case">
      <Link href="/staff/inbox" className="back">
        <Icon name="back" size={16} /> {tr('Inbox')}
      </Link>
      <header className="ticket-h">
        <code>{t.id}</code>
        <h1>{t.triage?.summary ?? tr('Untriaged report')}</h1>
        <div className="tags">
          <StatusBadge s={t.status} />
          <UrgencyBadge u={t.policy?.final_urgency} />
          {category && <span className="tag">{catLabel(category, lang)}</span>}
          <span className="tag">
            <ChannelIcon c={t.channel} size={12} /> {tr(CHANNEL_LABEL[t.channel])}
          </span>
          {sla && (
            <span className={`sla ${sla.tone}`}>
              <Icon name="clock" size={12} /> {sla.text}
            </span>
          )}
          {t.seeded && <span className="tag muted">{tr('synthetic history')}</span>}
        </div>
      </header>
      {t.status === 'escalated' && (
        <div className="banner crit">
          <Icon name="alert" />
          <span>
            {tr('Escalated to')} <b>{agency.escalation_contact}</b>
            {t.alert_delivered_at
              ? ` · ${tr('alert delivered via Pub/Sub at {time}', { time: new Date(t.alert_delivered_at).toLocaleTimeString() })}`
              : t.alerted_at
                ? ` · ${tr('alert queued')}`
                : ''}
          </span>
        </div>
      )}
      {!!t.guard?.injection.length && (
        <div className="banner warn">
          <Icon name="shield" />
          <span>
            {tr('Input guardrail: this report contains instructions aimed at the AI, so a person checks its triage.')}{' '}
            <code>{t.guard.injection[0]}</code>
          </span>
        </div>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            className={tab === x.id ? 'on' : ''}
            onClick={() => setTab(x.id)}
          >
            {tr(x.label)}
          </button>
        ))}
      </div>

      {tab === 'case' && (
        <div className="case-grid">
          <div className="col">
            <Report t={t} />
            <Reply t={t} busy={busy} act={act} readOnly={readOnly} />
          </div>
          <div className="col">
            <Pic t={t} agency={agency} me={me} busy={busy} act={act} readOnly={readOnly} />
            <Checklist t={t} agency={agency} officer={me.name} readOnly={readOnly} onChange={setT} />
            <LegalBasis t={t} by={me.name} readOnly={readOnly} onChange={setT} />
            {!readOnly && (
              <Card title={tr('Actions')} icon="rules">
                <div className="actions">
                  {t.status !== 'in_progress' && t.status !== 'resolved' && (
                    <button disabled={busy} onClick={() => act('start')}>
                      {tr('Start handling')}
                    </button>
                  )}
                  {t.status !== 'resolved' ? (
                    <button disabled={busy} onClick={() => act('resolve')}>
                      <Icon name="check" size={14} /> {tr('Mark resolved')}
                    </button>
                  ) : (
                    <button disabled={busy} onClick={() => act('reopen')}>
                      {tr('Reopen')}
                    </button>
                  )}
                </div>
                <label className="field">
                  <span>{tr('Move to another team')}</span>
                  <select
                    value={t.policy?.queue}
                    disabled={busy}
                    onChange={(e) => act('reassign', { queue: e.target.value })}
                  >
                    {Object.entries(agency.queues).map(([qid, name]) => (
                      <option key={qid} value={qid}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </Card>
            )}
            {t.draft?.next_step && (
              <Card title={tr('Suggested next step')} icon="spark">
                <p className="small-body">{t.draft.next_step}</p>
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === 'trace' && <Trace t={t} />}
      {tab === 'history' && (
        <Card title={tr('Audit trail')} icon="clock">
          <p className="muted small">
            {tr(
              'Every action on this case, by whom and when: routing, delegation, procedure stages, replies. The app only ever adds entries.',
            )}
          </p>
          <ol className="history">
            {t.history.map((h, i) => (
              <li key={i}>
                <span className="muted">{new Date(h.at).toLocaleString()}</span> <b>{h.actor}</b> ·{' '}
                {tr(h.action.replaceAll('_', ' '))}
                {h.note && <div className="muted">{h.note}</div>}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}

/** The agency procedure for this kind of case, stage by stage; the citizen sees the same stages on the tracking page. */
function Checklist({
  t,
  agency,
  officer,
  readOnly,
  onChange,
}: {
  t: Ticket
  agency: Agency
  officer: string
  readOnly: boolean
  onChange: (t: Ticket) => void
}) {
  const { t: tr, lang } = useLang()
  const [err, setErr] = useState('')
  const all = agency.procedures ?? []
  const fits = all.filter((p) => p.categories.includes(t.triage?.category ?? ''))
  const options = fits.length ? fits : all
  const [chosen, setChosen] = useState(t.progress?.procedure ?? options[0]?.id ?? '')
  // Ticks show at once; the saved case replaces them when the server answers, or they roll back on an error.
  const [pending, setPending] = useState<number[] | null>(null)
  const proc = all.find((p) => p.id === chosen)
  if (!proc) return null
  const saved = t.progress?.procedure === proc.id ? t.progress.done : []
  const done = pending ?? saved
  const toggle = async (stage: number, on: boolean) => {
    setErr('')
    setPending(on ? [...done, stage] : done.filter((s) => s !== stage))
    try {
      onChange(await api.progress(t.id, { procedure: proc.id, stage, done: on, officer }))
    } catch (e) {
      setErr(String(e))
    }
    setPending(null)
  }
  return (
    <Card
      title={tr('Procedure')}
      icon="rules"
      className="checklist"
      action={
        <Link className="small" href={`/a/${agency.id}/guide#${proc.id}`} target="_blank">
          {tr('Guide')} ↗
        </Link>
      }
    >
      {options.length > 1 ? (
        <select value={proc.id} onChange={(e) => setChosen(e.target.value)} aria-label={tr('Procedure')}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {procTitle(p, lang)}
            </option>
          ))}
        </select>
      ) : (
        <p className="small-body">
          <b>{procTitle(proc, lang)}</b>
        </p>
      )}
      <p className="muted small">{tr('{done} of {n} stages done', { done: done.length, n: proc.stages.length })}</p>
      <ul className="stage-list">
        {proc.stages.map((s, i) => (
          <li key={i}>
            <label className={done.includes(i) ? 'done' : ''}>
              <input
                type="checkbox"
                checked={done.includes(i)}
                disabled={readOnly}
                onChange={(e) => toggle(i, e.target.checked)}
              />
              <span>{stageTitle(s, lang)}</span>
            </label>
          </li>
        ))}
      </ul>
      {caseCategory(agency, t)?.laws?.length ? (
        <div className="proc-sub">
          <b>{tr('Legal basis')}</b>
          <LawLinks shorts={caseCategory(agency, t)!.laws!} docs={[]} />
        </div>
      ) : null}
      {err && (
        <p className="error small" role="alert">
          {err}
        </p>
      )}
    </Card>
  )
}
const caseCategory = (agency: Agency, t: Ticket) => agency.categories.find((c) => c.id === t.triage?.category)

function Report({ t }: { t: Ticket }) {
  const tr = useT()
  const [reveal, setReveal] = useState(false)
  return (
    <Card
      title={tr('Report')}
      icon="chat"
      action={
        <button className="ghost small" onClick={() => setReveal(!reveal)} aria-pressed={reveal}>
          <Icon name="eye" size={14} /> {reveal ? tr('Hide personal data') : tr('Show original')}
        </button>
      }
    >
      <p className="complaint">{reveal ? t.text : (t.intake?.masked_text ?? t.text)}</p>
      {(t.attachments?.length ?? 0) > 0 &&
        (reveal ? (
          <div className="attachments">
            {t.attachments!.map((a, i) =>
              !a.path ? null : a.mime.startsWith('image/') ? (
                <a key={i} href={`/api/tickets/${t.id}/files/${i + 1}`} target="_blank" rel="noreferrer">
                  <img
                    src={`/api/tickets/${t.id}/files/${i + 1}`}
                    alt={tr('Photo {n} from the citizen', { n: i + 1 })}
                  />
                </a>
              ) : (
                <audio key={i} controls preload="none" src={`/api/tickets/${t.id}/files/${i + 1}`} />
              ),
            )}
          </div>
        ) : (
          <p className="muted small">
            <Icon name="image" size={13} />{' '}
            {tr('{n} attachments, hidden with the personal data', { n: t.attachments!.length })}
          </p>
        ))}
      {t.followups?.map((f, i) => (
        <p key={i} className="followup">
          <Icon name="chat" size={13} />{' '}
          <b>
            {tr('Follow-up')} {new Date(f.at).toLocaleString()}:
          </b>{' '}
          {f.text}
        </p>
      ))}
      {t.details && Object.keys(t.details.answers).length > 0 && (
        <div className="followup">
          <Icon name="spark" size={13} /> <b>{tr('Details added by the citizen')}:</b>
          <ul className="reasons">
            {Object.entries(t.details.answers).map(([k, v]) => (
              <li key={k}>
                {tr(LABEL[k as Slot] ?? k)}: {v}
              </li>
            ))}
          </ul>
        </div>
      )}
      {t.details && !Object.keys(t.details.answers).length && t.details.missing.length > 0 && (
        <p className="muted small">
          <Icon name="clock" size={12} /> {tr('Asked the citizen for:')}{' '}
          {t.details.missing.map((k) => tr(LABEL[k as Slot] ?? k)).join(', ')}
        </p>
      )}
      {t.media?.transcript && (
        <p className="media-out">
          <Icon name="mic" size={13} /> <b>{tr('Voice note')}:</b> “{t.media.transcript}”
        </p>
      )}
      {t.media?.photo_description && (
        <p className="media-out">
          <Icon name="image" size={13} /> <b>{tr('Photo:')}</b> {t.media.photo_description}
        </p>
      )}
      {!reveal && t.intake?.pii_types?.length ? (
        <p className="pii">
          <Icon name="shield" size={13} /> {tr('Masked by the intake agent:')} {t.intake.pii_types.join(', ')}
        </p>
      ) : null}
      <p className="muted small">
        {tr('Received')} {ago(t.created_at, tr)} · {new Date(t.created_at).toLocaleString()}
      </p>
    </Card>
  )
}

function Reply({
  t,
  busy,
  act,
  readOnly,
}: {
  t: Ticket
  busy: boolean
  act: (a: string, e?: Record<string, string>) => Promise<void>
  readOnly: boolean
}) {
  const tr = useT()
  const [reply, setReply] = useState(t.sent_reply || t.draft?.reply || '')
  return (
    <Card title={tr('Reply to citizen')} icon="send">
      {t.sent_reply ? (
        <>
          <pre className="draft">{t.sent_reply}</pre>
          <p className="muted">
            <Icon name="check" size={13} /> {tr('Sent')} {t.responded_at && ago(t.responded_at, tr)}
          </p>
        </>
      ) : t.draft ? (
        <>
          <p className="muted small">
            <Icon name="spark" size={13} />{' '}
            {tr('Drafted by AI from the agency SOP. Edit freely; nothing is sent until you approve.')}
            {t.telegram_chat_id && <> {tr('Approving sends it to the citizen’s Telegram chat.')}</>}
          </p>
          {!!t.guard?.draft.length && (
            <div className="banner warn">
              <Icon name="shield" />
              <span>
                <b>{tr('Output guardrail')}:</b> {t.guard.draft.map((w) => tr(w)).join(' · ')}
              </span>
            </div>
          )}
          <textarea
            rows={9}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            aria-label={tr('Reply draft')}
            readOnly={readOnly}
          />
          {t.sop && t.sop.length > 0 && (
            <details className="sources">
              <summary>{tr('Sources cited in this draft ({n})', { n: t.sop.length })}</summary>
              <Citations items={t.sop} />
            </details>
          )}
          {readOnly ? (
            <p className="muted small">
              {tr('Read only: the caseworker in charge or the supervisor approves replies.')}
            </p>
          ) : (
            <button className="primary" disabled={busy || !reply.trim()} onClick={() => act('send_reply', { reply })}>
              <Icon name="send" size={14} /> {tr('Approve & send')}
            </button>
          )}
        </>
      ) : (
        <p className="muted">{tr('No draft for this case (historical record).')}</p>
      )}
    </Card>
  )
}

function Pic({
  t,
  agency,
  me,
  busy,
  act,
  readOnly,
}: {
  t: Ticket
  agency: Agency
  me: TeamMember
  busy: boolean
  act: (a: string, e?: Record<string, string>) => Promise<void>
  readOnly: boolean
}) {
  const tr = useT()
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const pic = agency.team.find((m) => m.id === t.assignee)
  return (
    <Card title={tr('Person in charge')} icon="user">
      <div className="pic-row">
        <Avatar agency={agency.id} id={pic?.id} name={pic?.name} big />
        <div>
          <b>{pic?.name ?? tr('Unassigned')}</b>
          {t.assignee === me.id && <span className="tag you">{tr('you')}</span>}
          <div className="muted small">{pic?.title}</div>
        </div>
      </div>
      {!readOnly && (
        <>
          <form
            className="delegate"
            onSubmit={(e) => {
              e.preventDefault()
              if (to)
                act('assign', { assignee: to, note }).then(() => {
                  setTo('')
                  setNote('')
                })
            }}
          >
            <label className="field">
              <span>{tr('Delegate to')}</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}>
                <option value="">{tr('Choose a colleague…')}</option>
                {agency.team
                  .filter((m) => m.id !== t.assignee)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>{tr('Handover note')}</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr('Optional')}
                maxLength={300}
              />
            </label>
            <button className="primary" disabled={busy || !to}>
              {tr('Delegate')}
            </button>
          </form>
          <p className="muted small">{tr('They are notified through Pub/Sub and find the case under My cases.')}</p>
        </>
      )}
    </Card>
  )
}

const PROJECT = 'embrace-23a9c'
const KIND_LABEL: Record<string, string> = { llm: 'Gemini', rules: 'Rules', search: 'Tool' }
const AGENT_ICON: Record<string, string> = {
  media_reader: 'mic',
  intake_agent: 'form',
  triage_agent: 'alert',
  policy_agent: 'rules',
  sop_agent: 'book',
  drafter_agent: 'send',
  draft_check_agent: 'shield',
}

/** The agent run as a conversation: the citizen's report, then each agent saying what it did, with what it read and
 * wrote, model, time and tokens, and a link to its span in Cloud Trace. Guardrails and the caseworker speak too. */
function Trace({ t }: { t: Ticket }) {
  const tr = useT()
  const traceId = t.trace.find((s) => s.trace_id)?.trace_id
  const first = t.trace.filter((s) => !s.rerun)
  const rerun = t.trace.filter((s) => s.rerun)
  const answers = Object.entries(t.details?.answers ?? {}).filter(([, v]) => v)
  return (
    <div className="case-grid">
      <div className="col">
        <Card
          title={tr('Agent conversation')}
          icon="spark"
          action={
            traceId && (
              <a
                className="small"
                href={`https://console.cloud.google.com/traces/explorer;traceId=${traceId}?project=${PROJECT}`}
                target="_blank"
                rel="noreferrer"
              >
                {tr('Cloud Trace')} ↗
              </a>
            )
          }
        >
          {t.trace.length === 0 && t.policy && (
            <p className="muted">{tr('Historical case: routed by the policy rules from its labels.')}</p>
          )}
          <div className="convo">
            <Say who="citizen" name={tr('Citizen')} meta={tr(CHANNEL_LABEL[t.channel])}>
              <p>{t.intake?.masked_text || t.text}</p>
              {(t.attachments?.length ?? 0) > 0 && (
                <p className="muted small">{tr('{n} attachments', { n: t.attachments!.length })}</p>
              )}
            </Say>
            {!!t.guard?.injection.length && (
              <Say who="guard" name={tr('Input guardrail')} meta={tr('Code')}>
                <p>
                  {tr(
                    'This report contains instructions aimed at the AI, so a person checks the triage and the drafter only sees a neutral restatement.',
                  )}
                </p>
                <code>{t.guard.injection[0]}</code>
              </Say>
            )}
            {first.map((s, i) => (
              <AgentSay key={`${s.agent}-${i}`} s={s} t={t} />
            ))}
            {answers.length > 0 && (
              <Say who="citizen" name={tr('Citizen')} meta={tr('answered follow-up questions')}>
                {answers.map(([k, v]) => (
                  <p key={k}>
                    <b>{tr(LABEL[k as Slot] ?? k)}:</b> {v}
                  </p>
                ))}
              </Say>
            )}
            {rerun.map((s, i) => (
              <AgentSay key={`r-${s.agent}-${i}`} s={s} t={t} />
            ))}
            {!!t.guard?.draft.length && (
              <Say who="guard" name={tr('Output guardrail')} meta={tr('Code')}>
                <ul className="reasons">
                  {t.guard.draft.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Say>
            )}
            {t.sent_reply && (
              <Say
                who="human"
                name={t.history.findLast((h) => h.action === 'send_reply')?.actor ?? tr('Caseworker')}
                meta={
                  t.draft && t.draft.reply !== t.sent_reply
                    ? tr('edited and sent the reply')
                    : tr('approved and sent the reply')
                }
              >
                <pre className="draft">{t.sent_reply}</pre>
              </Say>
            )}
          </div>
        </Card>
      </div>
      <div className="col">
        {t.policy && (
          <Card title={tr('Routing decision')} icon="rules">
            <div className="tags">
              <span className={`tag route route-${t.policy.route}`}>{t.policy.route.replace('_', ' ')}</span>
              <UrgencyBadge u={t.policy.final_urgency} />
              <span className="tag">SLA {t.policy.sla_hours} h</span>
            </div>
            <ul className="reasons">
              {t.policy.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        )}
        {t.sop && t.sop.length > 0 && (
          <Card title={tr('SOP passages used')} icon="book">
            <Citations items={t.sop} />
          </Card>
        )}
      </div>
    </div>
  )
}

/** The legal basis of the case for its file, a police referral or court, drafted by the legal research agent from
 * the knowledge base and kept on the case. */
function LegalBasis({
  t,
  by,
  readOnly,
  onChange,
}: {
  t: Ticket
  by: string
  readOnly: boolean
  onChange: (t: Ticket) => void
}) {
  const tr = useT()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const r = t.legal_basis
  if (readOnly && !r) return null
  const draft = async () => {
    setBusy(true)
    setErr('')
    try {
      const legal_basis = await api.askLegal(t.agency_id, { ticket_id: t.id, by })
      onChange({ ...t, legal_basis })
    } catch (e) {
      setErr(String(e).replace(/^Error: \d+ /, ''))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title={tr('Legal basis')} icon="book" className="legal-card">
      {!r && !busy && (
        <p className="muted small">
          {tr(
            'For the case file, a police referral or court: the legal research agent searches the knowledge base and cites the articles that apply.',
          )}
        </p>
      )}
      {busy && <div className="shimmer" />}
      {r && !busy && (
        <>
          <LegalResult r={r} />
          {r.at && (
            <p className="muted small">
              {tr('Drafted {when}', { when: ago(r.at, tr) })}
              {r.by ? ` · ${r.by}` : ''}
            </p>
          )}
        </>
      )}
      {err && <p className="error small">{err}</p>}
      {!readOnly && (
        <div className="copy-row">
          <button className={r ? 'ghost small' : 'tonal small'} disabled={busy} onClick={draft}>
            <Icon name="spark" size={14} />{' '}
            {busy ? tr('Searching…') : r ? tr('Draft again') : tr('Draft the legal basis')}
          </button>
          {r?.answer && (
            <button
              type="button"
              className="ghost small"
              onClick={() => navigator.clipboard?.writeText(r.answer).catch(() => {})}
            >
              {tr('Copy')}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

function Say({
  who,
  name,
  meta,
  icon,
  children,
}: {
  who: string
  name: string
  meta?: React.ReactNode
  icon?: string
  children: React.ReactNode
}) {
  return (
    <div className={`say ${who}`}>
      <span className="say-av" aria-hidden="true">
        <Icon
          name={icon ?? (who === 'citizen' ? 'user' : who === 'guard' ? 'shield' : who === 'human' ? 'check' : 'spark')}
          size={16}
        />
      </span>
      <div className="say-b">
        <div className="say-h">
          <b>{name}</b>
          {meta && <span className="muted small">{meta}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

function AgentSay({ s, t }: { s: TraceStep; t: Ticket }) {
  const tr = useT()
  const io = AGENT_IO[s.agent]
  const meta = (
    <>
      <span className={`am-kind ${s.kind === 'search' ? 'tool' : s.kind}`}>{tr(KIND_LABEL[s.kind] ?? s.kind)}</span>
      {s.model && <code>{s.model}</code>}
      <span>{(s.ms / 1000).toFixed(1)} s</span>
      {s.tokens_in != null && <span>{tr('{a} → {b} tokens', { a: s.tokens_in, b: s.tokens_out ?? 0 })}</span>}
      {s.rerun && <span className="tag">{tr('after details')}</span>}
      {s.fallback && <span className="tag flag">{tr('fallback')}</span>}
    </>
  )
  return (
    <Say
      who={`agent ${s.kind}`}
      name={tr(AGENT_META[s.agent]?.label ?? s.agent)}
      meta={meta}
      icon={AGENT_ICON[s.agent]}
    >
      {s.fallback && (
        <p className="error small">
          {tr('The model call failed, so the keyword rules decided:')} {s.fallback}
        </p>
      )}
      <TraceBody agent={s.agent} out={s.output} t={t} />
      {io && (
        <details className="say-io">
          <summary>{tr('What it read and wrote')}</summary>
          <dl>
            <dt>{tr('Input')}</dt>
            <dd>{tr(io.input)}</dd>
            <dt>{tr('Output')}</dt>
            <dd>{tr(io.output)}</dd>
          </dl>
          <pre className="json">{JSON.stringify(s.output, null, 2)}</pre>
        </details>
      )}
    </Say>
  )
}

function TraceBody({ agent, out: raw, t }: { agent: string; out: TraceStep['output']; t: Ticket }) {
  if (agent === 'sop_agent') {
    const cites = raw as Citation[]
    return (
      <p>{cites.length ? cites.map((c) => `[${c.n}] ${c.doc}, ${c.loc}`).join(' · ') : 'No matching SOP passage'}</p>
    )
  }
  const out = raw as Record<string, unknown>
  if (agent === 'media_reader') {
    return (
      <p>
        {out.transcript ? `Voice note: “${String(out.transcript)}”` : ''}
        {out.photo_description ? ` Photo: ${String(out.photo_description)}` : ''}
        {out.safety_concern ? (
          <>
            {' '}
            · <b>safety concern</b>: {String(out.safety_reason)}
          </>
        ) : (
          ''
        )}
      </p>
    )
  }
  if (agent === 'intake_agent') {
    const ents = Object.entries((out.entities as Record<string, string | null>) ?? {}).filter(([, v]) => v)
    return (
      <p>
        Language <b>{String(out.language)}</b>
        {ents.map(([k, v]) => (
          <span key={k}>
            {' '}
            · {k.replace('_', ' ')}: <b>{v}</b>
          </span>
        ))}
        <br />
        <span className="muted">{String(out.restated ?? '')}</span>
      </p>
    )
  }
  if (agent === 'triage_agent') {
    return (
      <p>
        <b>{String(out.category)}</b> · {String(out.urgency)} · {String(out.sentiment)} · confidence{' '}
        {Math.round(Number(out.confidence) * 100)}%
        {Array.isArray(out.flags) && out.flags.length > 0 && <> · flags: {(out.flags as string[]).join(', ')}</>}
        <br />
        <span className="quote">“{String(out.urgency_reason)}”</span>
      </p>
    )
  }
  if (agent === 'draft_check_agent') {
    const w = (out.warnings as string[] | undefined) ?? []
    return (
      <p>
        {w.length ? (
          <>
            {out.rewrite ? 'Flagged, sent back to the drafter: ' : 'Still flagged after the rewrite: '}
            {w.join('; ')}
          </>
        ) : (
          'Draft passed every check'
        )}
      </p>
    )
  }
  if (agent === 'policy_agent') {
    return (
      <>
        <p>
          Route <b>{String(out.route).replace('_', ' ')}</b> → queue <b>{String(out.queue)}</b>, SLA{' '}
          {String(out.sla_hours)} h
        </p>
        {Array.isArray(out.reasons) && (
          <ul className="reasons">
            {(out.reasons as string[]).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </>
    )
  }
  return (
    <>
      {out.reply ? <pre className="draft">{String(out.reply)}</pre> : null}
      <p>
        <b>Next step:</b> {String(out.next_step ?? '')}
      </p>
      {t.draft && t.sent_reply && t.draft.reply !== t.sent_reply && (
        <p className="muted small">The caseworker edited this draft before sending.</p>
      )}
    </>
  )
}
