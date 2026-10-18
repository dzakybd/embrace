// The agency's published procedures: which case types each covers, its stages, requirements and the Indonesian laws
// behind it. No hooks, so the public guide (server) and the staff Knowledge page (client) share it.
import type { T } from '@/lib/i18n'
import { FlowDiagram } from './ProcedureFlow'
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
