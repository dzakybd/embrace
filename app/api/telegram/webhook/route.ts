import { dispatch, handleUpdate } from '@/lib/bot'
import type { TgUpdate } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Telegram webhook: checks the secret header, handles the update without AI, and queues real reports. */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('forbidden', { status: 403 })
  const update = (await req.json().catch(() => null)) as TgUpdate | null
  if (!update?.update_id) return Response.json({ ok: true })
  try {
    const job = await handleUpdate(update)
    if (job) await dispatch(job)
  } catch (err) {
    console.error('telegram update failed', update.update_id, err)
  }
  return Response.json({ ok: true }) // always 200 so Telegram does not resend endlessly
}
