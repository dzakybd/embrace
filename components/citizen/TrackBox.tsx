'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useT } from '../Lang'
import { Icon } from '../ui'

/** Agency home tile: open a report's status page by its number. */
export function TrackBox() {
  const t = useT()
  const router = useRouter()
  const [id, setId] = useState('')
  return (
    <form
      className="role-card track-box"
      onSubmit={(e) => {
        e.preventDefault()
        if (id.trim()) router.push(`/track/${encodeURIComponent(id.trim().toUpperCase())}`)
      }}
    >
      <span className="entry-ic small">
        <Icon name="eye" size={22} />
      </span>
      <b>{t('Track a report')}</b>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder={t('Report number')}
        aria-label={t('Report number')}
      />
      <button className="small" disabled={!id.trim()}>
        {t('Check status')}
      </button>
    </form>
  )
}
