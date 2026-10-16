import { Fragment, useRef, useState } from 'react'
import { submitComplaint, type Attachment, type Channel, type Citation, type Draft, type Intake as IntakeT, type Media, type Policy, type Agency, type Ticket, type TraceStep, type Triage } from '../api'
import { AGENT_META, CHANNEL_ICON, CHANNEL_LABEL, Card, Citations, Icon, UrgencyBadge } from '../ui'

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
  social_assistance: [
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
      label: 'Illegal fee (social)',
      channel: 'social',
      text: 'The agent at the Northgate Corner Shop takes 5 dollars from every voucher payment and calls it an admin fee. Is that allowed?',
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

export default function Intake({ agency }: { agency: Agency }) {
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

  return (
    <div className="intake">
      <Card title={`Report to ${agency.short_name}`} icon="send" className="intake-form">
        <p className="muted">
          Citizens write in their own words, in any channel and language. Try a sample, or write your own.
        </p>
        <div className="samples" role="group" aria-label="Sample complaints">
          {SAMPLES[agency.id]?.map((s) => (
            <button key={s.label} className="chip" onClick={() => { setText(s.text); setChannel(s.channel) }}>
              <Icon name={CHANNEL_ICON[s.channel]} size={14} /> {s.label}
            </button>
          ))}
        </div>
        <fieldset className="channels">
          <legend>Arrives via</legend>
          {(['web', 'whatsapp', 'email', 'social'] as Channel[]).map((c) => (
            <label key={c} className={channel === c ? 'on' : ''}>
              <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} />
              <Icon name={CHANNEL_ICON[c]} size={14} /> {CHANNEL_LABEL[c]}
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>Complaint</span>
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Tell us what happened, where and when, in your own words and language…" />
        </label>
        <div className="attach">
          <span className="attach-h">Voice note or photo (optional)</span>
          <div className="attach-row">
            <label className={`btn ghost small ${files.length >= 3 ? 'disabled' : ''}`}>
              <Icon name="image" size={14} /> Attach file
              <input type="file" accept="image/jpeg,image/png,image/webp,audio/*" multiple hidden
                disabled={files.length >= 3} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            <button type="button" className={`ghost small ${recording ? 'rec' : ''}`} onClick={toggleRecording}
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
            <span>Name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Phone / email (optional)</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
        </div>
        <button className="primary" disabled={running || recording || (text.trim().length < 10 && !files.length)} onClick={submit}>
          {running ? 'Agents working…' : 'Submit complaint'}
        </button>
        {error && <p className="error">{error}</p>}
      </Card>

      <Card title="What the agents decide" icon="spark" className="pipeline"
        action={ticketId && <code className="tid">{ticketId}</code>}>
        {!running && !steps.length && (
          <div className="empty">
            <PipelineArt />
            <p>Submit a complaint to watch four agents read it, judge urgency, apply the agency’s rules and draft a reply, live.</p>
          </div>
        )}
        <ol className="steps">
          {order.map((a, i) => {
            const s = byAgent[a]
            const state = s ? 'done' : i === activeIdx ? 'active' : 'idle'
            const kindClass = a === 'policy_agent' || a === 'sop_agent' ? 'rules' : ''
            if (!running && !steps.length) return null
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
        {ticket && (
          <div className={`outcome route-${ticket.status}`}>
            <Icon name={ticket.status === 'escalated' ? 'alert' : 'check'} />
            <div>
              <b>{ticket.status === 'escalated' ? `Escalated: ${agency.escalation_contact} alerted` :
                ticket.status === 'manual_review' ? 'Sent to manual review' :
                  `Assigned to ${agency.queues[ticket.policy?.queue ?? ''] ?? ticket.policy?.queue}`}</b>
              <span>Drafted reply is waiting for an officer to approve it.</span>
            </div>
            <a className="btn" href={`#/console/${ticket.id}`}>Open in console →</a>
          </div>
        )}
      </Card>
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

function PipelineArt() {
  return (
    <svg viewBox="0 0 360 120" className="art" role="img" aria-label="Messages flow through four agents into queues">
      <g fill="none" stroke="var(--line)" strokeWidth="2">
        <path d="M40 30 C90 30 90 60 130 60 M40 60 H130 M40 90 C90 90 90 60 130 60" />
        <path d="M290 60 C310 60 310 30 330 30 M290 60 H330 M290 60 C310 60 310 90 330 90" />
      </g>
      {[[28, 30, 'chat'], [28, 60, 'mail'], [28, 90, 'globe']].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="11" fill="var(--surface-2)" stroke="var(--line)" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={132 + i * 40} y="44" width="32" height="32" rx="9"
            fill={i === 2 ? 'var(--surface-2)' : 'var(--brand)'} stroke={i === 2 ? 'var(--brand)' : 'none'} strokeWidth="2" />
          <circle cx={148 + i * 40} cy="60" r="5" fill={i === 2 ? 'var(--brand)' : 'var(--accent)'}>
            <animate attributeName="opacity" values="1;.3;1" dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      <circle cx="336" cy="30" r="7" fill="var(--crit)" />
      <circle cx="336" cy="60" r="7" fill="var(--brand)" />
      <circle cx="336" cy="90" r="7" fill="var(--muted)" />
    </svg>
  )
}
