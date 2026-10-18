'use client'

import Link from 'next/link'
import { Fragment, useRef, useState } from 'react'
import { api, submitComplaint, type Attachment, type Channel, type Citation, type Draft, type Intake as IntakeT, type Media, type Policy, type Ticket, type TraceStep, type Triage } from '../api'
import { QUESTION, type Slot } from '@/lib/details'
import { localize } from '@/lib/i18n'
import { useLang, useT } from '../Lang'
import { useAgencies } from '../useAgencies'
import { AGENT_META, ChannelIcon, CHANNEL_LABEL, Citations, Icon, UrgencyBadge, telegramUrl } from '../ui'

const SAMPLES: Record<string, { label: string; channel: Channel; text: string }[]> = {
  dinsos_demak: [
    {
      label: 'Tidal flood, no food (WhatsApp)',
      channel: 'whatsapp',
      text: 'Please help, the tidal flood has been coming into our house in Bedono Village, Sayung since dawn. The water is knee-high and still rising. My father uses a wheelchair, we cannot evacuate and we have not eaten since this morning.',
    },
    {
      label: 'Food aid not received (web)',
      channel: 'web',
      text: 'I live in Wonosalam Village, RT 03. This round of BPNT food aid has not arrived on my KKS card, but my neighbours in the same RT have already collected theirs at the e-warong. Please check if my name is still registered in DTSEN.',
    },
    {
      label: 'In Indonesian: elderly aid (social)',
      channel: 'social',
      text: 'Min, simbah saya sudah sepuh dan tidak bisa jalan jauh, sampai sekarang belum dapat bantuan apa-apa. Bagaimana cara daftarnya? Kami dari Karangtengah.',
    },
  ],
  kpai: [
    {
      label: 'Child beaten at home (WhatsApp)',
      channel: 'whatsapp',
      text: 'Please help KPAI, my neighbour\'s 8-year-old son is beaten with a belt by his stepfather until his back bleeds. They still live together in Bekasi. I am afraid it will happen again tonight.',
    },
    {
      label: 'Sextortion via online game (social)',
      channel: 'social',
      text: '@KPAI_official my 13-year-old daughter is being threatened by someone she met in an online game, who says he will spread her photos unless she sends more. What should we do?',
    },
    {
      label: 'In Indonesian: child support unpaid (email)',
      channel: 'email',
      text: 'Yth. KPAI, mantan suami saya di Surabaya sudah 8 bulan tidak membayar nafkah anak yang diputuskan pengadilan agama. Anak kami dua, usia 5 dan 9 tahun. Apa yang bisa saya lakukan?',
    },
  ],
}

const ORDER = ['intake_agent', 'triage_agent', 'policy_agent', 'sop_agent', 'drafter_agent']
const MAX_BYTES = 7 * 1024 * 1024

type File_ = Attachment & { name: string; url: string }

// Browsers leave the type empty or generic for some audio files; fall back to the extension.
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
  ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm',
}

/** Read a browser file or recording as base64, dropping codec parameters from the MIME type. */
function toAttachment(blob: Blob, name: string): Promise<File_> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({
      name,
      mime: /^(image|audio)\//.test(blob.type) ? blob.type.split(';')[0] : EXT_MIME[name.split('.').pop()!.toLowerCase()] ?? blob.type,
      data: String(r.result).split(',')[1],
      url: URL.createObjectURL(blob),
    })
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export default function Report() {
  const { t, lang } = useLang()
  const { agencies, agency, pick, error: loadError } = useAgencies()
  const [text, setText] = useState('')
  const [channel, setChannel] = useState<Channel>('web')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [running, setRunning] = useState(false)
  const [ticketId, setTicketId] = useState('')
  const [steps, setSteps] = useState<TraceStep[]>([])
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File_[]>([])
  const [recording, setRecording] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)

  const addFiles = async (list: FileList | null) => {
    setError('')
    for (const f of Array.from(list ?? [])) {
      if (f.size > MAX_BYTES) { setError(t('{name} is larger than 7 MB', { name: f.name })); continue }
      const a = await toAttachment(f, f.name)
      setFiles((fs) => [...fs, a].slice(0, 3))
    }
  }

  const toggleRecording = async () => {
    if (recording) { recorder.current?.stop(); return }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        setRecording(false)
        const a = await toAttachment(new Blob(chunks, { type: rec.mimeType }), t('Voice note'))
        setFiles((fs) => [...fs, a].slice(0, 3))
      }
      rec.start()
      recorder.current = rec
      setRecording(true)
    } catch {
      setError(t('Microphone not available. Attach an audio file instead.'))
    }
  }

  const submit = async () => {
    setRunning(true)
    setSteps([])
    setTicket(null)
    setTicketId('')
    setError('')
    try {
      await submitComplaint(
        agency.id,
        {
          text, channel, reporter_name: name || undefined, reporter_contact: contact || undefined,
          attachments: files.map(({ mime, data }) => ({ mime, data })),
        },
        (e) => {
          if (e.type === 'received') setTicketId(e.ticket_id)
          if (e.type === 'step') setSteps((s) => [...s, e])
          if (e.type === 'done') setTicket(e.ticket)
          if (e.type === 'error') setError(e.message)
        },
      )
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const byAgent = Object.fromEntries(steps.map((s) => [s.agent, s]))
  const order = files.length || byAgent.media_reader ? ['media_reader', ...ORDER] : ORDER
  const activeIdx = running ? steps.length : -1
  const reset = () => { setTicketId(''); setTicket(null); setSteps([]); setText(''); setFiles([]); setError('') }

  if (loadError) return <p className="error pad">{t('Could not reach the service:')} {loadError}</p>
  if (!agency) return <div className="shimmer tall" />

  if (ticketId) {
    const done = byAgent.policy_agent?.output as unknown as Policy | undefined
    const team = done ? agency.queues[done.queue] ?? done.queue : ''
    const progress = [
      { key: 'received', label: t('Report received'), ok: true },
      { key: 'read', label: files.length ? t('Reading your message, voice note and photos') : t('Reading your message'), ok: !!byAgent.intake_agent },
      { key: 'urgency', label: t('Checking how urgent it is'), ok: !!byAgent.triage_agent },
      { key: 'team', label: t('Finding the right team and person'), ok: !!byAgent.policy_agent },
      { key: 'reply', label: t('Preparing a first reply for a caseworker to check'), ok: !!byAgent.drafter_agent || !!ticket },
    ]
    return (
      <div className="citizen-done">
        <section className="card done-card">
          <p className="muted small">{t('Report number')}</p>
          <h1 className="tid-big">{ticketId}</h1>
          <ol className="progress">
            {progress.map((p, i) => {
              const active = !p.ok && progress.slice(0, i).every((x) => x.ok) && running
              return (
                <li key={p.key} className={p.ok ? 'ok' : active ? 'active' : ''}>
                  <span className="pdot">{p.ok ? <Icon name="check" size={14} /> : i + 1}</span>{p.label}
                </li>
              )
            })}
          </ol>
          {done && done.route === 'escalated' && (
            <div className="banner crit">
              <Icon name="alert" />
              <span><b>{t('A supervisor has been alerted now.')}</b> {t('If anyone is in danger right now, call {line}.', { line: agency.emergency_line })}</span>
            </div>
          )}
          {done && (
            <p className="lead">
              {t('Your report is with:')} <b>{team}</b>. {t('You will hear back within {h} hours.', { h: done.sla_hours })}
              {' '}{t('A caseworker reviews every reply before it is sent.')}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {ticket && <DetailsCard ticket={ticket} />}
          <div className="actions">
            <Link className="btn" href={`/track/${ticketId}`}>{t('Track this report')}</Link>
            <button onClick={reset}>{t('Send another report')}</button>
          </div>
        </section>

        <details className="card staff-view" open={running || undefined}>
          <summary><Icon name="spark" /> {t('Staff view: what the AI agents decided')} <span className="muted small">{t('(shown for the demo)')}</span></summary>
          <ol className="steps">
            {order.map((a, i) => {
              const s = byAgent[a]
              const state = s ? 'done' : i === activeIdx ? 'active' : 'idle'
              const kindClass = a === 'policy_agent' || a === 'sop_agent' ? 'rules' : ''
              return (
                <li key={a} className={`step ${state} ${kindClass}`}>
                  <div className="dot" aria-hidden="true">{s ? <Icon name="check" size={14} /> : i + 1}</div>
                  <div className="body">
                    <div className="step-h">
                      <b>{t(AGENT_META[a].label)}</b>
                      <span className="muted">{t(AGENT_META[a].role)}</span>
                      {s && <span className="ms">{s.kind === 'llm' ? `${(s.ms / 1000).toFixed(1)} s` : s.kind === 'search' ? t('search, no AI') : t('rules')}</span>}
                    </div>
                    {state === 'active' && <div className="shimmer" />}
                    {s && <StepOutput agent={a} out={s.output} />}
                  </div>
                </li>
              )
            })}
          </ol>
          {ticket && <Link className="btn" href={`/staff/cases/${ticket.id}`}>{t('Open the case in the staff workspace')} →</Link>}
        </details>
      </div>
    )
  }

  return (
    <div className="citizen-form">
      <section className="card intake-form">
        <h1>{t('Report a problem')}</h1>
        <p className="muted">
          {t('Tell us in your own words. You can also record a voice note or add a photo.')}
          {' '}{t('If anyone is in danger right now, call {line}.', { line: agency.emergency_line })}
        </p>
        <div className="reach" role="group" aria-label={t('How do you want to reach us?')}>
          <span className="reach-opt on" aria-current="true"><ChannelIcon c="web" size={20} /> {t('Web form')}</span>
          {agency.telegram_bot && (
            <a className="reach-opt" href={telegramUrl(agency.telegram_bot)!} target="_blank" rel="noreferrer" title={`@${agency.telegram_bot}`}>
              <ChannelIcon c="telegram" size={20} /> Telegram
            </a>
          )}
          {['whatsapp', 'email'].map((c) => (
            <span key={c} className="reach-opt off" aria-disabled="true"><ChannelIcon c={c} size={20} /> {t(CHANNEL_LABEL[c])} <small className="soon">{t('Soon')}</small></span>
          ))}
        </div>
        <label className="field">
          <span>{t('Send to')}</span>
          <select value={agency.id} onChange={(e) => pick(e.target.value)}>
            {agencies.map((a) => <option key={a.id} value={a.id}>{localize(a, lang).name}</option>)}
          </select>
        </label>
        <div className="demo-box">
          <span className="muted small">{t('Demo: try a sample report and the channel it arrives on')}</span>
          <div className="samples" role="group" aria-label={t('Sample reports')}>
            {SAMPLES[agency.id]?.map((s) => (
              <button key={s.label} className="chip" onClick={() => { setText(s.text); setChannel(s.channel) }}>
                <ChannelIcon c={s.channel} size={14} /> {t(s.label)}
              </button>
            ))}
          </div>
          <fieldset className="channels">
            <legend className="sr">{t('Arrives via')}</legend>
            {(['web', 'whatsapp', 'email', 'social'] as Channel[]).map((c) => (
              <label key={c} className={channel === c ? 'on' : ''}>
                <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} />
                <ChannelIcon c={c} size={14} /> {t(CHANNEL_LABEL[c])}
              </label>
            ))}
          </fieldset>
        </div>
        <label className="field">
          <span>{t('What happened?')}</span>
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={t('What happened, where and when. Any language is fine.')} />
        </label>
        <div className="attach">
          <span className="attach-h">{t('Voice note or photo (optional)')}</span>
          <div className="attach-row">
            <label className={`btn tonal small ${files.length >= 3 ? 'disabled' : ''}`}>
              <Icon name="image" size={14} /> {t('Add photo or audio')}
              <input type="file" accept="image/jpeg,image/png,image/webp,audio/*" multiple hidden
                disabled={files.length >= 3} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            <button type="button" className={`small ${recording ? 'rec' : ''}`} onClick={toggleRecording}
              disabled={!recording && files.length >= 3} aria-pressed={recording}>
              <Icon name={recording ? 'stop' : 'mic'} size={14} /> {recording ? t('Stop recording') : t('Record voice note')}
            </button>
          </div>
          {files.length > 0 && (
            <ul className="files">
              {files.map((f, i) => (
                <li key={f.url}>
                  {f.mime.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <audio controls src={f.url} />}
                  <span className="small">{f.name}</span>
                  <button type="button" className="ghost small" aria-label={t('Remove {name}', { name: f.name })}
                    onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="row2">
          <label className="field">
            <span>{t('Your name (optional)')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('Phone or email for the reply (optional)')}</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
        </div>
        <button className="primary" disabled={running || recording || (text.trim().length < 10 && !files.length)} onClick={submit}>
          {running ? t('Sending…') : t('Send report')}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted small"><Icon name="shield" size={12} /> {t('Your name, phone and ID numbers are hidden from staff by default.')}</p>
      </section>
    </div>
  )
}

/** Multi-turn intake on the web: asks for the details the agency needs that the report lacked. */
function DetailsCard({ ticket }: { ticket: Ticket }) {
  const t = useT()
  const missing = (ticket.details?.missing ?? []) as Slot[]
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  if (!missing.length) return null
  if (state === 'done') return <p className="ok-note"><Icon name="check" size={14} /> {t('Thank you. Your answers were added and the team is updating the case.')}</p>
  const send = async () => {
    setState('busy')
    setErr('')
    try {
      await api.details(ticket.id, answers)
      setState('done')
    } catch (e) {
      setErr(String(e).replace(/^Error: \d+ /, ''))
      setState('idle')
    }
  }
  return (
    <form className="details-card" onSubmit={(e) => { e.preventDefault(); send() }}>
      <b><Icon name="spark" size={16} /> {t('A few more details help the team act faster')}</b>
      {missing.map((s) => (
        <label key={s} className="field"><span>{t(QUESTION[s])}</span>
          <input value={answers[s] ?? ''} maxLength={300} onChange={(e) => setAnswers({ ...answers, [s]: e.target.value })} />
        </label>
      ))}
      {err && <p className="error">{err}</p>}
      <button className="primary" disabled={state === 'busy' || !Object.values(answers).some((v) => v.trim())}>
        {state === 'busy' ? t('Sending…') : t('Add details')}
      </button>
    </form>
  )
}

function StepOutput({ agent, out }: { agent: string; out: TraceStep['output'] }) {
  const t = useT()
  if (agent === 'sop_agent') return <div className="out"><Citations items={out as Citation[]} /></div>
  if (agent === 'media_reader') {
    const o = out as unknown as Media
    return (
      <div className="out">
        {o.transcript && <p><b>{t('Transcript:')}</b> “{o.transcript}”</p>}
        {o.photo_description && <p><b>{t('Photo:')}</b> {o.photo_description}</p>}
        {o.safety_concern && <p className="tag flag">{t('Safety concern:')} {o.safety_reason}</p>}
      </div>
    )
  }
  if (agent === 'intake_agent') {
    const o = out as unknown as IntakeT
    const ents = Object.entries(o.entities ?? {}).filter(([, v]) => v)
    return (
      <div className="out">
        <div className="kv">
          <span>{t('Language')}</span><b>{o.language}</b>
          {ents.map(([k, v]) => (<Fragment key={k}><span>{k.replace('_', ' ')}</span><b>{v}</b></Fragment>))}
        </div>
        {o.pii_types?.length > 0 && (
          <p className="pii"><Icon name="shield" size={13} /> {t('Personal data masked:')} {o.pii_types.join(', ')}</p>
        )}
      </div>
    )
  }
  if (agent === 'triage_agent') {
    const o = out as unknown as Triage
    return (
      <div className="out">
        <div className="tags">
          <UrgencyBadge u={o.urgency} />
          <span className="tag">{o.category}</span>
          <span className="tag">{o.sentiment}</span>
          {o.flags.map((f) => <span key={f} className="tag flag">{f.replace('_', ' ')}</span>)}
          <span className="tag">{t('confidence {n}%', { n: Math.round(o.confidence * 100) })}</span>
        </div>
        <p className="quote">“{o.urgency_reason}”</p>
      </div>
    )
  }
  if (agent === 'policy_agent') {
    const o = out as unknown as Policy
    return (
      <div className="out">
        <div className="tags">
          <span className={`tag route route-${o.route}`}>{o.route.replace('_', ' ')}</span>
          <UrgencyBadge u={o.final_urgency} />
          <span className="tag">SLA {o.sla_hours} h</span>
        </div>
        <ul className="reasons">{o.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
    )
  }
  const o = out as unknown as Draft
  return (
    <div className="out">
      <pre className="draft">{o.reply}</pre>
      <p className="muted"><b>{t('Next step for the caseworker:')}</b> {o.next_step}</p>
    </div>
  )
}
