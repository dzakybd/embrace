// Gemini models per agent: the latest Flash-Lite everywhere (`gemini-flash-lite-latest`, gemini-3.5-flash-lite on
// 18 Oct), chosen by the user; on the eval set it matched 3.1 Flash-Lite (data/eval/triage-models.json).
import { Gemini } from '@google/adk'
import { ThinkingLevel, type GenerateContentConfig } from '@google/genai'

const env = (k: string, d: string) => process.env[k] || d

export const MODELS = {
  media: env('EMBRACE_MEDIA_MODEL', 'gemini-flash-lite-latest'),
  intake: env('EMBRACE_INTAKE_MODEL', 'gemini-flash-lite-latest'),
  triage: env('EMBRACE_TRIAGE_MODEL', 'gemini-flash-lite-latest'),
  drafter: env('EMBRACE_DRAFTER_MODEL', 'gemini-flash-lite-latest'),
  analyst: env('EMBRACE_ANALYST_MODEL', 'gemini-flash-lite-latest'),
  documents: env('EMBRACE_DOCUMENT_MODEL', 'gemini-flash-lite-latest'),
}
export type ModelKey = keyof typeof MODELS

/** List prices in USD per 1M tokens (input, output) on the Gemini API paid tier, October 2026, as reported by public
 * price trackers; the official page is ai.google.dev/gemini-api/docs/pricing. Used for cost estimates only. */
export const PRICES: Record<string, [number, number]> = {
  'gemini-flash-lite-latest': [0.3, 2.5],
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.1-flash-lite': [0.25, 1.5],
  'gemini-2.5-flash': [0.3, 2.5],
  'gemini-2.5-flash-lite': [0.1, 0.4],
}

/** Models an agency may pick in the AI control tower. Anything else is ignored. */
export const MODEL_CHOICES = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
]

/** ADK agent name -> the model setting it uses. */
export const AGENT_MODEL_KEY: Record<string, ModelKey> = {
  media_reader: 'media',
  intake_agent: 'intake',
  triage_agent: 'triage',
  drafter_agent: 'drafter',
  analyst_agent: 'analyst',
  document_agent: 'documents',
}

/** Uses GOOGLE_GENAI_API_KEY explicitly, so stray GOOGLE_API_KEY / GEMINI_API_KEY in a shell never win. */
export function gemini(model: string) {
  return new Gemini({ model, apiKey: process.env.GOOGLE_GENAI_API_KEY })
}

/** Thinking off, or as low as the model goes: Gemini 2.5 and 3.1 take a budget of 0, newer models (3.5, and the
 * `-latest` aliases that point to them) reject a budget and take a level instead. Set per call by the governance plugin,
 * since an agency may pick another model. */
export function thinkingFor(model: string): GenerateContentConfig['thinkingConfig'] {
  return /^gemini-(2\.|3\.[01]\b)/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.MINIMAL }
}

export const CFG: GenerateContentConfig = {
  temperature: 0.1,
  // Rate limits (429) and server errors back off and retry twice (1 s, then 2 s, with jitter) before the keyword
  // rules take over; a 4xx such as a bad request fails at once.
  httpOptions: {
    timeout: 30_000,
    retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4, httpStatusCodes: [408, 429, 500, 502, 503, 504] },
  },
}
