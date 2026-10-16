'use client'

import Link from 'next/link'
import { Fragment, useRef, useState } from 'react'
import { submitComplaint, type Attachment, type Channel, type Citation, type Draft, type Intake as IntakeT, type Media, type Policy, type Ticket, type TraceStep, type Triage } from '../api'
import { useAgencies } from '../useAgencies'
import { AGENT_META, CHANNEL_ICON, CHANNEL_LABEL, Citations, Icon, TELEGRAM_URL, UrgencyBadge } from '../ui'

const SAMPLES: Record<string, { label: string; channel: Channel; text: string }[]> = {
  child_protection: [
    {
      label: 'Child in danger (WhatsApp)',
      channel: 'whatsapp',
      text: 'pls help, my nephew is 9 and his stepdad hits him with a belt, yesterday his back was bleeding. they still live together in Eastfield. im scared it happens again tonight. my number 0812 3345 7781',
    },
    {
      label: 'School bullying, Spanish (email)',
      channel: 'email',
      text: 'Hola, mi hija está en 4º grado en Riverside Primary y lleva dos semanas sin querer ir a la escuela porque los niños mayores la acosan. Ya avisamos a la maestra pero no hicieron nada. ¿Qué podemos hacer? Gracias, Ana Torres',
    },
    {
      label: 'Info request (social)',
      channel: 'social',
      text: 'Hi admin, can your office also advise on child custody after a divorce? What are your opening hours?',
    },
  ],
  social_services: [
    {
      label: 'Family without food, Tagalog (WhatsApp)',
      channel: 'whatsapp',
      text: 'Magandang araw po, nanay po ako ng 3 anak sa Southbank. Tatlong buwan na po hindi dumarating ang cash grant namin, ubos na po ang bigas ngayon, wala na po kaming maluto para sa mga bata. May sakit pa po ang asawa ko.',
    },
    {
      label: 'Food voucher missing (web)',
      channel: 'web',
      text: 'I live on Maple Street in Northgate. My food voucher for this month has not arrived on my card, but my neighbours on the same street already collected theirs at the shop. Please check if I am still on the list.',
    },
    {
      label: 'Flood, no shelter tonight (WhatsApp)',
      channel: 'whatsapp',
      text: 'water is inside our house in Riverbend and still rising, my father is in a wheelchair. we have nowhere to go tonight. please help us',
    },
  ],
  id_demak: [
    {
      label: 'Family without food, Indonesian (WhatsApp)',
      channel: 'whatsapp',
      text: 'Assalamualaikum pak, sy ibu 3 anak di Bonang. PKH sy udh 3 bulan ga cair, hari ini beras udh habis bener2 ga ada yg bisa dimasak buat anak2. suami kerja serabutan lg sakit. mohon bantuannya',
    },
    {
      label: 'BPNT not received (web)',
      channel: 'web',
      text: 'Saya warga Desa Wonosalam RT 03. BPNT tahap ini belum masuk ke KKS saya, padahal tetangga satu RT sudah bisa ambil di e-warong. Mohon dicek apakah nama saya masih terdaftar.',
    },
    {
      label: 'Javanese, asking for help (social)',
      channel: 'social',
      text: 'Nuwun sewu, simbah kulo sampun sepuh tur mboten saged mlampah, tasih urung pikantuk bantuan nopo-nopo. Pripun carane ndaftar? Kulo saking Karangtengah.',
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
      if (f.size > MAX_BYTES) { setError(`${f.name} is larger than 7 MB`); continue }
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
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const a = await toAttachment(new Blob(chunks, { type: rec.mimeType }), 'Voice note')
        setFiles((fs) => [...fs, a].slice(0, 3))
      }
      rec.start()
      recorder.current = rec
      setRecording(true)
    } catch {
      setError('Microphone not available. Attach an audio file instead.')
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

  if (loadError) return <p className="error pad">Could not reach the service: {loadError}</p>
  if (!agency) return <div className="shimmer tall" />

  if (ticketId) {
    const done = byAgent.policy_agent?.output as unknown as Policy | undefined
    const team = done ? agency.queues[done.queue] ?? done.queue : ''
    const progress = [
      { key: 'received', label: 'Report received', ok: true },
      { key: 'read', label: files.length ? 'Reading your message, voice note and photos' : 'Reading your message', ok: !!byAgent.intake_agent },
      { key: 'urgency', label: 'Checking how urgent it is', ok: !!byAgent.triage_agent },
      { key: 'team', label: 'Finding the right team and person', ok: !!byAgent.policy_agent },
      { key: 'reply', label: 'Preparing a first reply for an officer to check', ok: !!byAgent.drafter_agent || !!ticket },
    ]
    return (
      <div className="citizen-done">
        <section className="card done-card">
          <p className="muted small">Report number</p>
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
              <span><b>A supervisor has been alerted now.</b> If anyone is in danger right now, call {agency.emergency_line}.</span>
            </div>
          )}
          {done && (
            <p className="lead">
              Your report is with the <b>{team}</b>. You will hear back within <b>{done.sla_hours} hours</b>.
              {' '}An officer reviews every reply before it is sent.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <Link className="btn" href={`/track/${ticketId}`}>Track this report</Link>
            <button onClick={reset}>Send another report</button>
          </div>
        </section>

        <details className="card staff-view" open={running || undefined}>
          <summary><Icon name="spark" /> Staff view: what the AI agents decided <span className="muted small">(shown for the demo)</span></summary>
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
                      <b>{AGENT_META[a].label}</b>
                      <span className="muted">{AGENT_META[a].role}</span>
                      {s && <span className="ms">{s.kind === 'llm' ? `${(s.ms / 1000).toFixed(1)} s` : s.kind === 'search' ? 'search, no AI' : 'rules'}</span>}
                    </div>
                    {state === 'active' && <div className="shimmer" />}
                    {s && <StepOutput agent={a} out={s.output} />}
                  </div>
                </li>
              )
            })}
          </ol>
          {ticket && <Link className="btn" href={`/staff/cases/${ticket.id}`}>Open the case in the staff workspace →</Link>}
        </details>
      </div>
    )
  }

  return (
    <div className="citizen-form">
      <section className="card intake-form">
        <h1>Report a problem</h1>
        <p className="muted">
          Tell us in your own words and your own language. You can also record a voice note or add a photo.
          If someone is in danger right now, call {agency.emergency_line}.
        </p>
        <a className="tg-banner" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
          <Icon name="send" size={18} />
          <span><b>Prefer to chat?</b> Message us on Telegram: same service, and the officer&apos;s reply comes back to your chat.</span>
        </a>
        <label className="field">
          <span>Send to</span>
          <select value={agency.id} onChange={(e) => pick(e.target.value)}>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <div className="demo-box">
          <span className="muted small">Demo: try a sample report and the channel it arrives on</span>
          <div className="samples" role="group" aria-label="Sample reports">
            {SAMPLES[agency.id]?.map((s) => (
              <button key={s.label} className="chip" onClick={() => { setText(s.text); setChannel(s.channel) }}>
                <Icon name={CHANNEL_ICON[s.channel]} size={14} /> {s.label}
              </button>
            ))}
          </div>
          <fieldset className="channels">
            <legend className="sr">Arrives via</legend>
            {(['web', 'whatsapp', 'email', 'social'] as Channel[]).map((c) => (
              <label key={c} className={channel === c ? 'on' : ''}>
                <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} />
                <Icon name={CHANNEL_ICON[c]} size={14} /> {CHANNEL_LABEL[c]}
              </label>
            ))}
          </fieldset>
        </div>
        <label className="field">
          <span>What happened?</span>
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="What happened, where and when. Any language is fine." />
        </label>
        <div className="attach">
          <span className="attach-h">Voice note or photo (optional)</span>
          <div className="attach-row">
            <label className={`btn tonal small ${files.length >= 3 ? 'disabled' : ''}`}>
              <Icon name="image" size={14} /> Add photo or audio
              <input type="file" accept="image/jpeg,image/png,image/webp,audio/*" multiple hidden
                disabled={files.length >= 3} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            <button type="button" className={`small ${recording ? 'rec' : ''}`} onClick={toggleRecording}
              disabled={!recording && files.length >= 3} aria-pressed={recording}>
              <Icon name={recording ? 'stop' : 'mic'} size={14} /> {recording ? 'Stop recording' : 'Record voice note'}
            </button>
          </div>
          {files.length > 0 && (
            <ul className="files">
              {files.map((f, i) => (
                <li key={f.url}>
                  {f.mime.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <audio controls src={f.url} />}
                  <span className="small">{f.name}</span>
                  <button type="button" className="ghost small" aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="row2">
          <label className="field">
            <span>Your name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Phone or email for the reply (optional)</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
        </div>
        <button className="primary" disabled={running || recording || (text.trim().length < 10 && !files.length)} onClick={submit}>
          {running ? 'Sending…' : 'Send report'}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted small"><Icon name="shield" size={12} /> Your name, phone and ID numbers are hidden from staff by default.</p>
      </section>
    </div>
  )
}

function StepOutput({ agent, out }: { agent: string; out: TraceStep['output'] }) {
  if (agent === 'sop_agent') return <div className="out"><Citations items={out as Citation[]} /></div>
  if (agent === 'media_reader') {
    const o = out as unknown as Media
    return (
      <div className="out">
        {o.transcript && <p><b>Transcript:</b> “{o.transcript}”</p>}
        {o.photo_description && <p><b>Photo:</b> {o.photo_description}</p>}
        {o.safety_concern && <p className="tag flag">Safety concern: {o.safety_reason}</p>}
      </div>
    )
  }
  if (agent === 'intake_agent') {
    const o = out as unknown as IntakeT
    const ents = Object.entries(o.entities ?? {}).filter(([, v]) => v)
    return (
      <div className="out">
        <div className="kv">
          <span>Language</span><b>{o.language}</b>
          {ents.map(([k, v]) => (<Fragment key={k}><span>{k.replace('_', ' ')}</span><b>{v}</b></Fragment>))}
        </div>
        {o.pii_types?.length > 0 && (
          <p className="pii"><Icon name="shield" size={13} /> Personal data masked: {o.pii_types.join(', ')}</p>
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
          <span className="tag">confidence {Math.round(o.confidence * 100)}%</span>
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
      <p className="muted"><b>Next step for officer:</b> {o.next_step}</p>
    </div>
  )
}
