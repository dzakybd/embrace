import { z } from 'zod'
import { getAgency } from '@/lib/agencies'
import { error, rateLimit } from '@/lib/http'
import { submit } from '@/lib/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const Body = z
  .object({
    text: z.string().max(4000).default(''),
    channel: z.enum(['web', 'whatsapp', 'email', 'social']).default('web'),
    reporter_name: z.string().max(120).nullish(),
    reporter_contact: z.string().max(120).nullish(),
    attachments: z
      .array(
        z.object({
          mime: z.string().regex(/^(image\/(jpeg|png|webp|heic)|audio\/(mpeg|mp3|mp4|m4a|x-m4a|aac|wav|x-wav|ogg|flac|webm))$/),
          data: z.string().max(10_000_000).regex(/^[A-Za-z0-9+/=]*$/, 'attachment is not valid base64'),
        }),
      )
      .max(3)
      .default([]),
  })
  .refine((b) => b.text.trim().length >= 10 || b.attachments.length > 0, 'Write at least 10 characters or attach a voice note or photo')

/** Streams agent progress as Server-Sent Events; the final `done` event carries the ticket. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!getAgency(id)) return error(404, 'unknown agency')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, parsed.error.issues[0]?.message ?? 'invalid body')
  const limited = rateLimit(req, 'complaint', 20)
  if (limited) return limited
  const b = parsed.data
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of submit(id, b.text, b.channel, { name: b.reporter_name, contact: b.reporter_contact }, b.attachments)) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`))
        }
      } catch (e) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'error', message: String(e) })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' },
  })
}
