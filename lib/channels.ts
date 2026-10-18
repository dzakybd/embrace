// Channels per agency. Telegram is live: each agency has its own bot. Built-in agencies' bots are managed by the
// deployment (token in Secret Manager); agencies created in the app connect a bot from their Integrations page.
import { getAgency } from './agencies'
import { localize } from './i18n'
import { STORE } from './store'
import { call } from './telegram'

export interface TelegramBot {
  agency_id: string
  token: string
  username: string
  secret: string
  managed: boolean
}

export const publicUrl = () => process.env.EMBRACE_PUBLIC_URL || 'https://embrace.nalaria.ai.id'
export const webhookUrl = (agencyId: string) => `${publicUrl()}/api/telegram/webhook?agency=${agencyId}`

/** TELEGRAM_BOT_TOKEN_<AGENCY_ID> from Secret Manager, for agencies shipped with a bot. */
const managedToken = (agencyId: string) => process.env[`TELEGRAM_BOT_TOKEN_${agencyId.toUpperCase()}`]?.trim()

export async function telegramBot(agencyId: string): Promise<TelegramBot | null> {
  const agency = getAgency(agencyId)
  const token = managedToken(agencyId)
  if (token && agency?.telegram_bot) {
    return { agency_id: agencyId, token, username: agency.telegram_bot, secret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '', managed: true }
  }
  const t = (await STORE.getIntegration(agencyId))?.telegram
  return t ? { agency_id: agencyId, token: t.token, username: t.username, secret: t.secret, managed: false } : null
}

const COMMANDS = [
  { command: 'start', description: 'Start' },
  { command: 'new', description: 'Make a new report' },
  { command: 'track', description: 'Track your report' },
  { command: 'emergency', description: 'Emergency numbers' },
  { command: 'language', description: 'Bahasa Indonesia / English' },
]
const COMMANDS_ID = [
  { command: 'start', description: 'Mulai' },
  { command: 'new', description: 'Buat laporan baru' },
  { command: 'track', description: 'Lacak laporan Anda' },
  { command: 'emergency', description: 'Nomor darurat' },
  { command: 'language', description: 'English / Bahasa Indonesia' },
]

/** Points a bot at this agency's webhook and sets its commands and descriptions. Returns the bot's username. */
export async function configureBot(agencyId: string, token: string, secret: string): Promise<string> {
  const me = await call<{ username: string; is_bot: boolean }>(token, 'getMe', {})
  const agency = getAgency(agencyId)!
  await call(token, 'setWebhook', { url: webhookUrl(agencyId), secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true })
  await call(token, 'setMyCommands', { commands: COMMANDS })
  await call(token, 'setMyCommands', { commands: COMMANDS_ID, language_code: 'id' })
  await call(token, 'setMyShortDescription', { short_description: `Report a problem to ${agency.short_name} in your own words and language. A caseworker reviews every reply.`.slice(0, 120) })
  await call(token, 'setMyDescription', {
    description: (`${agency.name}\n\nTell us what happened in your own words and language, by text, voice note or photo. Urgent reports alert the duty supervisor in seconds; a caseworker reviews every reply.\n\nIn danger now? Call ${agency.emergency_line}.\n\nPrototype by Embrace: please use made-up details only.`).slice(0, 512),
  })
  const local = localize(agency, 'id')
  await call(token, 'setMyShortDescription', { language_code: 'id', short_description: `Laporkan masalah ke ${local.short_name} dengan kata-kata Anda sendiri. Petugas memeriksa setiap balasan.`.slice(0, 120) })
  await call(token, 'setMyDescription', {
    language_code: 'id',
    description: (`${local.name}\n\nCeritakan apa yang terjadi dengan kata-kata Anda sendiri, lewat teks, pesan suara, atau foto. Laporan mendesak memberi tahu supervisor piket dalam hitungan detik; petugas memeriksa setiap balasan.\n\nDalam bahaya sekarang? Hubungi ${agency.emergency_line}.\n\nPrototipe Embrace: gunakan data rekaan saja.`).slice(0, 512),
  })
  return me.username
}
