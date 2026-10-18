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

export interface SetupStep { step: string; ok: boolean; error?: string }

/** Full bot setup, step by step so the Channels page can show what worked: webhook, commands and descriptions (both
 * languages), the bot's name, the profile photo and the menu button. Used on connect and from the "Set up again" button. */
export async function setupBot(agencyId: string, token: string, secret: string): Promise<SetupStep[]> {
  const agency = getAgency(agencyId)!
  const local = localize(agency, 'id')
  const steps: SetupStep[] = []
  const run = async (step: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      steps.push({ step, ok: true })
    } catch (e) {
      steps.push({ step, ok: false, error: String(e).replace(/^Error: /, '').slice(0, 160) })
    }
  }
  await run('Webhook, commands and descriptions', () => configureBot(agencyId, token, secret))
  await run('Name', async () => {
    await call(token, 'setMyName', { name: `${agency.short_name} · Embrace`.slice(0, 64) })
    await call(token, 'setMyName', { name: `${local.short_name} · Embrace`.slice(0, 64), language_code: 'id' })
  })
  await run('Profile photo', async () => {
    const res = await fetch(`${publicUrl()}/bot-avatar.jpg`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`avatar not found (${res.status})`)
    const form = new FormData()
    form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://p' }))
    form.append('p', new Blob([await res.arrayBuffer()], { type: 'image/jpeg' }), 'avatar.jpg')
    const out = (await (await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form })).json()) as { ok: boolean; description?: string }
    if (!out.ok) throw new Error(out.description)
  })
  await run('Menu button', () => call(token, 'setChatMenuButton', { menu_button: { type: 'commands' } }))
  return steps
}

/** Where a bot's token lives, never the token itself: a hint of its first and last characters is enough to tell bots apart. */
export function tokenHint(token: string) {
  const [id, key = ''] = token.split(':')
  return `${id}:${key.slice(0, 2)}••••${key.slice(-4)}`
}
export const managedSecret = (agencyId: string) => `telegram-bot-${agencyId.replace(/_/g, '-')}`

/** What Telegram reports about a bot right now: profile, webhook health and setup. Each check fails on its own. */
export async function botStatus(bot: TelegramBot) {
  const safe = <T,>(p: Promise<T>) => p.catch(() => null)
  const [me, hook, name, desc, cmds] = await Promise.all([
    safe(call<{ id: number; first_name: string; username: string }>(bot.token, 'getMe', {})),
    safe(call<{ url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number }>(bot.token, 'getWebhookInfo', {})),
    safe(call<{ name: string }>(bot.token, 'getMyName', {})),
    safe(call<{ description: string }>(bot.token, 'getMyDescription', {})),
    safe(call<unknown[]>(bot.token, 'getMyCommands', {})),
  ])
  const photos = me ? await safe(call<{ total_count: number }>(bot.token, 'getUserProfilePhotos', { user_id: me.id, limit: 1 })) : null
  return {
    reachable: !!me,
    name: name?.name ?? me?.first_name ?? null,
    webhook_ok: !!hook && hook.url === webhookUrl(bot.agency_id),
    pending: hook?.pending_update_count ?? 0,
    last_error: hook?.last_error_message ? { message: hook.last_error_message, at: new Date((hook.last_error_date ?? 0) * 1000).toISOString() } : null,
    description: !!desc?.description,
    commands: Array.isArray(cmds) ? cmds.length : 0,
    photo: (photos?.total_count ?? 0) > 0,
  }
}

/** Points a bot at this agency's webhook and sets its commands and descriptions. Returns the bot's username. */
export async function configureBot(agencyId: string, token: string, secret: string): Promise<string> {
  const me = await call<{ username: string; is_bot: boolean }>(token, 'getMe', {})
  const agency = getAgency(agencyId)!
  await call(token, 'setWebhook', { url: webhookUrl(agencyId), secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true })
  await call(token, 'setMyCommands', { commands: COMMANDS })
  await call(token, 'setMyCommands', { commands: COMMANDS_ID, language_code: 'id' })
  await call(token, 'setMyShortDescription', { short_description: `Report a problem to ${agency.short_name} in your own words and language. A caseworker reviews every reply.`.slice(0, 120) })
  await call(token, 'setMyDescription', {
    description: (`${agency.name}\n\nTell us what happened in your own words and language, by text, voice note or photo. Urgent reports alert the supervisor in seconds; a caseworker reviews every reply.\n\nIn danger now? Call ${agency.emergency_line}.\n\nPrototype by Embrace: please use made-up details only.`).slice(0, 512),
  })
  const local = localize(agency, 'id')
  await call(token, 'setMyShortDescription', { language_code: 'id', short_description: `Laporkan masalah ke ${local.short_name} dengan kata-kata Anda sendiri. Petugas memeriksa setiap balasan.`.slice(0, 120) })
  await call(token, 'setMyDescription', {
    language_code: 'id',
    description: (`${local.name}\n\nCeritakan apa yang terjadi dengan kata-kata Anda sendiri, lewat teks, pesan suara, atau foto. Laporan mendesak memberi tahu manajer dalam hitungan detik; petugas memeriksa setiap balasan.\n\nDalam bahaya sekarang? Hubungi ${agency.emergency_line}.\n\nPrototipe Embrace: gunakan data rekaan saja.`).slice(0, 512),
  })
  return me.username
}
