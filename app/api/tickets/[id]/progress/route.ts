import { z } from 'zod'
import { error } from '@/lib/http'
import { setStage } from '@/lib/service'

const Body = z.object({
  procedure: z.string().max(80),
  stage: z.number().int().min(0).max(50),
  done: z.boolean(),
  officer: z.string().max(80).default('Officer'),
})

/** Staff tick off the stages of the agency procedure a case follows. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, parsed.error.issues[0]?.message ?? 'invalid body')
  const b = parsed.data
  const t = await setStage((await params).id, b.procedure, b.stage, b.done, b.officer)
  return t ? Response.json(t) : error(404, 'unknown case, procedure or stage')
}
