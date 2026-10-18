import { processReport, type ReportJob } from '@/lib/bot'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Pub/Sub push endpoint for `telegram-reports`: runs the AI pipeline for one Telegram report. */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!secret || new URL(req.url).searchParams.get('token') !== secret)
    return new Response('forbidden', { status: 403 })
  const body = (await req.json().catch(() => null)) as { message?: { data?: string } } | null
  const data = body?.message?.data
  if (!data) return Response.json({ ok: true })
  const job = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as ReportJob
  await processReport(job)
  return Response.json({ ok: true })
}
