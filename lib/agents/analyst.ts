// Trend analyst agent: answers leaders' questions and writes the weekly brief, using tools over live Firestore data.
import { FunctionTool, LlmAgent, type Context } from '@google/adk'
import { z } from 'zod'
import { getAgency } from '../agencies'
import { clusters, overview } from '../analytics'
import { SAFETY } from '../guardrails'
import { STORE } from '../store'
import { CFG, MODELS, gemini } from './models'

async function load(ctx?: Context) {
  const agency = getAgency(ctx?.state.get('agency_id') as string)!
  return { agency, tickets: await STORE.list(agency.id) }
}

const getOverview = new FunctionTool({
  name: 'get_overview',
  description:
    'Counts by category, urgency, status and channel, SLA breaches, median response and resolution hours, and this-week vs previous-week counts per category, over the last `days` days.',
  parameters: z.object({ days: z.number().int().min(1).max(90).describe('Window in days, e.g. 7 or 30') }),
  execute: async ({ days }, ctx) => {
    const { agency, tickets } = await load(ctx)
    return overview(agency, tickets, days)
  },
})

const findClusters = new FunctionTool({
  name: 'find_clusters',
  description:
    'Groups of 3+ complaints in the last `days` days that share a location, institution or aid programme. These are early warnings of a systemic problem (one school, one village, one payment batch).',
  parameters: z.object({ days: z.number().int().min(1).max(90) }),
  execute: async ({ days }, ctx) => {
    const { agency, tickets } = await load(ctx)
    return { clusters: clusters(agency, tickets, days) }
  },
})

const searchTickets = new FunctionTool({
  name: 'search_tickets',
  description:
    'Up to 15 tickets whose masked summary or entities mention `keyword` (case-insensitive). Returns no personal data.',
  parameters: z.object({ keyword: z.string().min(2) }),
  execute: async ({ keyword }, ctx) => {
    const { tickets } = await load(ctx)
    const k = keyword.toLowerCase()
    const hits = tickets
      .filter((t) => `${t.triage?.summary ?? ''} ${JSON.stringify(t.intake?.entities ?? {})}`.toLowerCase().includes(k))
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        created_at: t.created_at,
        status: t.status,
        category: t.triage?.category,
        urgency: t.policy?.final_urgency,
        summary: t.triage?.summary,
      }))
    return { tickets: hits }
  },
})

export const analystAgent = new LlmAgent({
  name: 'analyst_agent',
  model: gemini(MODELS.analyst),
  generateContentConfig: { ...CFG, safetySettings: SAFETY.reading },
  description: 'Answers questions about complaint trends using live aggregates.',
  instruction: `You are the data analyst for {agency_name}'s complaint desk, talking to the agency's leadership.
Always call tools before answering; never guess numbers. Answer in the language of the question
(default English), in at most 6 short lines or bullets, with concrete numbers and ticket ids
where useful. Point out emerging clusters and categories growing week over week, and suggest one
concrete action. Never reveal personal data.`,
  tools: [getOverview, findClusters, searchTickets],
})
