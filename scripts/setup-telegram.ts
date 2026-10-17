// Configures the Telegram bots of the built-in agencies: webhook, name, commands, descriptions and profile photo.
// Run after a deploy with the tokens from Secret Manager:
//   TELEGRAM_BOT_TOKEN_DINSOS_DEMAK=... TELEGRAM_BOT_TOKEN_KPAI=... TELEGRAM_WEBHOOK_SECRET=... npx tsx scripts/setup-telegram.ts
import { readFileSync } from 'node:fs'
import { AGENCIES, liveAgencies } from '../lib/agencies'
import { configureBot } from '../lib/channels'
import { call } from '../lib/telegram'

const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set')
const photo = readFileSync(new URL('../docs/brand/bot-avatar.jpg', import.meta.url))

for (const a of liveAgencies()) {
  const token = process.env[`TELEGRAM_BOT_TOKEN_${a.id.toUpperCase()}`]?.trim()
  if (!token || !a.telegram_bot) continue
  const username = await configureBot(a.id, token, secret)
  await call(token, 'setMyName', { name: `${AGENCIES[a.id].short_name} · Embrace` })
  const form = new FormData()
  form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://p' }))
  form.append('p', new Blob([photo], { type: 'image/jpeg' }), 'avatar.jpg')
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form })
  console.log(a.id, '@' + username, 'photo:', (await res.json()).ok)
}
