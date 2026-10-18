'use client'

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState } from 'react'
import type { AiReport } from '@/lib/ai-report'
import { useT } from '../Lang'
import { Card, Icon } from '../ui'

type Kind = 'io' | 'code' | 'llm' | 'rules' | 'tool' | 'human' | 'data' | 'cloud'
interface Agent {
  id: string
  kind: Kind
  label: string
  does: string
  input: string
  output: string
  tools?: string[]
  when?: string
  x: number
  y: number
}

const KIND: Record<Kind, string> = {
  io: 'Channel',
  code: 'Code',
  llm: 'Gemini',
  rules: 'Rules',
  tool: 'Tool',
  human: 'Person',
  data: 'Data',
  cloud: 'Google Cloud',
}

// Swimlanes of the report pipeline: who or what does the work.
const LANE_H = 120
const LANES = [
  { id: 'people', label: 'People' },
  { id: 'code', label: 'Code and rules (no AI)' },
  { id: 'llm', label: 'Gemini agents' },
  { id: 'tools', label: 'Tools and data' },
]
const col = (c: number) => 150 + c * 200
const lane = (l: number) => l * LANE_H + 28

/** The report pipeline as ADK runs it (lib/agents/pipeline.ts and lib/service.ts): a Workflow whose agents
 * pass their output to the next through session state, code guardrails and rules around them, people at the end. */
const PIPELINE: Agent[] = [
  {
    id: 'report',
    kind: 'io',
    label: 'Citizen',
    does: 'Reports by web chat or Telegram, and answers follow-up questions',
    input: 'Questions and the approved reply',
    output: 'Text, voice note, photo',
    x: col(0),
    y: lane(0),
  },
  {
    id: 'input_guard',
    kind: 'code',
    label: 'Input guardrail',
    does: 'Rate limit, spam filter, prompt-injection screen, before any model call',
    input: 'Report text',
    output: 'Injection flag; the report fenced as data',
    x: col(0),
    y: lane(1),
  },
  {
    id: 'media_reader',
    kind: 'llm',
    label: 'Media agent',
    does: 'Transcribes voice notes, describes photos',
    input: 'Voice notes and photos',
    output: 'Transcript, photo description, safety concern',
    when: 'Only when the report has attachments',
    x: col(1),
    y: lane(2),
  },
  {
    id: 'intake_agent',
    kind: 'llm',
    label: 'Intake agent',
    does: 'Language, entities, personal-data masking',
    input: 'Report text and media results',
    output: 'Language, place, age, time, masked text, English restatement',
    x: col(2),
    y: lane(2),
  },
  {
    id: 'followup',
    kind: 'code',
    label: 'Follow-up questions',
    does: 'Asks for the details the agency needs and the report lacks (fixed, translated questions)',
    input: 'Entities the intake agent found; the agency’s required details',
    output: 'At most 2 questions; the answers join the report and the agents run again',
    when: 'After the first run, when place, age or time is missing',
    x: col(2),
    y: lane(1),
  },
  {
    id: 'triage_agent',
    kind: 'llm',
    label: 'Triage agent',
    does: 'Case type, urgency, safety flags',
    input: 'Intake result and the agency case types',
    output: 'Case type, urgency, flags, confidence',
    x: col(3),
    y: lane(2),
  },
  {
    id: 'policy_agent',
    kind: 'rules',
    label: 'Policy rules',
    does: 'Escalation and routing in code, never by the model',
    input:
      'Triage result, the report text (escalation words), media safety concern, injection flag, the agency’s case types and minimum urgency',
    output: 'Route, final urgency, team, SLA, the case procedure; reasons for each',
    x: col(4),
    y: lane(1),
  },
  {
    id: 'alert',
    kind: 'cloud',
    label: 'Case events',
    does: 'Pub/Sub topic case-events and the Cloud Function onCaseEvent',
    input: 'Escalation, delegation or a citizen’s new message',
    output: 'In-app notification to the supervisor or the person in charge',
    x: col(5),
    y: lane(1),
  },
  {
    id: 'sop_agent',
    kind: 'tool',
    label: 'Document search',
    does: 'BM25 search over the knowledge base, no tokens',
    input: 'Case type, summary, entities',
    output: 'Top 3 passages the reply may cite',
    x: col(4),
    y: lane(3),
  },
  {
    id: 'knowledge',
    kind: 'data',
    label: 'Knowledge base',
    does: 'Laws, SOPs, court decisions, guidelines and web pages, split into passages',
    input: 'Shipped documents and those staff add',
    output: 'Passages with document and page',
    x: col(5),
    y: lane(3),
  },
  {
    id: 'drafter_agent',
    kind: 'llm',
    label: 'Reply drafter',
    does: 'Drafts the reply in the citizen’s language; the ADK Workflow rewrites it once if the output guardrail flags it',
    input: 'Report (or its restatement if flagged), triage, routing, passages, procedure, contacts, check findings',
    output: 'Reply with citations, next step for the caseworker',
    x: col(5),
    y: lane(2),
  },
  {
    id: 'output_guard',
    kind: 'code',
    label: 'Output guardrail',
    does: 'Checks the draft before staff see it; a flagged draft goes back to the drafter once',
    input: 'Draft reply',
    output: 'Warnings: personal data, links, citations, promises, leaked instructions',
    x: col(6),
    y: lane(1),
  },
  {
    id: 'supervisor',
    kind: 'human',
    label: 'Supervisor',
    does: 'Receives escalations and delegates them',
    input: 'Alert with the case summary',
    output: 'The person in charge and a note',
    x: col(5),
    y: lane(0),
  },
  {
    id: 'human',
    kind: 'human',
    label: 'Caseworker',
    does: 'Reviews, edits and approves; ticks the procedure stages',
    input: 'Draft, warnings, agent trace',
    output: 'Reply sent to the citizen on the same channel',
    x: col(6),
    y: lane(0),
  },
]

/** Assistants for staff, outside the report pipeline: each an ADK LlmAgent with function tools. */
const STAFF: Agent[] = [
  {
    id: 'head',
    kind: 'human',
    label: 'Head of office',
    does: 'Asks about trends; reads the weekly brief',
    input: 'Answers with figures and case numbers',
    output: 'A question',
    x: 0,
    y: 70,
  },
  {
    id: 'analyst_agent',
    kind: 'llm',
    label: 'Analyst agent',
    does: 'Answers the head of office and writes the weekly brief',
    input: 'A question, or the weekly brief request',
    output: 'Answer with figures and case numbers',
    tools: ['get_overview', 'find_clusters', 'search_tickets'],
    x: 240,
    y: 70,
  },
  {
    id: 'get_overview',
    kind: 'tool',
    label: 'get_overview',
    does: 'Counts by case type, urgency, status and channel; SLA breaches; this week against last',
    input: 'Window in days',
    output: 'Aggregates, no personal data',
    x: 500,
    y: 0,
  },
  {
    id: 'find_clusters',
    kind: 'tool',
    label: 'find_clusters',
    does: 'Groups of 3 or more cases sharing a place, institution or aid programme',
    input: 'Window in days',
    output: 'Clusters: early warnings of a systemic problem',
    x: 500,
    y: 80,
  },
  {
    id: 'search_tickets',
    kind: 'tool',
    label: 'search_tickets',
    does: 'Cases whose masked summary or entities mention a keyword',
    input: 'A keyword',
    output: 'Up to 15 cases, no personal data',
    x: 500,
    y: 160,
  },
  {
    id: 'cases',
    kind: 'data',
    label: 'Cases',
    does: 'Firestore: every case with its triage, routing, trace and audit trail',
    input: 'Writes from the report pipeline and staff',
    output: 'Live data for the tools',
    x: 740,
    y: 80,
  },
  {
    id: 'staff_caseworker',
    kind: 'human',
    label: 'Caseworker',
    does: 'Asks about any document, or drafts a case’s legal basis',
    input: 'Answer with cited articles',
    output: 'A question, or a case (masked summary only)',
    x: 0,
    y: 300,
  },
  {
    id: 'document_agent',
    kind: 'llm',
    label: 'Document agent',
    does: 'Finds and answers from the agency’s documents (laws, SOPs, guidelines, web pages), and drafts the legal basis of a case for its file, the police or a court',
    input: 'A question, or the case summary, case type and the laws listed for it',
    output: 'Markdown answer citing [document, page]; citations it was not given are flagged',
    tools: ['search_documents'],
    x: 240,
    y: 300,
  },
  {
    id: 'search_documents',
    kind: 'tool',
    label: 'search_documents',
    does: 'BM25 search over all documents of the knowledge base, called several times per answer',
    input: 'Search words',
    output: 'Up to 5 passages with an exact reference',
    x: 500,
    y: 300,
  },
  {
    id: 'staff_knowledge',
    kind: 'data',
    label: 'Knowledge base',
    does: 'Laws, SOPs, court decisions, guidelines and web pages; staff-only documents included',
    input: 'Documents added on the Knowledge page',
    output: 'Passages',
    x: 740,
    y: 300,
  },
]

interface Link {
  id: string
  from: string
  to: string
  label: string
  fromSide?: Side
  toSide?: Side
  optional?: boolean
}
type Side = 't' | 'r' | 'b' | 'l'

const PIPE_LINKS: Link[] = [
  { id: 'in', from: 'report', to: 'input_guard', label: 'text, voice, photo', fromSide: 'b', toSide: 't' },
  {
    id: 'media',
    from: 'input_guard',
    to: 'media_reader',
    label: 'attachments',
    fromSide: 'b',
    toSide: 'l',
    optional: true,
  },
  {
    id: 'intake',
    from: 'input_guard',
    to: 'intake_agent',
    label: 'report, fenced as data',
    fromSide: 'r',
    toSide: 't',
  },
  {
    id: 'media_out',
    from: 'media_reader',
    to: 'intake_agent',
    label: 'transcript, photo',
    fromSide: 'r',
    toSide: 'l',
    optional: true,
  },
  {
    id: 'triage',
    from: 'intake_agent',
    to: 'triage_agent',
    label: 'masked text, entities',
    fromSide: 'r',
    toSide: 'l',
  },
  { id: 'missing', from: 'intake_agent', to: 'followup', label: 'missing details', fromSide: 't', toSide: 'b' },
  { id: 'ask', from: 'followup', to: 'report', label: 'up to 2 questions', fromSide: 't', toSide: 'r' },
  {
    id: 'rules',
    from: 'triage_agent',
    to: 'policy_agent',
    label: 'case type, urgency, flags',
    fromSide: 'r',
    toSide: 'b',
  },
  { id: 'alert', from: 'policy_agent', to: 'alert', label: 'escalated', fromSide: 'r', toSide: 'l' },
  { id: 'notify', from: 'alert', to: 'supervisor', label: 'alert in seconds', fromSide: 't', toSide: 'b' },
  { id: 'search', from: 'policy_agent', to: 'sop_agent', label: 'case type, summary', fromSide: 'b', toSide: 't' },
  { id: 'kb', from: 'sop_agent', to: 'knowledge', label: 'BM25', fromSide: 'r', toSide: 'l' },
  { id: 'passages', from: 'knowledge', to: 'drafter_agent', label: '3 passages', fromSide: 't', toSide: 'b' },
  {
    id: 'route',
    from: 'policy_agent',
    to: 'drafter_agent',
    label: 'route, team, SLA, procedure',
    fromSide: 'r',
    toSide: 'l',
  },
  { id: 'draft', from: 'drafter_agent', to: 'output_guard', label: 'draft with citations', fromSide: 'r', toSide: 'b' },
  {
    id: 'rewrite',
    from: 'output_guard',
    to: 'drafter_agent',
    label: 'findings: rewrite once',
    fromSide: 'l',
    toSide: 't',
    optional: true,
  },
  { id: 'review', from: 'output_guard', to: 'human', label: 'draft and warnings', fromSide: 't', toSide: 'b' },
  { id: 'delegate', from: 'supervisor', to: 'human', label: 'delegates', fromSide: 'r', toSide: 'l' },
  { id: 'reply', from: 'human', to: 'report', label: 'approved reply', fromSide: 't', toSide: 't' },
]
const STAFF_LINKS: Link[] = [
  { id: 'q', from: 'head', to: 'analyst_agent', label: 'question' },
  { id: 'o', from: 'analyst_agent', to: 'get_overview', label: 'calls' },
  { id: 'c', from: 'analyst_agent', to: 'find_clusters', label: 'calls' },
  { id: 's', from: 'analyst_agent', to: 'search_tickets', label: 'calls' },
  { id: 'o2', from: 'get_overview', to: 'cases', label: '' },
  { id: 'c2', from: 'find_clusters', to: 'cases', label: '' },
  { id: 's2', from: 'search_tickets', to: 'cases', label: '' },
  { id: 'lq', from: 'staff_caseworker', to: 'document_agent', label: 'question or case' },
  { id: 'ld', from: 'document_agent', to: 'search_documents', label: 'calls, several times' },
  { id: 'lk', from: 'search_documents', to: 'staff_knowledge', label: 'BM25' },
]

/** The deployment on Google Cloud: what runs where and what talks to what. */
const R = (r: number) => 40 + r * 120
const C = (c: number) => [20, 240, 490, 700, 950, 1190][c]
const ARCH: Agent[] = [
  {
    id: 'a_citizen',
    kind: 'human',
    label: 'Citizen',
    does: 'Reports by web chat or Telegram',
    input: 'Approved replies',
    output: 'Text, voice notes, photos',
    x: C(0),
    y: R(0),
  },
  {
    id: 'a_staff',
    kind: 'human',
    label: 'Staff',
    does: 'Caseworkers, supervisor and head of office in the browser',
    input: 'Cases, drafts, alerts, insights',
    output: 'Approvals, delegations, settings',
    x: C(0),
    y: R(2),
  },
  {
    id: 'a_telegram',
    kind: 'io',
    label: 'Telegram Bot API',
    does: 'One bot per agency; updates arrive by webhook with a secret header',
    input: 'Approved replies, questions',
    output: 'Messages, voice notes, photos',
    x: C(1),
    y: R(0),
  },
  {
    id: 'a_domain',
    kind: 'io',
    label: 'embrace.nalaria.ai.id',
    does: 'Custom domain with managed HTTPS on Firebase App Hosting',
    input: 'Browser requests',
    output: 'Pages and API calls',
    x: C(1),
    y: R(2),
  },
  {
    id: 'a_next',
    kind: 'cloud',
    label: 'Next.js app',
    does: 'Pages and API routes on Firebase App Hosting (Cloud Run, asia-southeast1); no Firebase SDK or key in the browser',
    input: 'Web chat, staff app, Telegram webhook',
    output: 'Cases, replies, events',
    x: C(2),
    y: R(0),
  },
  {
    id: 'a_guard',
    kind: 'code',
    label: 'Guardrails and rules',
    does: 'Input screen, policy rules, output check, settings password, rate limits',
    input: 'Every report and every setup change',
    output: 'Flags, route, warnings',
    x: C(2),
    y: R(1),
  },
  {
    id: 'a_gov',
    kind: 'code',
    label: 'Governance plugin',
    does: 'ADK plugin on every runner: the model each agency chose, latency and tokens per call',
    input: 'Every model call',
    output: 'Trace steps, metrics, metadata-only logs',
    x: C(2),
    y: R(2),
  },
  {
    id: 'a_otel',
    kind: 'code',
    label: 'OpenTelemetry',
    does: 'ADK spans (invoke_agent, generate_content, execute_tool) and GenAI metrics',
    input: 'Spans and metrics',
    output: 'Exports to Google Cloud',
    x: C(2),
    y: R(3),
  },
  {
    id: 'a_adk',
    kind: 'llm',
    label: 'ADK agents',
    does: 'Report pipeline (media, intake, triage, rules, search, drafter), analyst and document agents',
    input: 'Reports, questions, cases',
    output: 'Triage, routing, drafts, answers',
    x: C(3),
    y: R(0),
  },
  {
    id: 'a_search',
    kind: 'tool',
    label: 'Document search',
    does: 'BM25 over the knowledge base, in process, no tokens',
    input: 'Search words',
    output: 'Passages to cite',
    x: C(3),
    y: R(1),
  },
  {
    id: 'a_gemini',
    kind: 'llm',
    label: 'Gemini API',
    does: 'Gemini 3.1 Flash-Lite; retries with backoff, safety settings per agent',
    input: 'Prompts with public text fenced as data',
    output: 'Structured JSON and drafts',
    x: C(4),
    y: R(0),
  },
  {
    id: 'a_firestore',
    kind: 'data',
    label: 'Firestore',
    does: 'Cases, agencies, knowledge base, integrations, notifications; clients denied',
    input: 'Server writes only',
    output: 'Live data',
    x: C(4),
    y: R(1),
  },
  {
    id: 'a_storage',
    kind: 'data',
    label: 'Cloud Storage',
    does: 'Public laws, portraits and brand files; private report photos, voice notes and added documents',
    input: 'Uploads from the server',
    output: 'Files',
    x: C(4),
    y: R(2),
  },
  {
    id: 'a_secrets',
    kind: 'data',
    label: 'Secret Manager',
    does: 'Gemini key, bot tokens, webhook secret, settings password',
    input: 'Set by the deployment',
    output: 'Environment of the app',
    x: C(4),
    y: R(3),
  },
  {
    id: 'a_budget',
    kind: 'cloud',
    label: 'Billing budget',
    does: 'Spend alerts on the project',
    input: 'Gemini and Cloud spend',
    output: 'Email alerts',
    x: C(5),
    y: R(0),
  },
  {
    id: 'a_pubsub',
    kind: 'cloud',
    label: 'Pub/Sub',
    does: 'Topic case-events: escalations, delegations, new messages',
    input: 'Case events',
    output: 'Push to the function',
    x: C(5),
    y: R(1),
  },
  {
    id: 'a_function',
    kind: 'cloud',
    label: 'Cloud Functions',
    does: 'onCaseEvent writes the notification the right person sees',
    input: 'Case events',
    output: 'Notifications in Firestore',
    x: C(5),
    y: R(2),
  },
  {
    id: 'a_trace',
    kind: 'cloud',
    label: 'Cloud Trace',
    does: 'Waterfall of every agent run, linked from the case and the control tower',
    input: 'Spans',
    output: 'Traces',
    x: C(2),
    y: R(4) + 20,
  },
  {
    id: 'a_monitoring',
    kind: 'cloud',
    label: 'Cloud Monitoring',
    does: 'Token use, latency and guardrail metrics; uptime check with an alert policy',
    input: 'Metrics, health checks',
    output: 'Dashboards and alerts',
    x: C(3),
    y: R(4) + 20,
  },
  {
    id: 'a_logging',
    kind: 'cloud',
    label: 'Cloud Logging',
    does: 'Structured logs with metadata only; settings changes as an audit log',
    input: 'JSON lines from Cloud Run',
    output: 'Searchable logs',
    x: C(4),
    y: R(4) + 20,
  },
]
const ARCH_GROUPS = [
  { id: 'g_run', label: 'Firebase App Hosting · Cloud Run', x: 470, y: 0, w: 420, h: 490 },
  { id: 'g_data', label: 'Firebase data', x: 930, y: 130, w: 210, h: 360 },
  { id: 'g_events', label: 'Events', x: 1170, y: 130, w: 210, h: 240 },
  { id: 'g_obs', label: 'Observability', x: 470, y: 510, w: 670, h: 130 },
]
const ARCH_LINKS: Link[] = [
  { id: 'a1', from: 'a_citizen', to: 'a_telegram', label: 'messages' },
  { id: 'a2', from: 'a_citizen', to: 'a_domain', label: 'web chat', fromSide: 'b', toSide: 't' },
  { id: 'a3', from: 'a_staff', to: 'a_domain', label: 'staff app' },
  { id: 'a4', from: 'a_telegram', to: 'a_next', label: 'webhook' },
  { id: 'a5', from: 'a_domain', to: 'a_next', label: 'HTTPS', fromSide: 'r', toSide: 'b' },
  { id: 'a6', from: 'a_next', to: 'a_adk', label: 'runs agents' },
  { id: 'a7', from: 'a_next', to: 'a_guard', label: 'every report', fromSide: 'b', toSide: 't' },
  { id: 'a8', from: 'a_adk', to: 'a_gemini', label: 'model calls' },
  { id: 'a9', from: 'a_adk', to: 'a_search', label: 'search', fromSide: 'b', toSide: 't' },
  { id: 'a10', from: 'a_search', to: 'a_firestore', label: 'added documents' },
  { id: 'a11', from: 'a_next', to: 'a_firestore', label: 'cases, agencies', fromSide: 'r', toSide: 't' },
  { id: 'a12', from: 'a_next', to: 'a_storage', label: 'files', fromSide: 'b', toSide: 'l' },
  { id: 'a13', from: 'a_secrets', to: 'a_guard', label: 'keys, tokens, password', fromSide: 'l', toSide: 'r' },
  { id: 'a14', from: 'a_next', to: 'a_pubsub', label: 'case events', fromSide: 't', toSide: 't' },
  { id: 'a15', from: 'a_pubsub', to: 'a_function', label: 'push', fromSide: 'b', toSide: 't' },
  { id: 'a16', from: 'a_function', to: 'a_firestore', label: 'notifications', fromSide: 'l', toSide: 'r' },
  { id: 'a17', from: 'a_adk', to: 'a_gov', label: 'every model call', fromSide: 'b', toSide: 'r' },
  { id: 'a18', from: 'a_gov', to: 'a_otel', label: 'spans, metrics', fromSide: 'b', toSide: 't' },
  { id: 'a19', from: 'a_otel', to: 'a_trace', label: 'traces', fromSide: 'b', toSide: 't' },
  { id: 'a20', from: 'a_otel', to: 'a_monitoring', label: 'metrics', fromSide: 'r', toSide: 't' },
  { id: 'a21', from: 'a_gov', to: 'a_logging', label: 'logs, no content', fromSide: 'r', toSide: 'l' },
  { id: 'a22', from: 'a_gemini', to: 'a_budget', label: 'spend' },
  { id: 'a23', from: 'a_monitoring', to: 'a_domain', label: 'uptime check', fromSide: 'l', toSide: 'b' },
]

/** One report through the pipeline over two turns of conversation, as the simulation plays it. */
interface Step {
  caption: string
  nodes: string[]
  links: string[]
  say?: { who: 'citizen' | 'bot' | 'event'; text: string }
}
const STEPS: Step[] = [
  {
    caption: 'Press Play to follow one report through the agents, over two turns of conversation.',
    nodes: [],
    links: [],
  },
  {
    caption:
      'Turn 1. The input guardrail (code) checks the rate limit, spam and prompt injection. The report is clean and goes on fenced as data.',
    nodes: ['report', 'input_guard'],
    links: ['in'],
    say: {
      who: 'citizen',
      text: 'Please help, the boy next door is beaten by his stepfather every night. Today he had bruises.',
    },
  },
  {
    caption:
      'No voice note or photo, so the media agent is skipped. The intake agent detects English, masks names and restates the report. The place is missing.',
    nodes: ['input_guard', 'intake_agent'],
    links: ['intake'],
  },
  {
    caption: 'The triage agent: physical abuse, critical, safety flag child_safety, confidence 0.92.',
    nodes: ['intake_agent', 'triage_agent'],
    links: ['triage'],
  },
  {
    caption:
      'Policy rules (code): the child_safety flag escalates the case. Route escalated, SLA 2 hours, child protection team. The model cannot lower this.',
    nodes: ['triage_agent', 'policy_agent'],
    links: ['rules'],
  },
  {
    caption: 'Escalation publishes a case event: Pub/Sub and a Cloud Function alert the supervisor in seconds.',
    nodes: ['policy_agent', 'alert', 'supervisor'],
    links: ['alert', 'notify'],
    say: { who: 'event', text: 'Supervisor alerted: critical case, child safety' },
  },
  {
    caption:
      'Document search (BM25, no tokens) finds 3 passages in the knowledge base: UU 35/2014, PP 78/2021 and the SOP.',
    nodes: ['policy_agent', 'sop_agent', 'knowledge'],
    links: ['search', 'kb'],
  },
  {
    caption:
      'The reply drafter writes in the citizen’s language with citations. The output guardrail checks for personal data, links, promises and leaked instructions.',
    nodes: ['knowledge', 'drafter_agent', 'output_guard'],
    links: ['passages', 'route', 'draft'],
  },
  {
    caption:
      'Follow-up questions (code, no tokens): the agency needs the place and the child’s age, so the bot asks at most 2 questions.',
    nodes: ['intake_agent', 'followup', 'report'],
    links: ['missing', 'ask'],
    say: { who: 'bot', text: 'Thank you. To help quickly: which village or district is this in? How old is the boy?' },
  },
  {
    caption: 'Turn 2. The answers join the report and pass the input guardrail again.',
    nodes: ['report', 'input_guard', 'intake_agent'],
    links: ['in', 'intake'],
    say: { who: 'citizen', text: 'Tambun, Bekasi. He is about 7.' },
  },
  {
    caption:
      'The agents run again on the fuller picture. Re-runs can only raise urgency; an escalated case stays escalated.',
    nodes: ['intake_agent', 'triage_agent', 'policy_agent'],
    links: ['triage', 'rules'],
  },
  {
    caption:
      'The supervisor delegates the case. The new draft waits for the caseworker: nothing reaches the citizen before a person approves.',
    nodes: ['drafter_agent', 'output_guard', 'supervisor', 'human'],
    links: ['draft', 'review', 'delegate'],
    say: { who: 'event', text: 'Delegated to the caseworker with a note' },
  },
  {
    caption: 'The caseworker edits and approves. The reply goes back on the same channel, web chat or Telegram.',
    nodes: ['human', 'report'],
    links: ['reply'],
    say: {
      who: 'bot',
      text: 'Thank you for telling us. Your report is with our child protection team and a supervisor has been alerted. If the boy is in danger right now, call 129.',
    },
  },
]

/** Every tool the agents and the pipeline use, and when. */
const TOOLS: { name: string; kind: string; by: string; what: string }[] = [
  {
    name: 'search_documents',
    kind: 'ADK function tool',
    by: 'Document agent',
    what: 'BM25 search over all knowledge-base documents; returns up to 5 passages with an exact reference to cite.',
  },
  {
    name: 'get_overview',
    kind: 'ADK function tool',
    by: 'Analyst agent',
    what: 'Counts by case type, urgency, status and channel, SLA breaches, median response and resolution hours, this week against last.',
  },
  {
    name: 'find_clusters',
    kind: 'ADK function tool',
    by: 'Analyst agent',
    what: '3 or more cases sharing a place, institution or aid programme: early warnings of a systemic problem.',
  },
  {
    name: 'search_tickets',
    kind: 'ADK function tool',
    by: 'Analyst agent',
    what: 'Up to 15 cases whose masked summary or entities mention a keyword. No personal data.',
  },
  {
    name: 'Document search (sop_agent)',
    kind: 'Pipeline step, no tokens',
    by: 'Report pipeline',
    what: 'BM25 over the documents replies may cite; its 3 passages are the only procedures the drafter may state.',
  },
  {
    name: 'Input guardrail (screenInput)',
    kind: 'Code',
    by: 'Before any model call',
    what: 'Rate limit, spam filter and prompt-injection screen. A flagged report is kept, sent to a person, and the drafter sees only a neutral restatement.',
  },
  {
    name: 'Policy rules (decide)',
    kind: 'Code',
    by: 'After triage',
    what: 'Escalates on a critical rating, a safety flag, an always-escalate case type, an escalation word or a photo safety concern; applies minimum urgency per case type; low confidence goes to manual review.',
  },
  {
    name: 'Follow-up questions (missingDetails)',
    kind: 'Code',
    by: 'After the first run',
    what: 'Asks for the place, age or time the agency needs, at most 2 questions, then runs the agents again.',
  },
  {
    name: 'Output guardrail (checkDraft)',
    kind: 'Code',
    by: 'After the drafter',
    what: 'Finds personal data, links, wrong citations, a missing ticket number, promised outcomes and leaked instructions. In the ADK Workflow: a flagged draft is rewritten once with the findings; what remains is shown to the caseworker.',
  },
  {
    name: 'Case events (Pub/Sub, Cloud Function)',
    kind: 'Google Cloud',
    by: 'Escalation, delegation, new messages',
    what: 'Publishes to the case-events topic; the onCaseEvent function writes the notification the person sees in seconds.',
  },
  {
    name: 'Telegram Bot API',
    kind: 'Channel',
    by: 'Bot and caseworker',
    what: 'Receives reports by webhook; sends questions, and replies only after a caseworker approves them.',
  },
]

interface NodeData extends Record<string, unknown> {
  agent: Agent
  kindLabel: string
  model?: string
  active: boolean
  on: boolean
}
const SIDES: Record<Side, Position> = { t: Position.Top, r: Position.Right, b: Position.Bottom, l: Position.Left }

function AgentNode({ data }: NodeProps<Node<NodeData>>) {
  const a = data.agent
  return (
    <div className={`am-node rf ${a.kind} ${data.active ? 'active' : ''} ${data.on ? 'on' : ''}`}>
      {(Object.keys(SIDES) as Side[]).map((s) => (
        <span key={s}>
          <Handle type="source" id={s} position={SIDES[s]} isConnectable={false} />
          <Handle type="target" id={`${s}-in`} position={SIDES[s]} isConnectable={false} />
        </span>
      ))}
      <span className="am-kind">{data.kindLabel}</span>
      <b>{data.label as string}</b>
      {data.model && <code>{data.model.replace('gemini-', '')}</code>}
    </div>
  )
}
function GroupNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="am-group">
      <span>{data.label}</span>
    </div>
  )
}
function LaneNode({ data }: NodeProps<Node<{ label: string; odd: boolean }>>) {
  return (
    <div className={`am-lane ${data.odd ? 'odd' : ''}`}>
      <span>{data.label}</span>
    </div>
  )
}
const NODE_TYPES = { agent: AgentNode, lane: LaneNode, group: GroupNode }

/** What each agent reads and writes, for the conversation trace on the case page. */
export const AGENT_IO: Record<string, { input: string; output: string }> = Object.fromEntries(
  [...PIPELINE, ...STAFF].map((n) => [n.id, { input: n.input, output: n.output }]),
)

/** Interactive map of the agents (React Flow): the report pipeline in swimlanes with a two-turn simulation, the staff
 * assistants with their tools, and the list of every tool. Pick a box to see its input, output, model and figures. */
export function AgentMap({ models, stats }: { models: Record<string, string>; stats: AiReport['agents'] }) {
  const t = useT()
  const [view, setView] = useState<'pipeline' | 'staff' | 'arch'>('pipeline')
  const [sel, setSel] = useState('')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const agents = view === 'pipeline' ? PIPELINE : view === 'staff' ? STAFF : ARCH
  const links = view === 'pipeline' ? PIPE_LINKS : view === 'staff' ? STAFF_LINKS : ARCH_LINKS
  const cur = view === 'pipeline' ? STEPS[step] : null

  const last = step >= STEPS.length - 1
  const running = playing && !last
  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setStep((s) => s + 1), 3200)
    return () => clearTimeout(id)
  }, [running, step])

  const nodes = useMemo<Node[]>(() => {
    const width = Math.max(...PIPELINE.map((a) => a.x)) + 230
    const lanes: Node[] =
      view === 'pipeline'
        ? LANES.map((l, i) => ({
            id: `lane-${l.id}`,
            type: 'lane',
            position: { x: 0, y: i * LANE_H },
            data: { label: t(l.label), odd: i % 2 === 1 },
            style: { width, height: LANE_H },
            draggable: false,
            selectable: false,
            zIndex: -1,
          }))
        : view === 'arch'
          ? ARCH_GROUPS.map((g) => ({
              id: g.id,
              type: 'group',
              position: { x: g.x, y: g.y },
              data: { label: t(g.label) },
              style: { width: g.w, height: g.h },
              draggable: false,
              selectable: false,
              zIndex: -1,
            }))
          : []
    return [
      ...lanes,
      ...agents.map((a) => ({
        id: a.id,
        type: 'agent',
        position: { x: a.x, y: a.y },
        data: {
          agent: a,
          label: t(a.label),
          kindLabel: t(KIND[a.kind]),
          model: models[a.id],
          active: !!cur?.nodes.includes(a.id),
          on: sel === a.id,
        } satisfies NodeData & { label: string },
        draggable: false,
      })),
    ]
  }, [view, agents, models, cur, sel, t])

  const edges = useMemo<Edge[]>(
    () =>
      links.map((l) => {
        const active = !!cur?.links.includes(l.id)
        const near = sel === l.from || sel === l.to
        return {
          id: l.id,
          source: l.from,
          target: l.to,
          sourceHandle: l.fromSide ?? 'r',
          targetHandle: `${l.toSide ?? 'l'}-in`,
          type: 'smoothstep',
          animated: active,
          label: l.label ? t(l.label) : undefined,
          className: `am-edge ${active ? 'active' : ''} ${near ? 'near' : ''} ${l.optional ? 'optional' : ''}`,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 6,
        }
      }),
    [links, cur, sel, t],
  )

  const node = [...PIPELINE, ...STAFF, ...ARCH].find((n) => n.id === sel)
  const live = stats.find((s) => s.agent === sel)
  const chat = view === 'pipeline' ? STEPS.slice(0, step + 1).filter((s) => s.say) : []

  return (
    <Card title={t('How the agents work')} icon="spark" className="agent-map">
      <div className="am-top">
        <p className="muted small">
          {view === 'pipeline'
            ? t(
                'Every report runs one ADK Workflow: each Gemini agent reads the state the previous ones wrote, with code guardrails and rules around them and a person at the end. Pick a box to see what goes in and out.',
              )
            : view === 'staff'
              ? t(
                  'Assistants for staff, outside the report pipeline: each is an ADK agent that calls function tools over live data and cites what it found.',
                )
              : t(
                  'Where everything runs on Google Cloud and Firebase, and what talks to what. Pick a box to see what it does.',
                )}
        </p>
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={view === 'pipeline'}
            className={view === 'pipeline' ? 'on' : ''}
            onClick={() => {
              setView('pipeline')
              setSel('')
            }}
          >
            {t('Citizen reports')}
          </button>
          <button
            role="tab"
            aria-selected={view === 'staff'}
            className={view === 'staff' ? 'on' : ''}
            onClick={() => {
              setView('staff')
              setSel('')
              setPlaying(false)
            }}
          >
            {t('Staff assistants')}
          </button>
          <button
            role="tab"
            aria-selected={view === 'arch'}
            className={view === 'arch' ? 'on' : ''}
            onClick={() => {
              setView('arch')
              setSel('')
              setPlaying(false)
            }}
          >
            {t('Architecture')}
          </button>
        </div>
      </div>

      <div className={`am-stage ${view}`}>
        <div className="am-canvas">
          <ReactFlow
            key={view}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, n) => n.type === 'agent' && setSel(n.id)}
            fitView
            fitViewOptions={{ padding: 0.04 }}
            minZoom={0.3}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            zoomOnScroll={false}
            preventScrolling={false}
          >
            <Background gap={24} size={1} color="#e3e7ee" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        {view === 'pipeline' && (
          <aside className="am-sim" aria-label={t('Simulation')}>
            <div className="am-sim-h">
              <b>{t('Simulation')}</b>
              <span className="muted small">{t('Step {n} of {m}', { n: step, m: STEPS.length - 1 })}</span>
            </div>
            <div className="am-sim-ctl">
              <button
                type="button"
                className="ghost small"
                aria-label={t('Previous step')}
                disabled={step === 0}
                onClick={() => {
                  setPlaying(false)
                  setStep(step - 1)
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="primary small"
                onClick={() => {
                  if (last) setStep(0)
                  setPlaying(!running)
                }}
              >
                {running ? t('Pause') : last ? t('Replay') : t('Play')}
              </button>
              <button
                type="button"
                className="ghost small"
                aria-label={t('Next step')}
                disabled={step >= STEPS.length - 1}
                onClick={() => {
                  setPlaying(false)
                  setStep(step + 1)
                }}
              >
                ›
              </button>
            </div>
            <p className="am-caption" aria-live="polite">
              {t(STEPS[step].caption)}
            </p>
            <div className="am-chat">
              {chat.map((s, i) => (
                <div key={i} className={`am-say ${s.say!.who}`}>
                  {s.say!.who === 'event' ? <Icon name="bell" size={12} /> : null}
                  {t(s.say!.text)}
                </div>
              ))}
              {!chat.length && <p className="muted small">{t('The conversation appears here.')}</p>}
            </div>
          </aside>
        )}
      </div>

      {!node && (
        <p className="am-detail muted small">
          {t('Pick a box to see what goes in and out, its model and its figures.')}
        </p>
      )}
      {node && (
        <div className="am-detail" aria-live="polite">
          <h3>
            {t(node.label)} <span className={`am-kind ${node.kind}`}>{t(KIND[node.kind])}</span>
          </h3>
          <p>
            {t(node.does)}
            {node.when ? ` · ${t(node.when)}` : ''}
          </p>
          <dl>
            <dt>{t('Input')}</dt>
            <dd>{t(node.input)}</dd>
            <dt>{t('Output')}</dt>
            <dd>{t(node.output)}</dd>
            {models[node.id] && (
              <>
                <dt>{t('Model')}</dt>
                <dd>
                  <code>{models[node.id]}</code>
                </dd>
              </>
            )}
            {node.tools && (
              <>
                <dt>{t('Tools')}</dt>
                <dd>
                  {node.tools.map((x) => (
                    <code key={x}>{x} </code>
                  ))}
                </dd>
              </>
            )}
            {live && (
              <>
                <dt>{t('Last 30 days')}</dt>
                <dd>
                  {t('{n} calls · p50 {p} s · {k} tokens', {
                    n: live.calls,
                    p: (live.p50_ms / 1000).toFixed(1),
                    k: (live.tokens_in + live.tokens_out).toLocaleString(),
                  })}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      <h3 className="am-tools-h">
        <Icon name="rules" size={16} /> {t('Tools and checks')}
      </h3>
      <div className="am-tools-table" role="table" aria-label={t('Tools and checks')}>
        <div role="row" className="am-tr head">
          <span role="columnheader">{t('Tool')}</span>
          <span role="columnheader">{t('Kind')}</span>
          <span role="columnheader">{t('Used by')}</span>
          <span role="columnheader">{t('What it does')}</span>
        </div>
        {TOOLS.map((x) => (
          <div role="row" key={x.name} className="am-tr">
            <span role="cell">
              <code>{t(x.name)}</code>
            </span>
            <span role="cell" className="small">
              {t(x.kind)}
            </span>
            <span role="cell" className="small">
              {t(x.by)}
            </span>
            <span role="cell" className="small muted">
              {t(x.what)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
