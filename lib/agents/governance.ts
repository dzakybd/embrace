// Governance plugin for every runner (ADK plugins apply policy across all agents). Per model call it:
// - applies the model the agency chose in the AI control tower (allow-listed),
// - records model, latency and token usage for the case trace and as OpenTelemetry GenAI metrics,
// - writes a structured log line with metadata only: prompts and complaint text never reach the logs.
import { BasePlugin, type Context, type LlmRequest, type LlmResponse } from '@google/adk'
import { metrics, trace } from '@opentelemetry/api'
import { GUARD_DEFAULTS, safetyAt } from '../guardrails'
import { STORE, type GuardConfig } from '../store'
import { AGENT_MODEL_KEY, MODEL_CHOICES, MODELS, thinkingFor } from './models'

export interface ModelCall {
  agent: string
  model: string
  ms: number
  tokens_in: number
  tokens_out: number
  error?: string
  /** Cloud Trace id of the run, to open its waterfall from the control tower. */
  trace_id?: string
}

const meter = metrics.getMeter('embrace')
const tokenUsage = meter.createHistogram('gen_ai.client.token.usage', {
  unit: '{token}',
  description: 'Tokens per model call',
})
const opDuration = meter.createHistogram('gen_ai.client.operation.duration', {
  unit: 's',
  description: 'Model call latency',
})
const guardEvents = meter.createCounter('embrace.guardrail.events', { description: 'Guardrail findings by kind' })

/** Structured log for Cloud Logging (Cloud Run reads JSON lines from stdout). Never pass complaint text here. */
export function log(severity: 'INFO' | 'WARNING' | 'ERROR', message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ severity, message, component: 'embrace-agents', ...fields }))
}

export function recordGuard(kind: string, agencyId: string, ticketId: string) {
  guardEvents.add(1, { 'embrace.guard.kind': kind, 'embrace.agency': agencyId })
  log('WARNING', 'guardrail', { kind, agency: agencyId, ticket: ticketId })
}

export interface AiConfig {
  models: Record<string, string>
  guard: GuardConfig
  updated_by?: string
  updated_at?: string
}

/** Models and guardrail settings chosen by an agency, cached briefly so the control tower takes effect within a minute. */
const choices = new Map<string, { at: number; cfg: AiConfig }>()
export async function agencyAi(agencyId: string): Promise<AiConfig> {
  const hit = choices.get(agencyId)
  if (hit && Date.now() - hit.at < 30_000) return hit.cfg
  const ai = (await STORE.getIntegration(agencyId).catch(() => null))?.ai
  const cfg: AiConfig = {
    models: ai?.models ?? {},
    guard: { ...GUARD_DEFAULTS, ...ai?.guard },
    updated_by: ai?.updated_by,
    updated_at: ai?.updated_at,
  }
  choices.set(agencyId, { at: Date.now(), cfg })
  return cfg
}
export const forgetAgencyModels = (agencyId: string) => choices.delete(agencyId)

/** The model an agent runs for an agency: its allow-listed choice, else the deployment default. */
export function modelFor(agent: string, chosen: Record<string, string>) {
  const key = AGENT_MODEL_KEY[agent]
  const pick = key ? chosen[key] : undefined
  return pick && MODEL_CHOICES.includes(pick) ? pick : key ? MODELS[key] : undefined
}

export class GovernancePlugin extends BasePlugin {
  private readonly started = new Map<string, { at: number; model: string }>()
  private readonly calls = new Map<string, ModelCall[]>()

  constructor() {
    super('embrace_governance')
  }

  /** Model calls of one run, removed once read. */
  take(invocationId: string): ModelCall[] {
    const out = this.calls.get(invocationId) ?? []
    this.calls.delete(invocationId)
    return out
  }

  /** The latest model call of an agent in a run, for the trace step it produced. */
  last(invocationId: string, agent: string): ModelCall | undefined {
    return this.calls.get(invocationId)?.findLast((c) => c.agent === agent)
  }

  private push(ctx: Context, call: ModelCall) {
    const list = this.calls.get(ctx.invocationId) ?? []
    list.push(call)
    this.calls.set(ctx.invocationId, list)
    // A run that is never read (client went away) must not leak memory.
    if (this.calls.size > 500) this.calls.delete(this.calls.keys().next().value!)
  }

  override async beforeModelCallback({
    callbackContext: ctx,
    llmRequest,
  }: {
    callbackContext: Context
    llmRequest: LlmRequest
  }) {
    const agencyId = ctx.state.get('agency_id') as string | undefined
    if (agencyId) {
      const cfg = await agencyAi(agencyId)
      const model = modelFor(ctx.agentName, cfg.models)
      if (model) llmRequest.model = model
      // The drafter writes to the public; every other agent reads reports.
      llmRequest.config = {
        ...llmRequest.config,
        safetySettings: safetyAt(ctx.agentName === 'drafter_agent' ? cfg.guard.write : cfg.guard.read),
      }
    }
    if (llmRequest.model) llmRequest.config = { ...llmRequest.config, thinkingConfig: thinkingFor(llmRequest.model) }
    this.started.set(`${ctx.invocationId}:${ctx.agentName}`, { at: Date.now(), model: llmRequest.model ?? 'gemini' })
    return undefined
  }

  override async afterModelCallback({
    callbackContext: ctx,
    llmResponse,
  }: {
    callbackContext: Context
    llmResponse: LlmResponse
  }) {
    const key = `${ctx.invocationId}:${ctx.agentName}`
    const start = this.started.get(key)
    const ms = Date.now() - (start?.at ?? Date.now())
    this.started.delete(key)
    const u = llmResponse.usageMetadata
    // The model the request was sent to; structured-output responses do not always echo modelVersion.
    const model = llmResponse.modelVersion ?? start?.model ?? 'gemini'
    const call: ModelCall = {
      agent: ctx.agentName,
      model,
      ms,
      tokens_in: u?.promptTokenCount ?? 0,
      tokens_out: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
      trace_id: trace.getActiveSpan()?.spanContext().traceId,
    }
    this.push(ctx, call)
    const attrs = {
      'gen_ai.agent.name': ctx.agentName,
      'gen_ai.request.model': model,
      'gen_ai.provider.name': 'gcp.gemini',
      'gen_ai.operation.name': 'generate_content',
    }
    tokenUsage.record(call.tokens_in, { ...attrs, 'gen_ai.token.type': 'input' })
    tokenUsage.record(call.tokens_out, { ...attrs, 'gen_ai.token.type': 'output' })
    opDuration.record(ms / 1000, attrs)
    log('INFO', 'model_call', {
      agent: ctx.agentName,
      model,
      ms,
      tokens_in: call.tokens_in,
      tokens_out: call.tokens_out,
      finish: llmResponse.finishReason,
      invocation: ctx.invocationId,
    })
    return undefined
  }

  override async onModelErrorCallback({
    callbackContext: ctx,
    error,
  }: {
    callbackContext: Context
    llmRequest: LlmRequest
    error: Error
  }) {
    const key = `${ctx.invocationId}:${ctx.agentName}`
    const start = this.started.get(key)
    const ms = Date.now() - (start?.at ?? Date.now())
    this.started.delete(key)
    this.push(ctx, {
      agent: ctx.agentName,
      model: start?.model ?? 'gemini',
      ms,
      tokens_in: 0,
      tokens_out: 0,
      error: String(error).slice(0, 160),
    })
    opDuration.record(ms / 1000, { 'gen_ai.agent.name': ctx.agentName, 'error.type': error.name || 'Error' })
    log('ERROR', 'model_error', {
      agent: ctx.agentName,
      error: String(error).slice(0, 300),
      invocation: ctx.invocationId,
    })
    return undefined
  }
}

export const governance = new GovernancePlugin()
