'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api, type Citation, type LegalAnswer, type SopSource } from '../api'
import { Md } from '../Md'
import { Card, Citations, Icon } from '../ui'
import { useLang } from '../Lang'
import { useStaff } from './StaffProvider'

export const KIND: Record<string, string> = {
  law: 'Law',
  regulation: 'Regulation',
  sop: 'SOP',
  'service-flow': 'Service flow',
  court: 'Court decision',
  guideline: 'Guideline',
  template: 'Template',
  website: 'Web page',
  other: 'Other',
  'sample-sop': 'Sample SOP',
  uploaded: 'Uploaded',
}
/** Kinds staff can pick when adding a document. */
const ADD_KINDS = ['law', 'regulation', 'sop', 'service-flow', 'court', 'guideline', 'template', 'website', 'other']

const EXAMPLES: Record<string, string[]> = {
  dinsos_demak: [
    'certificate of DTSEN registration requirements',
    'aid for tidal flood victims',
    'illegal levy by an e-warong agent',
  ],
  kpai: ['online complaint incomplete data', 'closing a case', 'already reported to the police, oversight'],
}
const QUESTIONS: Record<string, string[]> = {
  dinsos_demak: [
    'Which rules say who may receive PBI health insurance, and how is a family proposed?',
    'What does the law say about cutting or charging fees on social aid?',
  ],
  kpai: [
    'What is the legal basis to report a parent who beats their child to the police?',
    'Which articles protect a child victim’s identity during a trial?',
  ],
}

const errText = (e: unknown) => {
  const m = String(e).replace(/^Error: \d+ /, '')
  try {
    return JSON.parse(m).error as string
  } catch {
    return m
  }
}

/** The knowledge base: laws, regulations, SOPs, court decisions, guidelines and web pages the agents and staff use.
 * Search is BM25 (no tokens); Ask runs the legal research agent, which cites the passages it found. */
export default function Knowledge() {
  const { t } = useLang()
  const { agency, me } = useStaff()
  const canEdit = me.role === 'leader' || me.role === 'supervisor'
  const [sources, setSources] = useState<SopSource[]>([])
  const [tab, setTab] = useState<'search' | 'ask'>('search')
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const load = useCallback(() => api.knowledge(agency.id).then((r) => setSources(r.sources)), [agency.id])
  useEffect(() => {
    load()
  }, [load])

  const kinds = [...new Set(sources.map((s) => s.kind))]
  const shown = sources.filter((s) => !filter || s.kind === filter)
  const remove = async (s: SopSource) => {
    setErr('')
    try {
      await api.removeKnowledge(agency.id, s.id ?? encodeURIComponent(s.file))
      await load()
    } catch (e) {
      setErr(errText(e))
    }
  }

  return (
    <div className="page knowledge">
      <div className="page-h">
        <div>
          <h1>{t('Knowledge base')}</h1>
          <p className="muted">
            {t(
              'Laws, regulations, SOPs, court decisions, guidelines and web pages. Reply drafts cite them for citizens; staff search them or ask the legal research agent, for example for the legal basis of a case file.',
            )}
          </p>
        </div>
        {canEdit && (
          <button className={adding ? 'tonal small' : 'primary small'} onClick={() => setAdding(!adding)}>
            <Icon name={adding ? 'close' : 'plus'} size={14} /> {adding ? t('Close') : t('Add document')}
          </button>
        )}
      </div>

      {adding && (
        <AddDocument
          onAdded={async () => {
            setAdding(false)
            await load()
          }}
        />
      )}

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'search'}
          className={tab === 'search' ? 'on' : ''}
          onClick={() => setTab('search')}
        >
          <Icon name="book" size={14} /> {t('Search (no AI)')}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'ask'}
          className={tab === 'ask' ? 'on' : ''}
          onClick={() => setTab('ask')}
        >
          <Icon name="spark" size={14} /> {t('Ask the legal research agent')}
        </button>
      </div>
      {tab === 'search' ? <Search /> : <Ask />}

      <h2 className="section-h">
        {t('Documents ({n})', { n: sources.length })}{' '}
        <Link className="small" href="/staff/case-types">
          {t('Case types and their stages')} →
        </Link>
      </h2>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {kinds.length > 1 && (
        <div className="samples kb-filter">
          <button className={`chip ${filter ? '' : 'on'}`} onClick={() => setFilter('')}>
            {t('All')}
          </button>
          {kinds.map((k) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
              {t(KIND[k] ?? 'Document')} · {sources.filter((s) => s.kind === k).length}
            </button>
          ))}
        </div>
      )}
      <section className="kb-grid">
        {shown.map((d) => (
          <div key={d.id ?? d.file} className="card kb-card">
            <span className="kb-tags">
              <span className={`kb-kind ${d.kind}`}>{t(KIND[d.kind] ?? 'Document')}</span>
              {d.id && (
                <span className={`tag ${d.for_replies ? '' : 'muted'}`}>
                  {d.for_replies ? t('cited in replies') : t('staff only')}
                </span>
              )}
            </span>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noreferrer">
                <b>{d.short}</b>
              </a>
            ) : (
              <b>{d.short}</b>
            )}
            <span className="muted small clamp">{d.title}</span>
            <span className="muted small">
              {d.issuer}
              {d.added_by ? ` · ${t('added by {name}', { name: d.added_by })}` : ''}
            </span>
            {canEdit && (
              <button
                type="button"
                className="ghost small danger kb-remove"
                title={d.id ? undefined : t('Reset demo data brings built-in documents back')}
                onClick={() => remove(d)}
              >
                {t('Remove')}
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}

function Search() {
  const { t } = useLang()
  const { agency } = useStaff()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Omit<Citation, 'n'>[] | null>(null)
  const [busy, setBusy] = useState(false)
  const search = async (query: string) => {
    setQ(query)
    setBusy(true)
    try {
      setRes((await api.sop(agency.id, query)).results)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim().length >= 3) search(q)
        }}
      >
        <label htmlFor="ask-sop" className="sr">
          {t('Search the documents')}
        </label>
        <input id="ask-sop" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search the documents')} />
        <button className="primary" disabled={busy || q.trim().length < 3}>
          {t('Search')}
        </button>
      </form>
      <div className="samples">
        {EXAMPLES[agency.id]?.map((x) => (
          <button key={x} className="chip" onClick={() => search(x)}>
            {x}
          </button>
        ))}
      </div>
      {busy && <div className="shimmer" />}
      {res &&
        (res.length ? <Citations items={res} /> : <p className="muted">{t('No passage matches. Try other words.')}</p>)}
    </Card>
  )
}

function Ask() {
  const { t } = useLang()
  const { agency, me } = useStaff()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<LegalAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ask = async (question: string) => {
    setQ(question)
    setBusy(true)
    setErr('')
    try {
      setRes(await api.askLegal(agency.id, { question, by: me.name }))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <p className="muted small">
        {t(
          'The agent searches the knowledge base several times and answers only from what it found, citing each passage. A draft for staff to check, not legal advice.',
        )}
      </p>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim().length >= 3) ask(q)
        }}
      >
        <label htmlFor="ask-legal" className="sr">
          {t('Ask a question about the law or a procedure')}
        </label>
        <input
          id="ask-legal"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Ask a question about the law or a procedure')}
        />
        <button className="primary" disabled={busy || q.trim().length < 3}>
          {busy ? t('Searching…') : t('Ask')}
        </button>
      </form>
      <div className="samples">
        {QUESTIONS[agency.id]?.map((x) => (
          <button key={x} className="chip" onClick={() => ask(t(x))}>
            {t(x)}
          </button>
        ))}
      </div>
      {busy && <div className="shimmer" />}
      {err && <p className="error">{err}</p>}
      {res && !busy && <LegalResult r={res} />}
    </Card>
  )
}

/** An answer of the legal research agent with the passages it searched. */
export function LegalResult({ r }: { r: LegalAnswer }) {
  const { t } = useLang()
  return (
    <div className="legal">
      {r.answer ? <Md text={r.answer} /> : <p className="muted">{t('The agent gave no answer. Try again.')}</p>}
      {!!r.unverified?.length && (
        <p className="banner warn small" role="note">
          <Icon name="alert" size={14} /> {t('Check these citations: they match no passage the agent found')}:{' '}
          {r.unverified.join('; ')}
        </p>
      )}
      {r.sources.length > 0 && (
        <details className="legal-src">
          <summary>{t('Passages the agent found ({n})', { n: r.sources.length })}</summary>
          <Citations items={r.sources} />
        </details>
      )}
      <p className="muted small">
        <Icon name="rules" size={12} /> {t('Legal research agent used:')}{' '}
        {t('{n} searches', { n: r.tools_used.length })}
      </p>
    </div>
  )
}

const readAs = (f: File, how: 'text' | 'base64') =>
  new Promise<string>((ok, bad) => {
    const r = new FileReader()
    r.onerror = () => bad(r.error)
    r.onload = () => ok(how === 'text' ? String(r.result) : (String(r.result).split(',')[1] ?? ''))
    if (how === 'text') r.readAsText(f)
    else r.readAsDataURL(f)
  })

/** Adds a PDF, Markdown or text file, a web page, or pasted text. Saving asks for the settings password. */
function AddDocument({ onAdded }: { onAdded: () => void }) {
  const { t } = useLang()
  const { agency, me } = useStaff()
  const [from, setFrom] = useState<'file' | 'website' | 'text'>('file')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('law')
  const [issuer, setIssuer] = useState('')
  const [forReplies, setForReplies] = useState(false)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ready =
    title.trim().length >= 2 && (from === 'file' ? !!file : from === 'website' ? !!url.trim() : text.trim().length > 20)

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      const body = { title: title.trim(), kind, issuer: issuer.trim(), for_replies: forReplies, by: me.name }
      if (from === 'website') await api.addKnowledge(agency.id, { ...body, url: url.trim() })
      else if (from === 'text') await api.addKnowledge(agency.id, { ...body, text })
      else if (file!.size > 6_000_000) throw new Error(t('The file is larger than 6 MB'))
      else if (/\.pdf$/i.test(file!.name) || file!.type === 'application/pdf')
        await api.addKnowledge(agency.id, { ...body, pdf_base64: await readAs(file!, 'base64'), file_name: file!.name })
      else await api.addKnowledge(agency.id, { ...body, text: await readAs(file!, 'text'), file_name: file!.name })
      onAdded()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('Add to the knowledge base')} icon="plus" className="kb-add">
      <div className="tabs" role="tablist">
        {(
          [
            ['file', 'File (PDF, Markdown, text)'],
            ['website', 'Web page'],
            ['text', 'Paste text'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={from === k}
            className={from === k ? 'on' : ''}
            onClick={() => setFrom(k)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {from === 'file' && (
        <label className="field">
          <span>{t('File')}</span>
          <input
            type="file"
            accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
            }}
          />
        </label>
      )}
      {from === 'website' && (
        <label className="field">
          <span>{t('Web address (https://…)')}</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
        </label>
      )}
      {from === 'text' && (
        <label className="field">
          <span>{t('Text')}</span>
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      <div className="row2">
        <label className="field">
          <span>{t('Title')}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('e.g. UU 35/2014 Child Protection')}
          />
        </label>
        <label className="field">
          <span>{t('Kind')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {ADD_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(KIND[k])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>{t('Issued by')}</span>
        <input
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder={t('e.g. Supreme Court, Ministry, the agency')}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={forReplies} onChange={(e) => setForReplies(e.target.checked)} />{' '}
        {t('Reply drafts may cite it to citizens (leave off for internal or court material)')}
      </label>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      <div className="copy-row">
        <button className="primary" disabled={!ready || busy} onClick={save}>
          {busy ? t('Reading…') : t('Add')}
        </button>
        <span className="muted small">
          {t('Saving asks for the settings password. Text is split into passages for search; no AI tokens are used.')}
        </span>
      </div>
    </Card>
  )
}
