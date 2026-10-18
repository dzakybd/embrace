'use client'

import { useState } from 'react'
import type { AiReport } from '@/lib/ai-report'
import { useT } from '../Lang'
import { Card, Icon } from '../ui'

type Kind = 'io' | 'code' | 'llm' | 'rules' | 'tool' | 'human'
interface Node {
  id: string
  kind: Kind
  label: string
  does: string
  input: string
  output: string
  tools?: string[]
  when?: string
}

/** The report pipeline as ADK runs it (lib/agents/pipeline.ts): a SequentialAgent whose agents pass their output to
 * the next through session state, with code guardrails before and after and a person at the end. */
const PIPELINE: Node[] = [
  {
    id: 'report',
    kind: 'io',
    label: 'Citizen report',
    does: 'Web chat or Telegram bot',
    input: 'Text, voice note, photo',
    output: 'Report text and attachments',
  },
  {
    id: 'input_guard',
    kind: 'code',
    label: 'Input guardrail',
    does: 'Rate limit, spam filter, prompt-injection screen',
    input: 'Report text',
    output: 'Injection flag; the report fenced as data',
  },
  {
    id: 'media_reader',
    kind: 'llm',
    label: 'Media agent',
    does: 'Transcribes voice notes, describes photos',
    input: 'Voice notes and photos',
    output: 'Transcript, photo description, safety concern',
    when: 'Only when the report has attachments',
  },
  {
    id: 'intake_agent',
    kind: 'llm',
    label: 'Intake agent',
    does: 'Language, entities, personal-data masking',
    input: 'Report text and media results',
    output: 'Language, place, age, time, masked text, English restatement',
  },
  {
    id: 'triage_agent',
    kind: 'llm',
    label: 'Triage agent',
    does: 'Case type, urgency, safety flags',
    input: 'Intake result and the agency case types',
    output: 'Case type, urgency, flags, confidence',
  },
  {
    id: 'policy_agent',
    kind: 'rules',
    label: 'Policy rules',
    does: 'Escalation and routing in code, never by the model',
    input: 'Triage, escalation words, agency rules',
    output: 'Route, final urgency, team, SLA, the case procedure',
  },
  {
    id: 'sop_agent',
    kind: 'tool',
    label: 'Document search',
    does: 'BM25 search over the agency documents, no tokens',
    input: 'Case type, summary, entities',
    output: 'Top 3 passages of SOPs and Indonesian law',
  },
  {
    id: 'drafter_agent',
    kind: 'llm',
    label: 'Reply drafter',
    does: 'Drafts the reply in the citizen’s language',
    input: 'Report (or its restatement if flagged), triage, routing, passages, procedure',
    output: 'Reply with citations, next step for the caseworker',
  },
  {
    id: 'output_guard',
    kind: 'code',
    label: 'Output guardrail',
    does: 'Checks the draft before staff see it',
    input: 'Draft reply',
    output: 'Warnings: personal data, links, citations, promises, leaked instructions',
  },
  {
    id: 'human',
    kind: 'human',
    label: 'Caseworker',
    does: 'Reviews, edits and approves',
    input: 'Draft, warnings, agent trace',
    output: 'Reply sent to the citizen; procedure stages ticked',
  },
]
const ANALYST: Node = {
  id: 'analyst_agent',
  kind: 'llm',
  label: 'Analyst agent',
  does: 'Answers the head of office and writes the weekly brief',
  input: 'A question, or the weekly brief request',
  output: 'Answer with figures and case numbers',
  tools: ['get_overview', 'find_clusters', 'search_tickets'],
}
const SERVICES = [
  { icon: 'rules', label: 'Firestore', does: 'Cases, agencies, settings' },
  { icon: 'bell', label: 'Pub/Sub + Cloud Function', does: 'Escalation alerts to the supervisor' },
  { icon: 'eye', label: 'Cloud Trace, Monitoring, Logging', does: 'Every agent call traced (OpenTelemetry)' },
]
const KIND: Record<Kind, string> = {
  io: 'Channel',
  code: 'Code',
  llm: 'Gemini',
  rules: 'Rules',
  tool: 'Tool',
  human: 'Person',
}

/** What each agent reads and writes, for the conversation trace on the case page. */
export const AGENT_IO: Record<string, { input: string; output: string }> = Object.fromEntries(
  [...PIPELINE, ANALYST].map((n) => [n.id, { input: n.input, output: n.output }]),
)

/** Interactive map of the agents: pick a box to see its input, output, model and live figures. */
export function AgentMap({ models, stats }: { models: Record<string, string>; stats: AiReport['agents'] }) {
  const t = useT()
  const [sel, setSel] = useState('triage_agent')
  const all = [...PIPELINE, ANALYST]
  const node = all.find((n) => n.id === sel)!
  const live = stats.find((s) => s.agent === sel)
  const box = (n: Node) => (
    <button
      key={n.id}
      type="button"
      className={`am-node ${n.kind} ${sel === n.id ? 'on' : ''}`}
      onClick={() => setSel(n.id)}
      aria-pressed={sel === n.id}
    >
      <span className="am-kind">{t(KIND[n.kind])}</span>
      <b>{t(n.label)}</b>
      {models[n.id] && <code>{models[n.id].replace('gemini-', '')}</code>}
    </button>
  )
  return (
    <Card title={t('How the agents work')} icon="spark" className="agent-map">
      <p className="muted small">
        {t(
          'One ADK SequentialAgent per report: each agent reads the state the previous ones wrote. Pick a box to see what goes in and out.',
        )}
      </p>
      <div className="am-flow">
        <ol className="am-chain">
          {PIPELINE.map((n) => (
            <li key={n.id}>{box(n)}</li>
          ))}
        </ol>
        <div className="am-side">
          <div className="am-branch">
            {box(ANALYST)}
            <ul className="am-tools">
              {ANALYST.tools!.map((x) => (
                <li key={x}>
                  <Icon name="rules" size={12} /> <code>{x}</code>
                </li>
              ))}
            </ul>
          </div>
          <ul className="am-services">
            {SERVICES.map((s) => (
              <li key={s.label}>
                <Icon name={s.icon} size={14} /> <b>{s.label}</b> <span className="muted small">{t(s.does)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
    </Card>
  )
}
