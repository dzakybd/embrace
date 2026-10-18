import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { AGENCIES, agencyById } from '@/lib/agencies'
import { botStatus, managedSecret, publicUrl, setupBot, telegramBot, tokenHint, webhookUrl } from '@/lib/channels'
import { error, rateLimit } from '@/lib/http'
import { STORE, now } from '@/lib/store'
import { call } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

/** Channel status for the Channels page: where the token is kept and a hint of it, never the token itself. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const bot = await telegramBot(id)
  return Response.json({
    web: { connected: true, url: `${publicUrl()}/report?agency=${id}`, page: `${publicUrl()}/a/${id}` },
    telegram: bot
      ? {
          connected: true,
          username: bot.username,
          managed: bot.managed,
          webhook: webhookUrl(id),
          token_hint: tokenHint(bot.token),
          stored_in: bot.managed ? `Google Secret Manager: ${managedSecret(id)}` : 'Firestore (server only)',
          status: await botStatus(bot),
        }
      : { connected: false, managed: false, webhook: webhookUrl(id) },
  })
}

const Connect = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/, 'That does not look like a bot token from @BotFather'),
})

/** Connects a Telegram bot to an agency created in the app: validates the token and sets the webhook. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  if (!agency.custom) return error(403, 'This agency’s bot is managed by the deployment')
  const limited = rateLimit(req, 'tg-connect', 10)
  if (limited) return limited
  const parsed = Connect.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues[0].message)
  const secret = randomBytes(24).toString('hex')
  let username: string
  try {
    username = (await call<{ username: string }>(parsed.data.token, 'getMe', {})).username
  } catch (e) {
    return error(
      400,
      `Telegram refused the token: ${String(e)
        .replace(/^Error: /, '')
        .slice(0, 160)}`,
    )
  }
  await STORE.setIntegration(id, { telegram: { token: parsed.data.token, username, secret, connected_at: now() } })
  await STORE.patchAgency(id, { telegram_bot: username })
  AGENCIES[id] = { ...agency, telegram_bot: username }
  return Response.json({ connected: true, username, steps: await setupBot(id, parsed.data.token, secret) })
}

/** Sets the connected bot up again (webhook, commands, descriptions, name, photo, menu), for managed bots too. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'tg-setup', 10)
  if (limited) return limited
  const bot = await telegramBot(id)
  if (!bot) return error(404, 'no Telegram bot is connected')
  const steps = await setupBot(id, bot.token, bot.secret)
  return Response.json({ steps, status: await botStatus(bot) })
}

/** Disconnects the bot: removes its webhook and forgets the token. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  if (!agency.custom) return error(403, 'This agency’s bot is managed by the deployment')
  const limited = rateLimit(req, 'tg-connect', 10)
  if (limited) return limited
  const bot = await telegramBot(id)
  if (bot) await call(bot.token, 'deleteWebhook', {}).catch(() => undefined)
  await STORE.setIntegration(id, { telegram: null })
  await STORE.patchAgency(id, { telegram_bot: null })
  AGENCIES[id] = { ...agency, telegram_bot: null }
  return Response.json({ connected: false })
}
