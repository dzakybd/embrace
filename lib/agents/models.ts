// Gemini models per agent. Cheap Flash-Lite by default (3.1 detects informal languages better than 2.5); triage gets Flash because urgency matters most.
import { Gemini } from '@google/adk'
import type { GenerateContentConfig } from '@google/genai'

const env = (k: string, d: string) => process.env[k] || d

export const MODELS = {
  media: env('EMBRACE_MEDIA_MODEL', 'gemini-3.1-flash-lite'),
  intake: env('EMBRACE_INTAKE_MODEL', 'gemini-3.1-flash-lite'),
  triage: env('EMBRACE_TRIAGE_MODEL', 'gemini-2.5-flash'),
  drafter: env('EMBRACE_DRAFTER_MODEL', 'gemini-3.1-flash-lite'),
  analyst: env('EMBRACE_ANALYST_MODEL', 'gemini-3.1-flash-lite'),
}

/** Uses GOOGLE_GENAI_API_KEY explicitly, so stray GOOGLE_API_KEY / GEMINI_API_KEY in a shell never win. */
export function gemini(model: string) {
  return new Gemini({ model, apiKey: process.env.GOOGLE_GENAI_API_KEY })
}

export const CFG: GenerateContentConfig = {
  temperature: 0.1,
  thinkingConfig: { thinkingBudget: 0 },
  httpOptions: { timeout: 30_000 },
}
