'use client'

import { useEffect, useState } from 'react'
import { api, type Citation, type SopSource } from '../api'
import { Card, Citations, Icon } from '../ui'
import { useT } from '../Lang'
import { useStaff } from './StaffProvider'

const EXAMPLES: Record<string, string[]> = {
  dinsos_demak: ['certificate of DTSEN registration requirements', 'aid for tidal flood victims', 'illegal levy by an e-warong agent'],
  kpai: ['online complaint incomplete data', 'closing a case', 'already reported to the police, oversight'],
}

export default function Knowledge() {
  const t = useT()
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
          <h1>{t('Knowledge')}</h1>
          <p className="muted">{t('The procedures and regulations replies may cite. Search uses no AI tokens.')}</p>
        </div>
      </div>
      <div className="case-grid">
        <div className="col">
          <Card title={t('Ask the SOP')} icon="book">
            <form className="ask" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) search(q) }}>
              <label htmlFor="ask-sop" className="sr">{t('Search procedures and regulations')}</label>
              <input id="ask-sop" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search procedures and regulations')} />
              <button className="primary" disabled={busy || q.trim().length < 3}>{t('Search')}</button>
            </form>
            <div className="samples">
              {EXAMPLES[agency.id]?.map((x) => <button key={x} className="chip" onClick={() => search(x)}>{x}</button>)}
            </div>
            {busy && <div className="shimmer" />}
            {res && (res.length ? <Citations items={res} /> : <p className="muted">{t('No passage matches. Try other words.')}</p>)}
          </Card>
        </div>
        <div className="col">
          <Card title={t('Documents ({n})', { n: sources.length })} icon="form">
            <ul className="docs">
              {sources.map((s) => (
                <li key={s.file}>
                  <Icon name={s.kind.includes('sample') ? 'form' : 'book'} size={16} />
                  <div>
                    <a href={s.url} target="_blank" rel="noreferrer"><b>{s.short}</b></a>
                    <p className="muted small">{s.title}</p>
                    <span className="tag">{s.issuer}</span>
                  </div>
                </li>
              ))}
            </ul>
                      </Card>
        </div>
      </div>
    </div>
  )
}
