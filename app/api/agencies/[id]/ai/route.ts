import { createHash } from 'node:crypto'
import { z } from 'zod'
import { agencyById } from '@/lib/agencies'
import { aiReport } from '@/lib/ai-report'
import { agencyModels, forgetAgencyModels, log } from '@/lib/agents/governance'
import { AGENT_MODEL_KEY, MODEL_CHOICES, MODELS } from '@/lib/agents/models'
import { LIMITS } from '@/lib/bot'
import { MAX_QUESTIONS, requiredDetails } from '@/lib/details'
import { SAFETY } from '@/lib/guardrails'
import { error, rateLimit } from '@/lib/http'
import { CONFIDENCE_FLOOR } from '@/lib/policy'
import { ensureSeeded } from '@/lib/seed'
import { STORE, now } from '@/lib/store'
import { telemetryStatus } from '@/lib/telemetry'
import evalResults from '@/data/eval/results.json'

export const dynamic = 'force-dynamic'

const ROLE: Record<string, string> = {
  media_reader: 'Voice notes and photos',
  intake_agent: 'Language, entities, personal-data masking',
  triage_agent: 'Category, urgency, safety flags',
  drafter_agent: 'Reply draft for officer approval',
  analyst_agent: 'Insights, weekly brief, questions',
}

/** The AI control tower: models, key, guardrails, telemetry and what the agents did in the last 30 days. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  await ensureSeeded(STORE, id)
  const chosen = await agencyModels(id)
  const key = process.env.GOOGLE_GENAI_API_KEY?.trim()
  const threshold = (s: typeof SAFETY.reading) => String(s[0].threshold)
  return Response.json({
    models: Object.entries(AGENT_MODEL_KEY).map(([agent, k]) => ({ agent, key: k, role: ROLE[agent], default: MODELS[k], chosen: chosen[k] ?? null })),
    choices: MODEL_CHOICES,
    key: {
      provider: 'Gemini API (Google AI)',
      store: 'Google Secret Manager: gemini-api-key, injected into Cloud Run at deploy',
      configured: !!key,
      // A short hash lets staff confirm which key is live without the key ever leaving the server.
      fingerprint: key ? createHash('sha256').update(key).digest('hex').slice(0, 10) : null,
    },
    telemetry: telemetryStatus(),
    safety: {
      filters: { reading: threshold(SAFETY.reading), writing: threshold(SAFETY.writing) },
      confidence_floor: agency.escalation.confidence_floor ?? CONFIDENCE_FLOOR,
      escalate_flags: agency.escalation.escalate_flags,
      keywords: agency.escalation.keywords.length,
      limits: { reports_per_hour: LIMITS.reportsHour.limit, reports_per_day: LIMITS.reportsDay.limit, ai_reports_per_day: LIMITS.aiDay.limit },
      details: { required: requiredDetails(agency), max_questions: MAX_QUESTIONS },
    },
    eval: evalResults.summary,
    eval_at: evalResults.at,
    report: aiReport(await STORE.list(id)),
  })
}

const Body = z.object({ models: z.partialRecord(z.enum(Object.keys(MODELS) as [keyof typeof MODELS]), z.string()), by: z.string().max(80) })

/** Head of office: choose the model per agent from the allow-list. Applies within a minute, logged for audit. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 'ai-config', 20)
  if (limited) return limited
  const { id } = await params
  const agency = await agencyById(id)
  if (!agency) return error(404, 'unknown agency')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(422, parsed.error.issues[0]?.message ?? 'invalid body')
  const bad = Object.values(parsed.data.models).find((m) => m && !MODEL_CHOICES.includes(m))
  if (bad) return error(422, `model not allowed: ${bad}`)
  const by = agency.team.find((m) => m.name === parsed.data.by)
  if (by?.role !== 'leader') return error(403, 'only the head of office changes models')
  const models = Object.fromEntries(Object.entries(parsed.data.models).filter(([k, v]) => v && v !== MODELS[k as keyof typeof MODELS]))
  await STORE.setIntegration(id, { ai: { models: models as Record<string, string>, updated_by: by.name, updated_at: now() } })
  forgetAgencyModels(id)
  log('INFO', 'ai_models_changed', { agency: id, by: by.name, models })
  return Response.json({ ok: true, models })
}
