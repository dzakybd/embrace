import { z } from 'zod'
import { AGENCIES, agencyById, publicAgency, RESOURCE_KINDS, saveAgencyFields } from '@/lib/agencies'
import { log } from '@/lib/agents/governance'
import { error, rateLimit } from '@/lib/http'

const Text = z.string().trim().max(300)
const Body = z.object({
  resources: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_]{2,60}$/),
        kind: z.enum(RESOURCE_KINDS),
        name: Text.min(2),
        name_id: Text.optional(),
        note: Text.optional(),
        note_id: Text.optional(),
        // Links must be https so a citizen is never sent to a plain-http or script URL.
        url: z.string().trim().url().startsWith('https://').max(500).optional().or(z.literal('')),
        phone: z.string().trim().max(80).optional(),
        public: z.boolean(),
      }),
    )
    .max(60),
  by: z.object({ name: z.string().max(80), role: z.string() }),
})

/** Supervisor or head of office: the agency's links and contacts (official channels, social media, hotlines, partners). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const limited = rateLimit(req, 'resources', 30)
  if (limited) return limited
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const { resources, by } = parsed.data
  if (by.role !== 'leader' && by.role !== 'supervisor')
    return error(403, 'only the supervisor or the head of office changes resources')
  if (new Set(resources.map((r) => r.id)).size !== resources.length) return error(400, 'two resources have the same id')
  await saveAgencyFields(agency, { resources: resources.map((r) => ({ ...r, url: r.url || undefined })) })
  log('INFO', 'resources_changed', { agency: id, by: by.name, resources: resources.length })
  return Response.json(publicAgency(AGENCIES[id]))
}
