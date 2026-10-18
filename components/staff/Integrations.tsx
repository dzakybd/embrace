'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type Integrations as Status } from '../api'
import { Card, ChannelIcon, Icon } from '../ui'
import { useT } from '../Lang'
import { useStaff } from './StaffProvider'

/** Channels that are not wired in this prototype yet: what each needs, all feeding the same no-AI gate and agents. */
const NEXT = [
  {
    id: 'whatsapp', name: 'WhatsApp', what: 'WhatsApp Business Cloud API: a verified number, access token and message webhook.',
    fields: [{ label: 'Phone number ID', ph: '1234567890' }, { label: 'Permanent access token', ph: 'EAAG…' }],
  },
  {
    id: 'email', name: 'Email', what: 'An inbound address forwarded to a webhook; attachments go to the media agent.',
    fields: [{ label: 'Inbound address', ph: 'complaints@agency.go.id' }, { label: 'Reply-from address', ph: 'no-reply@agency.go.id' }],
  },
  {
    id: 'instagram', name: 'Instagram', what: 'Instagram Messaging API: direct messages and comment mentions.',
    fields: [{ label: 'Instagram account ID', ph: '178414…' }, { label: 'Page access token', ph: 'EAAG…' }],
  },
  {
    id: 'threads', name: 'Threads', what: 'Public replies with a link to the private report form, never case details.',
    fields: [{ label: 'Threads profile', ph: '@agency' }, { label: 'Access token', ph: 'THQW…' }],
  },
]

/** Share link and iframe snippet so an agency can put the report chat on its own website. */
function ShareLink({ reportUrl }: { reportUrl: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(reportUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* blocked */ }
  }
  return (
    <label className="field share-link"><span>{t('Share link')}</span>
      <div className="copy-row"><input readOnly value={reportUrl} onFocus={(e) => e.target.select()} />
        <button type="button" className="small" onClick={copy}>{copied ? t('Copied') : t('Copy')}</button></div>
    </label>
  )
}

export default function Integrations() {
  const t = useT()
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
          <h1>{t('Channels')}</h1>
          <p className="muted">{t('Every channel feeds the same agents and inbox.')}</p>
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="channels-grid">
        <Card title={t('Website')} icon="globe" className="channel on">
          <p className="status ok"><Icon name="check" size={14} /> {t('Live')}</p>
          <p className="small-body">{t('Report chat (text, voice, photo): share the link with the public.')}</p>
          {st && <ShareLink reportUrl={st.web.url} />}
        </Card>

        <Card title={<><ChannelIcon c="telegram" size={20} /> Telegram</>} className={`channel ${tg?.connected ? 'on' : ''}`}>
          {!st && <div className="shimmer" />}
          {tg?.connected && (
            <>
              <p className="status ok"><Icon name="check" size={14} /> {t('Connected:')} <a href={`https://t.me/${tg.username}`} target="_blank" rel="noreferrer">@{tg.username}</a></p>
              <p className="small-body">{t('Spam and danger words are filtered in code; only real reports reach Gemini. Approved replies go back to the chat.')}</p>
              {tg.managed
                ? <p className="muted small">{t('Managed by the deployment (token in Secret Manager).')}</p>
                : canEdit && <button className="ghost small" disabled={busy} onClick={() => act(() => api.disconnectTelegram(agency.id))}>{t('Disconnect')}</button>}
            </>
          )}
          {tg && !tg.connected && (
            <form onSubmit={(e) => { e.preventDefault(); act(() => api.connectTelegram(agency.id, token)) }}>
              <p className="status"><Icon name="close" size={14} /> {t('Not connected')}</p>
              <ol className="small-body steps">
                <li>{t('In Telegram, open')} <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> {t('and send /newbot.')}</li>
                <li>{t('Paste the token it gives you. Embrace sets the webhook, commands and description.')}</li>
              </ol>
              <label className="field"><span>{t('Bot token')}</span>
                <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA…" autoComplete="off" disabled={!canEdit} />
              </label>
              <button className="primary" disabled={busy || !token.trim() || !canEdit}>{busy ? t('Connecting…') : t('Connect bot')}</button>
            </form>
          )}
        </Card>

        {NEXT.map((c) => (
          <Card key={c.id} title={<><ChannelIcon c={c.id} size={20} /> {t(c.name)}</>} className="channel soon-card">
            <p className="status"><Icon name="clock" size={14} /> {t('Next release')}</p>
            <p className="small-body">{t(c.what)}</p>
            <form onSubmit={(e) => e.preventDefault()}>
              {c.fields.map((f) => (
                <label key={f.label} className="field"><span>{t(f.label)}</span><input placeholder={f.ph} disabled /></label>
              ))}
              <button className="small" disabled>{t('Connect')}</button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  )
}
