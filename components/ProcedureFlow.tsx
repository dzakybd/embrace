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
import { useMemo } from 'react'
import type { T } from '@/lib/i18n'
import { ACTORS, stageTitle, type Stage } from './Procedures'

const LW = 200,
  NW = 172,
  NH = 58,
  RH = 84,
  HEAD = 48

type StageData = { n: number; title: string; who: string; state: string }

function StageNode({ data }: NodeProps<Node<StageData>>) {
  return (
    <div className={`pf-node ${data.state}`} title={`${data.n}. ${data.title} · ${data.who}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className="pf-n">{data.state === 'done' ? '✓' : data.n}</span>
      <span className="pf-t">{data.title}</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}
function LaneNode({ data }: NodeProps<Node<{ label: string; odd: boolean }>>) {
  return (
    <div className={`pf-lane ${data.odd ? 'odd' : ''}`}>
      <span>{data.label}</span>
    </div>
  )
}
const TYPES = { stage: StageNode, lane: LaneNode }

/** The procedure as a swimlane diagram (React Flow): one lane per actor, one box per stage, arrows in order. Done
 * stages are green, the current one blue with a moving arrow into it (tracking and case pages). On narrow screens it
 * becomes a numbered list. */
export function FlowDiagram({
  stages,
  lang,
  t,
  done = [],
  current,
}: {
  stages: Stage[]
  lang: string
  t: T
  done?: number[]
  current?: number
}) {
  const lanes = ACTORS.filter((a) => stages.some((s) => (s.who ?? 'caseworker') === a.id))
  const lane = (s: Stage) =>
    Math.max(
      0,
      lanes.findIndex((a) => a.id === (s.who ?? 'caseworker')),
    )
  const state = (i: number) => (done.includes(i) ? 'done' : i === current ? 'now' : '')
  const height = HEAD + stages.length * RH + 8
  const key = `${lang}:${stages.map((s) => `${s.title}|${s.who}`).join(',')}:${done.join(',')}:${current}`

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [
      ...lanes.map((a, k) => ({
        id: `lane-${a.id}`,
        type: 'lane',
        position: { x: k * LW, y: 0 },
        data: { label: t(a.label), odd: k % 2 === 1 },
        style: { width: LW, height },
        draggable: false,
        selectable: false,
        zIndex: -1,
      })),
      ...stages.map((s, i) => ({
        id: `s${i}`,
        type: 'stage',
        position: { x: lane(s) * LW + (LW - NW) / 2, y: HEAD + i * RH + (RH - NH) / 2 },
        data: {
          n: i + 1,
          title: stageTitle(s, lang),
          who: t(ACTORS.find((a) => a.id === (s.who ?? 'caseworker'))?.label ?? ''),
          state: state(i),
        },
        draggable: false,
      })),
    ]
    const edges: Edge[] = stages.slice(1).map((_, j) => ({
      id: `e${j}`,
      source: `s${j}`,
      target: `s${j + 1}`,
      type: 'smoothstep',
      animated: j + 1 === current,
      className: `pf-edge ${done.includes(j) ? 'done' : ''} ${j + 1 === current ? 'now' : ''}`,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }))
    return { nodes, edges }
    // `key` covers stages, language, progress and the current stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, t])

  return (
    <figure className="flow">
      <div className="pf-canvas" style={{ height: height + 16, maxWidth: lanes.length * LW + 24 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={TYPES}
          fitView
          fitViewOptions={{ padding: 0.03 }}
          minZoom={0.4}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          preventScrolling={false}
          aria-label={t('Procedure diagram')}
        >
          <Background gap={20} size={1} color="#eef1f5" />
          {stages.length > 6 && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
      <ol className="proc-stages flow-list">
        {stages.map((s, i) => (
          <li key={i} className={state(i)}>
            <span className="pdot">{i + 1}</span>
            <span>
              {stageTitle(s, lang)}{' '}
              <span className="muted small">
                · {t(ACTORS.find((a) => a.id === (s.who ?? 'caseworker'))?.label ?? '')}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
