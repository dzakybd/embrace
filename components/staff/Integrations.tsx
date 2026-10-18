'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type Integrations as Status } from '../api'
import { Card, ChannelIcon, Icon } from '../ui'
import { useStaff } from './StaffProvider'

/** Channels that are not wired in this prototype yet: what each needs, all feeding the same no-AI gate and agents. */
const NEXT = [
  { id: 'whatsapp', name: 'WhatsApp', what: 'WhatsApp Business Cloud API: a verified number, access token and message webhook.' },
  { id: 'instagram', name: 'Instagram', what: 'Instagram Messaging API: direct messages and comment mentions.' },
  { id: 'threads', name: 'Threads', what: 'Public replies with a link to the private report form, never case details.' },
  { id: 'email', name: 'Email', what: 'An inbound address forwarded to a webhook; attachments go to the media agent.' },
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
          <p className="muted">Every channel feeds the same agents and inbox.</p>
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="channels-grid">
        <Card title="Website" icon="globe" className="channel on">
          <p className="status ok"><Icon name="check" size={14} /> Live</p>
          <p className="small-body">Report form (text, voice, photo) and agency home page.</p>
          {st && <p className="small-body"><a href={st.web.page}>{st.web.page.replace(/^https?:\/\//, '')}</a><br /><a href={st.web.url}>{st.web.url.replace(/^https?:\/\//, '')}</a></p>}
        </Card>

        <Card title={<><ChannelIcon c="telegram" size={20} /> Telegram</>} className={`channel ${tg?.connected ? 'on' : ''}`}>
          {!st && <div className="shimmer" />}
          {tg?.connected && (
            <>
              <p className="status ok"><Icon name="check" size={14} /> Connected: <a href={`https://t.me/${tg.username}`} target="_blank" rel="noreferrer">@{tg.username}</a></p>
              <p className="small-body">Spam and danger words are filtered in code; only real reports reach Gemini. Approved replies go back to the chat.</p>
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
          <Card key={c.id} title={<><ChannelIcon c={c.id} size={20} /> {c.name}</>} className="channel">
            <p className="status"><Icon name="clock" size={14} /> Next release</p>
            <p className="small-body">{c.what}</p>
            <button className="small" disabled>Connect</button>
          </Card>
        ))}
      </div>
      <p className="muted small">Today, desks can log WhatsApp, email or social messages through the web form.</p>
    </div>
  )
}
