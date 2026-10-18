'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, type Citation, type SopSource } from '../api'
import { Card, Citations, Icon } from '../ui'
import { useLang } from '../Lang'
import { useStaff } from './StaffProvider'

const KIND: Record<string, string> = {
  law: 'Law',
  regulation: 'Regulation',
  sop: 'SOP',
  'service-flow': 'Service flow',
  'sample-sop': 'Sample SOP',
  uploaded: 'Uploaded',
}

const EXAMPLES: Record<string, string[]> = {
  dinsos_demak: [
    'certificate of DTSEN registration requirements',
    'aid for tidal flood victims',
    'illegal levy by an e-warong agent',
  ],
  kpai: ['online complaint incomplete data', 'closing a case', 'already reported to the police, oversight'],
}

export default function Knowledge() {
  const { t } = useLang()
  const { agency } = useStaff()
  const [sources, setSources] = useState<SopSource[]>([])
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Omit<Citation, 'n'>[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRes(null)
    api.sop(agency.id, '').then((r) => setSources(r.sources))
  }, [agency.id])

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
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{t('Knowledge base')}</h1>
          <p className="muted">{t('The procedures and regulations replies may cite. Search uses no AI tokens.')}</p>
        </div>
      </div>
      <Card title={t('Ask the SOP')} icon="book">
        <form
          className="ask"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim().length >= 3) search(q)
          }}
        >
          <label htmlFor="ask-sop" className="sr">
            {t('Search procedures and regulations')}
          </label>
          <input
            id="ask-sop"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Search procedures and regulations')}
          />
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
          (res.length ? (
            <Citations items={res} />
          ) : (
            <p className="muted">{t('No passage matches. Try other words.')}</p>
          ))}
      </Card>
      <h2 className="section-h">
        {t('Documents ({n})', { n: sources.length })}{' '}
        <Link className="small" href="/staff/case-types">
          {t('Case types and their stages')} →
        </Link>
      </h2>
      <section className="kb-grid">
        {sources.map((d) => (
          <a key={d.file} className="card kb-card" href={d.url || undefined} target="_blank" rel="noreferrer">
            <span className={`kb-kind ${d.kind}`}>{t(KIND[d.kind] ?? 'Document')}</span>
            <b>{d.short}</b>
            <span className="muted small clamp">{d.title}</span>
            <span className="muted small">{d.issuer}</span>
          </a>
        ))}
      </section>
    </div>
  )
}
