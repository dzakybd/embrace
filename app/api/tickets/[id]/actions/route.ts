import { z } from 'zod'
import { error } from '@/lib/http'
import { ACTION_NAMES, act } from '@/lib/service'

const Body = z.object({
  action: z.string().refine((a) => ACTION_NAMES.includes(a), 'unknown action'),
  officer: z.string().max(80).default('Officer'),
  note: z.string().max(1000).default(''),
  reply: z.string().max(4000).nullish(),
  queue: z.string().max(80).nullish(),
  assignee: z.string().max(40).nullish(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, parsed.error.issues[0]?.message ?? 'invalid body')
  const b = parsed.data
  const t = await act((await params).id, b.action, b.officer, b.note, b.reply ?? undefined, b.queue ?? undefined, b.assignee ?? undefined)
  return t ? Response.json(t) : error(404, 'not found')
}
