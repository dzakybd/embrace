'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type Integrations as Status } from '../api'
import { Card, Icon } from '../ui'
import { useStaff } from './StaffProvider'

/** Channels that are not wired in this prototype yet: what each needs, all feeding the same no-AI gate and agents. */
const NEXT = [
  {
    id: 'whatsapp', name: 'WhatsApp', icon: 'chat',
    what: 'WhatsApp Business Platform (Cloud API): a verified business number, its phone number ID and a permanent access token, and a webhook for incoming messages. Replies within 24 hours of the citizen’s last message are free; later ones need an approved template.',
  },
  {
    id: 'instagram', name: 'Instagram', icon: 'image',
    what: 'Instagram Messaging API: a professional account linked to a Facebook Page, a Meta app with instagram_manage_messages, and a webhook for direct messages and comment mentions.',
  },
  {
    id: 'threads', name: 'Threads', icon: 'globe',
    what: 'Threads API: replies and mentions of the agency’s profile (Threads has no direct messages). Embrace answers publicly with a link to the private report form, never with case details.',
  },
  {
    id: 'email', name: 'Email', icon: 'mail',
    what: 'An inbound address such as pengaduan@agency.go.id forwarded to an inbound-mail webhook; attachments become media for the media agent, and the approved reply goes back by email.',
  },
]

export default function Integrations() {
  const { agency, me, reload } = useStaff()
  const [st, setSt] = useState<Status | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = useCallback(() => api.integrations(agency.id).then(setSt).catch((e) => setErr(String(e))), [agency.id])
  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr('')
    try {
      await fn()
      setToken('')
      await load()
      reload()
    } catch (e) {
      const msg = String(e).replace(/^Error: \d+ /, '')
      try { setErr(JSON.parse(msg).error) } catch { setErr(msg) }
    } finally {
      setBusy(false)
    }
  }
  const tg = st?.telegram
  const canEdit = me.role === 'leader' || me.role === 'supervisor'

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Channels</h1>
          <p className="muted">{agency.name} · where citizens can reach this agency. Every channel feeds the same no-AI gate, agents and inbox.</p>
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="channels-grid">
        <Card title="Website" icon="globe" className="channel on">
          <p className="status ok"><Icon name="check" size={14} /> Live</p>
          <p className="small-body">Report form with text, voice note and photo, and a public agency page with every channel.</p>
          {st && <p className="small-body"><a href={st.web.page}>{st.web.page.replace(/^https?:\/\//, '')}</a><br /><a href={st.web.url}>{st.web.url.replace(/^https?:\/\//, '')}</a></p>}
        </Card>

        <Card title="Telegram" icon="send" className={`channel ${tg?.connected ? 'on' : ''}`}>
          {!st && <div className="shimmer" />}
          {tg?.connected && (
            <>
              <p className="status ok"><Icon name="check" size={14} /> Connected: <a href={`https://t.me/${tg.username}`} target="_blank" rel="noreferrer">@{tg.username}</a></p>
              <p className="small-body">Commands, flood and rate limits and danger words are handled in code; only real reports reach Gemini, through Pub/Sub. Approved replies go back to the citizen&apos;s chat.</p>
              {tg.managed
                ? <p className="muted small">Managed by the deployment (token in Secret Manager).</p>
                : canEdit && <button className="ghost small" disabled={busy} onClick={() => act(() => api.disconnectTelegram(agency.id))}>Disconnect</button>}
            </>
          )}
          {tg && !tg.connected && (
            <form onSubmit={(e) => { e.preventDefault(); act(() => api.connectTelegram(agency.id, token)) }}>
              <p className="status"><Icon name="close" size={14} /> Not connected</p>
              <ol className="small-body steps">
                <li>In Telegram, open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> and send /newbot.</li>
                <li>Paste the token it gives you. Embrace sets the webhook, commands and description.</li>
              </ol>
              <label className="field"><span>Bot token</span>
                <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA…" autoComplete="off" disabled={!canEdit} />
              </label>
              <button className="primary" disabled={busy || !token.trim() || !canEdit}>{busy ? 'Connecting…' : 'Connect bot'}</button>
            </form>
          )}
        </Card>

        {NEXT.map((c) => (
          <Card key={c.id} title={c.name} icon={c.icon} className="channel">
            <p className="status"><Icon name="clock" size={14} /> Next release</p>
            <p className="small-body">{c.what}</p>
            <button className="small" disabled>Connect</button>
          </Card>
        ))}
      </div>
      <p className="muted small">Already today, the web form can tag a report as arriving by WhatsApp, email or social media, so desks can log messages they receive elsewhere; the agents treat them the same way.</p>
    </div>
  )
}
