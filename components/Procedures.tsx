// The agency's published procedures: which case types each covers, its stages, requirements and the Indonesian laws
// behind it. No hooks, so the public guide (server) and the staff Knowledge page (client) share it.
import type { T } from '@/lib/i18n'
import { Icon } from './ui'

export interface ProcedureT {
  id: string
  title: string
  title_id?: string
  categories: string[]
  requirements?: string[]
  requirements_id?: string[]
  note?: string
  note_id?: string
  stages: Stage[]
}
export interface Stage {
  title: string
  title_id?: string
  who?: string
}
export interface Doc {
  short: string
  title: string
  url: string
}
interface Cat {
  id: string
  label: string
  label_id?: string
  laws?: string[]
}

/** Who carries out a stage: one swimlane each in the diagram. */
export const ACTORS: { id: string; label: string }[] = [
  { id: 'citizen', label: 'Citizen' },
  { id: 'desk', label: 'Front desk' },
  { id: 'caseworker', label: 'Caseworker' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'head', label: 'Head of office' },
  { id: 'partner', label: 'Partner agency' },
]

const pick = <V,>(lang: string, en: V, id: V | undefined) => (lang === 'id' && id ? id : en)

export const procTitle = (p: { title: string; title_id?: string }, lang: string) => pick(lang, p.title, p.title_id)
export const stageTitle = (s: { title: string; title_id?: string }, lang: string) => pick(lang, s.title, s.title_id)
export const catLabel = (c: Cat, lang: string) => pick(lang, c.label, c.label_id)

export function LawLinks({ shorts, docs }: { shorts: string[]; docs: Doc[] }) {
  return (
    <ul className="law-links">
      {shorts.map((s) => {
        const d = docs.find((x) => x.short === s)
        return (
          <li key={s}>
            {d?.url ? (
              <a href={d.url} target="_blank" rel="noreferrer" title={d.title}>
                <Icon name="book" size={13} /> {s}
              </a>
            ) : (
              <span>{s}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function Procedures({
  procedures,
  categories,
  docs,
  lang,
  t,
}: {
  procedures: ProcedureT[]
  categories: Cat[]
  docs: Doc[]
  lang: string
  t: T
}) {
  if (!procedures.length) return <p className="muted">{t('This agency has not published its procedures yet.')}</p>
  return (
    <div className="procs">
      {procedures.map((p) => {
        const cats = categories.filter((c) => p.categories.includes(c.id))
        const laws = [...new Set(cats.flatMap((c) => c.laws ?? []))]
        const reqs = pick(lang, p.requirements, p.requirements_id)
        const note = pick(lang, p.note, p.note_id)
        return (
          <article key={p.id} id={p.id} className="card proc">
            <h3>{procTitle(p, lang)}</h3>
            <p className="proc-for">
              <span className="muted small">{t('For')}</span>{' '}
              {cats.map((c) => (
                <span key={c.id} className="tag">
                  {catLabel(c, lang)}
                </span>
              ))}
            </p>
            <FlowDiagram stages={p.stages} lang={lang} t={t} />
            {reqs && reqs.length > 0 && (
              <div className="proc-sub">
                <b>{t('What to bring')}</b>
                <ul>
                  {reqs.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {note && (
              <p className="proc-note">
                <Icon name="clock" size={14} /> {note}
              </p>
            )}
            {laws.length > 0 && (
              <div className="proc-sub">
                <b>{t('Legal basis')}</b>
                <LawLinks shorts={laws} docs={docs} />
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

const LW = 168,
  NW = 148,
  NH = 56,
  RH = 76,
  HEAD = 40

/** The procedure as a swimlane diagram: one lane per actor, one box per stage, arrows in order. Done stages are green
 * and the current one blue (tracking and case pages). On narrow screens it becomes a numbered list. */
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
  const W = lanes.length * LW,
    H = HEAD + stages.length * RH
  const box = (i: number) => ({ x: lane(stages[i]) * LW + (LW - NW) / 2, y: HEAD + i * RH + (RH - NH) / 2 })
  const state = (i: number) => (done.includes(i) ? 'done' : i === current ? 'now' : '')
  return (
    <figure className="flow">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Procedure diagram')} style={{ maxWidth: W }}>
        {lanes.map((a, k) => (
          <g key={a.id}>
            <rect x={k * LW} y={0} width={LW} height={H} className={`lane ${k % 2 ? 'odd' : ''}`} />
            <text x={k * LW + LW / 2} y={24} className="lane-h" textAnchor="middle">
              {t(a.label)}
            </text>
          </g>
        ))}
        {stages.slice(1).map((_, j) => {
          const a = box(j),
            b = box(j + 1)
          const x1 = a.x + NW / 2,
            y1 = a.y + NH,
            x2 = b.x + NW / 2,
            y2 = b.y
          const mid = (y1 + y2) / 2
          return (
            <path
              key={j}
              d={x1 === x2 ? `M${x1},${y1} V${y2 - 2}` : `M${x1},${y1} V${mid} H${x2} V${y2 - 2}`}
              className={`edge ${done.includes(j) ? 'done' : ''}`}
              markerEnd="url(#arrow)"
            />
          )
        })}
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
          </marker>
        </defs>
        {stages.map((s, i) => {
          const { x, y } = box(i)
          return (
            <g key={i} className={`node ${state(i)}`}>
              <rect x={x} y={y} width={NW} height={NH} rx={12} />
              <circle cx={x} cy={y} r={10} />
              <text x={x} y={y + 4} textAnchor="middle" className="n">
                {i + 1}
              </text>
              <foreignObject x={x + 6} y={y + 4} width={NW - 12} height={NH - 8}>
                <div className="node-t">{stageTitle(s, lang)}</div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
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
