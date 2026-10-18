// Configures the Telegram bots of the built-in agencies: webhook, name, commands, descriptions, profile photo, menu.
// The Channels page does the same per agency ("Set up profile, commands and webhook"). Run after a deploy with the
// tokens from Secret Manager:
//   TELEGRAM_BOT_TOKEN_DINSOS_DEMAK=... TELEGRAM_BOT_TOKEN_KPAI=... TELEGRAM_WEBHOOK_SECRET=... npx tsx scripts/setup-telegram.ts
import { liveAgencies } from '../lib/agencies'
import { setupBot } from '../lib/channels'

const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set')

for (const a of liveAgencies()) {
  const token = process.env[`TELEGRAM_BOT_TOKEN_${a.id.toUpperCase()}`]?.trim()
  if (!token || !a.telegram_bot) continue
  console.log(a.id, await setupBot(a.id, token, secret))
}
