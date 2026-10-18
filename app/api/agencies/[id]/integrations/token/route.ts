import { requireAdmin } from '@/lib/admin'
import { agencyById } from '@/lib/agencies'
import { telegramBot } from '@/lib/channels'
import { error } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** The full Telegram bot token, for the Channels page after the settings password. Never cached. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  if (!(await agencyById(id))) return error(404, 'unknown agency')
  const bot = await telegramBot(id)
  if (!bot) return error(404, 'no Telegram bot is connected')
  return Response.json({ token: bot.token }, { headers: { 'cache-control': 'no-store' } })
}
