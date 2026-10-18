'use client'

import { useState } from 'react'
import { fileUrl } from '@/lib/files-url'

/** A staff member's photo from Cloud Storage team/<agency>/<id>.jpg (fictional, generated portraits), or their initial
 * when there is none. */
export function Avatar({
  agency,
  id,
  name,
  big = false,
}: {
  agency: string
  id?: string | null
  name?: string
  big?: boolean
}) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`avatar${big ? ' big' : ''}`} aria-hidden="true">
      {id && !failed ? (
        <img src={fileUrl(`team/${agency}/${id}.jpg`)} alt="" onError={() => setFailed(true)} />
      ) : (
        (name?.[0] ?? '?')
      )}
    </span>
  )
}
