'use client'

import Link from 'next/link'
import { Fragment, useEffect, useRef, useState } from 'react'
import { api, submitComplaint, type Attachment, type Channel, type Citation, type Draft, type Intake as IntakeT, type Media, type Policy, type Ticket, type TraceStep, type Triage } from '../api'
import { QUESTION, type Slot } from '@/lib/details'
import { localize } from '@/lib/i18n'
import { Monogram } from '../AgencyPicker'
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

type Phase = 'compose' | 'running' | 'details' | 'done'

/** The web report desk as a chat, like the agency's Telegram bot: the citizen writes, the agents answer in the thread,
 * and missing details are asked one at a time after the case exists. */
export default function Report() {
  const { t, lang } = useLang()
  const { agencies, agency: raw, pick, error: loadError } = useAgencies()
  const [text, setText] = useState('')
  const [channel, setChannel] = useState<Channel>('web')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [showContact, setShowContact] = useState(false)
  const [phase, setPhase] = useState<Phase>('compose')
  const [sent, setSent] = useState<{ text: string; files: File_[] } | null>(null)
  const [ticketId, setTicketId] = useState('')
  const [steps, setSteps] = useState<TraceStep[]>([])
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File_[]>([])
  const [recording, setRecording] = useState(false)
  const [answers, setAnswers] = useState<{ slot: Slot; text: string }[]>([])
  const [detailsSent, setDetailsSent] = useState<'no' | 'busy' | 'yes'>('no')
  const recorder = useRef<MediaRecorder | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [steps.length, ticket, answers.length, detailsSent, phase])

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

  const missing = ((ticket?.details?.missing ?? []) as Slot[])
  const asking = phase === 'details' ? missing[answers.length] : undefined

  const finishDetails = async (all: { slot: Slot; text: string }[]) => {
    setPhase('done')
    if (!ticket || !all.length) return
    setDetailsSent('busy')
    try {
      await api.details(ticket.id, Object.fromEntries(all.map((a) => [a.slot, a.text])))
      setDetailsSent('yes')
    } catch (e) {
      setError(String(e).replace(/^Error: \d+ /, ''))
      setDetailsSent('no')
    }
  }

  const send = async () => {
    const body = text.trim()
    if (phase === 'details' && asking) {
      if (!body) return
      const all = [...answers, { slot: asking, text: body.slice(0, 300) }]
      setAnswers(all)
      setText('')
      if (all.length >= missing.length) await finishDetails(all)
      return
    }
    setSent({ text: body, files })
    setText('')
    setPhase('running')
    setSteps([])
    setTicket(null)
    setTicketId('')
    setError('')
    let done: Ticket | null = null
    try {
      await submitComplaint(
        agency.id,
        { text: body, channel, reporter_name: name || undefined, reporter_contact: contact || undefined, attachments: files.map(({ mime, data }) => ({ mime, data })) },
        (e) => {
          if (e.type === 'received') setTicketId(e.ticket_id)
          if (e.type === 'step') setSteps((s) => [...s, e])
          if (e.type === 'done') { setTicket(e.ticket); done = e.ticket }
          if (e.type === 'error') setError(e.message)
        },
      )
    } catch (e) {
      setError(String(e))
    }
    setFiles([])
    const t2 = done as Ticket | null
    setPhase(t2?.details?.missing.length ? 'details' : 'done')
  }

  const reset = () => {
    setPhase('compose'); setSent(null); setTicketId(''); setTicket(null); setSteps([]); setText(''); setFiles([])
    setError(''); setAnswers([]); setDetailsSent('no'); setChannel('web')
  }

  if (loadError) return <p className="error pad">{t('Could not reach the service:')} {loadError}</p>
  if (!raw) return <div className="shimmer tall" />
  const agency = localize(raw, lang)
  const tg = telegramUrl(agency.telegram_bot)
  const byAgent = Object.fromEntries(steps.map((s) => [s.agent, s]))
  const order = sent?.files.length || byAgent.media_reader ? ['media_reader', ...ORDER] : ORDER
  const activeIdx = phase === 'running' ? steps.length : -1
  const policy = (ticket?.policy ?? byAgent.policy_agent?.output) as Policy | undefined
  const team = policy ? agency.queues[policy.queue] ?? policy.queue : ''
  const progress = [
    { key: 'read', label: sent?.files.length ? t('Reading your message, voice note and photos') : t('Reading your message'), ok: !!byAgent.intake_agent },
    { key: 'urgency', label: t('Checking how urgent it is'), ok: !!byAgent.triage_agent },
    { key: 'team', label: t('Finding the right team and person'), ok: !!byAgent.policy_agent },
    { key: 'reply', label: t('Preparing a first reply for a caseworker to check'), ok: !!byAgent.drafter_agent || !!ticket },
  ]
  const canSend = phase === 'details' ? !!text.trim() : phase === 'compose' && !recording && (text.trim().length >= 10 || files.length > 0)

  return (
    <div className="chat-desk">
      <header className="chat-head">
        <Monogram agency={{ id: agency.id, short_name: agency.short_name, logo: agency.logo ?? null }} size={40} />
        <div className="chat-who">
          <b>{agency.short_name}</b>
          <select value={raw.id} onChange={(e) => { pick(e.target.value); reset() }} aria-label={t('Send to')} disabled={phase === 'running'}>
            {agencies.map((a) => <option key={a.id} value={a.id}>{localize(a, lang).name}</option>)}
          </select>
        </div>
        {tg && <a className="btn tonal small" href={tg} target="_blank" rel="noreferrer"><ChannelIcon c="telegram" size={16} /> {t('Continue on Telegram')}</a>}
      </header>

      <div className="chat-log" aria-live="polite">
        <Bubble from="bot">
          <p>{t('Hello! Tell us what happened, where and when, in your own words. You can also send a voice note or a photo.')}</p>
          <p className="danger-line"><Icon name="alert" size={14} /> {t('If anyone is in danger right now, call {line}.', { line: agency.emergency_line })}</p>
        </Bubble>

        {phase === 'compose' && !sent && (
          <div className="chat-chips" role="group" aria-label={t('Sample reports')}>
            <span className="muted small">{t('Try a sample report')}</span>
            {SAMPLES[raw.id]?.map((s) => (
              <button key={s.label} className="chip" onClick={() => { setText(s.text); setChannel(s.channel) }}>
                <ChannelIcon c={s.channel} size={14} /> {t(s.label)}
              </button>
            ))}
          </div>
        )}

        {sent && (
          <Bubble from="me">
            {sent.text && <p>{sent.text}</p>}
            {sent.files.map((f) => f.mime.startsWith('image/') ? <img key={f.url} src={f.url} alt={f.name} /> : <audio key={f.url} controls src={f.url} />)}
            {channel !== 'web' && <small className="via"><ChannelIcon c={channel} size={12} /> {t('Demo: arrives as {channel}', { channel: t(CHANNEL_LABEL[channel]) })}</small>}
          </Bubble>
        )}

        {sent && (
          <Bubble from="bot">
            {ticketId ? <p>{t('Thank you. Your report number is')} <b className="tid">{ticketId}</b></p> : <p>{t('Thank you. We received your report and are reading it now…')}</p>}
            <ol className="progress compact">
              {progress.map((p, i) => {
                const active = !p.ok && progress.slice(0, i).every((x) => x.ok) && phase === 'running'
                return <li key={p.key} className={p.ok ? 'ok' : active ? 'active' : ''}><span className="pdot">{p.ok ? <Icon name="check" size={12} /> : i + 1}</span>{p.label}</li>
              })}
            </ol>
          </Bubble>
        )}

        {ticket && policy && (
          <Bubble from="bot">
            {policy.route === 'escalated' && (
              <p className="urgent"><Icon name="alert" size={14} /> <b>{t('A supervisor has been alerted now.')}</b> {t('If anyone is in danger right now, call {line}.', { line: agency.emergency_line })}</p>
            )}
            <p>{t('Your report is with:')} <b>{team}</b>. {t('You will hear back within {h} hours.', { h: policy.sla_hours })} {t('A caseworker reviews every reply before it is sent.')}</p>
            <div className="chat-actions">
              <Link className="btn small" href={`/track/${ticket.id}`}>{t('Track this report')}</Link>
            </div>
          </Bubble>
        )}

        {ticket && missing.slice(0, phase === 'details' ? answers.length + 1 : answers.length).map((slot, i) => (
          <Fragment key={slot}>
            <Bubble from="bot"><p>{i === 0 && <>{t('To help the team act faster:')} </>}{t(QUESTION[slot])}</p></Bubble>
            {answers[i] && <Bubble from="me"><p>{answers[i].text}</p></Bubble>}
          </Fragment>
        ))}

        {detailsSent !== 'no' && (
          <Bubble from="bot"><p>{detailsSent === 'busy' ? t('Adding your answers…') : t('Thank you. Your answers were added and the team is updating the case.')}</p></Bubble>
        )}

        {error && <Bubble from="bot"><p className="error">{error}</p></Bubble>}

        {(steps.length > 0 || phase === 'running') && (
          <details className="card staff-view" open={phase === 'running' || undefined}>
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
        )}
        <div ref={end} />
      </div>

      {phase === 'done' ? (
        <div className="chat-done"><button className="primary" onClick={reset}><Icon name="plus" size={16} /> {t('Send another report')}</button></div>
      ) : (
        <form className="composer" onSubmit={(e) => { e.preventDefault(); if (canSend) send() }}>
          {phase === 'compose' && !sent && showContact && (
            <div className="row2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Your name (optional)')} aria-label={t('Your name (optional)')} />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('Phone or email for the reply (optional)')} aria-label={t('Phone or email for the reply (optional)')} />
            </div>
          )}
          {files.length > 0 && (
            <ul className="files">
              {files.map((f, i) => (
                <li key={f.url}>
                  {f.mime.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <audio controls src={f.url} />}
                  <span className="small">{f.name}</span>
                  <button type="button" className="ghost small" aria-label={t('Remove {name}', { name: f.name })} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="composer-row">
            {phase === 'compose' && (
              <>
                <label className={`icon-btn ${files.length >= 3 ? 'disabled' : ''}`} title={t('Add photo or audio')}>
                  <Icon name="image" size={20} />
                  <input type="file" accept="image/jpeg,image/png,image/webp,audio/*" multiple hidden disabled={files.length >= 3}
                    onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                </label>
                <button type="button" className={`icon-btn ${recording ? 'rec' : ''}`} onClick={toggleRecording} aria-pressed={recording}
                  title={recording ? t('Stop recording') : t('Record voice note')} disabled={!recording && files.length >= 3}>
                  <Icon name={recording ? 'stop' : 'mic'} size={20} />
                </button>
              </>
            )}
            <textarea rows={phase === 'details' ? 1 : 2} value={text} disabled={phase === 'running'} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) send() } }}
              placeholder={phase === 'details' ? t('Type your answer…') : t('What happened, where and when. Any language is fine.')} aria-label={t('Message')} />
            <button className="send" disabled={!canSend} aria-label={t('Send')}><Icon name="send" size={20} /></button>
          </div>
          <div className="composer-foot">
            {phase === 'details'
              ? <button type="button" className="ghost small" onClick={() => finishDetails(answers)}>{t('Skip')}</button>
              : !sent && <button type="button" className="ghost small" onClick={() => setShowContact(!showContact)}>{t('Add name and contact (optional)')}</button>}
            <span className="muted small"><Icon name="shield" size={12} /> {t('Your name, phone and ID numbers are hidden from staff by default.')}</span>
          </div>
        </form>
      )}
    </div>
  )
}

function Bubble({ from, children }: { from: 'bot' | 'me'; children: React.ReactNode }) {
  return <div className={`bubble ${from}`}>{children}</div>
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
