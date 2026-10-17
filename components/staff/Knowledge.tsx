'use client'

import { useEffect, useState } from 'react'
import { api, type Citation, type SopSource } from '../api'
import { Card, Citations, Icon } from '../ui'
import { useStaff } from './StaffProvider'

const EXAMPLES: Record<string, string[]> = {
  social_services: ['what to do when a payment is late', 'flood relief claim', 'illegal fee by a shop agent'],
  child_protection: ['child injured by a parent', 'sextortion online', 'school withholding report card'],
}

export default function Knowledge() {
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
          <h1>Knowledge</h1>
          <p className="muted">The SOPs and regulations the reply drafter is allowed to cite. Search runs on BM25, no AI tokens.</p>
        </div>
      </div>
      <div className="case-grid">
        <div className="col">
          <Card title="Ask the SOP" icon="book">
            <form className="ask" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) search(q) }}>
              <label htmlFor="ask-sop" className="sr">Question about the agency&apos;s procedures</label>
              <input id="ask-sop" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search procedures and regulations" />
              <button className="primary" disabled={busy || q.trim().length < 3}>Search</button>
            </form>
            <div className="samples">
              {EXAMPLES[agency.id]?.map((x) => <button key={x} className="chip" onClick={() => search(x)}>{x}</button>)}
            </div>
            {busy && <div className="shimmer" />}
            {res && (res.length ? <Citations items={res} /> : <p className="muted">No passage matches. Try other words.</p>)}
          </Card>
        </div>
        <div className="col">
          <Card title={`Documents (${sources.length})`} icon="form">
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
            <p className="muted small">Each agency pack lists its documents with their public source in sop/sources.json.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
