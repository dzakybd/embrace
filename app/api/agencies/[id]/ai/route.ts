import { createHash } from 'node:crypto'
import { z } from 'zod'
import { agencyById } from '@/lib/agencies'
import { aiReport } from '@/lib/ai-report'
import { agencyAi, forgetAgencyModels, log } from '@/lib/agents/governance'
import { AGENT_MODEL_KEY, MODEL_CHOICES, MODELS, PRICES } from '@/lib/agents/models'
import { LIMITS } from '@/lib/bot'
import { MAX_QUESTIONS, requiredDetails } from '@/lib/details'
import { THRESHOLDS } from '@/lib/guardrails'
import { error, rateLimit } from '@/lib/http'
import { CONFIDENCE_FLOOR } from '@/lib/policy'
import { ensureSeeded } from '@/lib/seed'
import { STORE, now } from '@/lib/store'
import { telemetryStatus } from '@/lib/telemetry'
import attackResults from '@/data/eval/attacks-results.json'
import evalResults from '@/data/eval/results.json'
import triageModels from '@/data/eval/triage-models.json'

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
  const cfg = await agencyAi(id)
  const chosen = cfg.models
  const key = process.env.GOOGLE_GENAI_API_KEY?.trim()
  return Response.json({
    models: Object.entries(AGENT_MODEL_KEY).map(([agent, k]) => ({ agent, key: k, role: ROLE[agent], default: MODELS[k], chosen: chosen[k] ?? null })),
    choices: MODEL_CHOICES.map((m) => ({ model: m, price: PRICES[m] ?? null, eval: (triageModels as Record<string, { category_accuracy: number; critical_recall_with_rules: number; urgency_within_one: number }>)[m] ?? null })),
    guard: cfg.guard,
    thresholds: THRESHOLDS,
    changed: cfg.updated_at ? { by: cfg.updated_by, at: cfg.updated_at } : null,
    key: {
      provider: 'Gemini API (Google AI)',
      store: 'Google Secret Manager: gemini-api-key, injected into Cloud Run at deploy',
      configured: !!key,
      // A short hash lets staff confirm which key is live without the key ever leaving the server.
      fingerprint: key ? createHash('sha256').update(key).digest('hex').slice(0, 10) : null,
    },
    telemetry: telemetryStatus(),
    safety: {
      confidence_floor: agency.escalation.confidence_floor ?? CONFIDENCE_FLOOR,
      escalate_flags: agency.escalation.escalate_flags,
      keywords: agency.escalation.keywords.length,
      limits: { reports_per_hour: LIMITS.reportsHour.limit, reports_per_day: LIMITS.reportsDay.limit, ai_reports_per_day: LIMITS.aiDay.limit },
      details: { required: requiredDetails(agency), max_questions: MAX_QUESTIONS },
    },
    eval: evalResults.summary,
    eval_at: evalResults.at,
    attacks: { ...attackResults.summary, at: attackResults.at, rows: attackResults.rows.map(({ id, kind, screened, held, caught }) => ({ id, kind, screened, held, caught })) },
    report: aiReport(await STORE.list(id), 30, PRICES),
  })
}

const Body = z.object({
  models: z.partialRecord(z.enum(Object.keys(MODELS) as [keyof typeof MODELS]), z.string()),
  guard: z.object({
    read: z.enum(THRESHOLDS), write: z.enum(THRESHOLDS), injection: z.enum(['review', 'flag']), questions: z.number().int().min(0).max(2),
  }).optional(),
  by: z.string().max(80),
})

/** Supervisor: models per agent (allow-listed) and guardrail settings. Applies within a minute, logged for audit. */
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
  if (by?.role !== 'supervisor') return error(403, 'only the supervisor changes AI settings')
  const models = Object.fromEntries(Object.entries(parsed.data.models).filter(([k, v]) => v && v !== MODELS[k as keyof typeof MODELS]))
  const guard = parsed.data.guard ?? (await agencyAi(id)).guard
  await STORE.setIntegration(id, { ai: { models: models as Record<string, string>, guard, updated_by: by.name, updated_at: now() } })
  forgetAgencyModels(id)
  log('INFO', 'ai_config_changed', { agency: id, by: by.name, models, guard })
  return Response.json({ ok: true, models, guard })
}
