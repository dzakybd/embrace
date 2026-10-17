import { loadAgencies } from '@/lib/agencies'
import { dispatch, handleUpdate } from '@/lib/bot'
import { telegramBot } from '@/lib/channels'
import type { TgUpdate } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Telegram webhook of one agency's bot (?agency=<id>): checks that bot's secret header, handles the update
 * without AI, and queues real reports. */
export async function POST(req: Request) {
  const agencyId = new URL(req.url).searchParams.get('agency') ?? ''
  await loadAgencies()
  const bot = agencyId ? await telegramBot(agencyId) : null
  if (!bot?.secret || req.headers.get('x-telegram-bot-api-secret-token') !== bot.secret) return new Response('forbidden', { status: 403 })
  const update = (await req.json().catch(() => null)) as TgUpdate | null
  if (!update?.update_id) return Response.json({ ok: true })
  try {
    const job = await handleUpdate(bot, update)
    if (job) await dispatch(job)
  } catch (err) {
    console.error('telegram update failed', agencyId, update.update_id, err)
  }
  return Response.json({ ok: true }) // always 200 so Telegram does not resend endlessly
}
