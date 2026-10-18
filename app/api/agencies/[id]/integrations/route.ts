import { requireAdmin } from '@/lib/admin'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { agencyById, saveAgencyFields, shipped } from '@/lib/agencies'
import {
  botStatus,
  managedBot,
  managedSecret,
  publicUrl,
  setupBot,
  telegramBot,
  tokenHint,
  webhookUrl,
} from '@/lib/channels'
import { error, rateLimit } from '@/lib/http'
import { STORE, now } from '@/lib/store'
import { call } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

/** Channel status for the Channels page: where the token is kept and a hint of it. The full token needs the settings
 * password (GET ./token). */
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
          // A token set on this page replaces the bot the deployment ships for a built-in agency.
          replaces_managed: !bot.managed && !!managedBot(id),
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

/** Connects a bot, or changes the token of the connected one: validates it with Telegram, stops the previous bot's
 * webhook and sets the new one up. For a built-in agency the token replaces the deployment's bot until removed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
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
  const previous = await telegramBot(id)
  if (previous && previous.token !== parsed.data.token)
    await call(previous.token, 'deleteWebhook', {}).catch(() => undefined)
  await STORE.setIntegration(id, { telegram: { token: parsed.data.token, username, secret, connected_at: now() } })
  await saveAgencyFields(agency, { telegram_bot: username })
  return Response.json({ connected: true, username, steps: await setupBot(id, parsed.data.token, secret) })
}

/** Sets the connected bot up again (webhook, commands, descriptions, name, photo, menu), for managed bots too. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'tg-setup', 10)
  if (limited) return limited
  const bot = await telegramBot(id)
  if (!bot) return error(404, 'no Telegram bot is connected')
  const steps = await setupBot(id, bot.token, bot.secret)
  return Response.json({ steps, status: await botStatus(bot) })
}

/** Forgets the token set on this page and removes its webhook. A built-in agency goes back to the deployment's bot. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'tg-connect', 10)
  if (limited) return limited
  const bot = await telegramBot(id)
  if (!bot || bot.managed) return error(403, 'This agency’s bot is managed by the deployment')
  await call(bot.token, 'deleteWebhook', {}).catch(() => undefined)
  await STORE.setIntegration(id, { telegram: null })
  const managed = managedBot(id)
  await saveAgencyFields(agency, { telegram_bot: managed ? shipped(id)!.telegram_bot : null })
  if (managed) return Response.json({ connected: true, steps: await setupBot(id, managed.token, managed.secret) })
  return Response.json({ connected: false })
}
