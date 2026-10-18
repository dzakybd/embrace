'use client'

import { useEffect, useState } from 'react'
import { api, type Agency } from './api'
import { save, stored } from './storage'

export const DEFAULT_AGENCY = 'dinsos_demak'

/** Loads the agency list and remembers which agency the viewer picked. */
export function useAgencies() {
  const [all, setAll] = useState<Agency[]>([])
  const [agencyId, setAgencyId] = useState('')
  const [error, setError] = useState('')
  const reload = () =>
    api
      .agencies()
      .then(setAll)
      .catch((e) => setError(String(e)))
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('agency')
    if (fromUrl) save('agency', fromUrl)
    setAgencyId(fromUrl || stored('agency', DEFAULT_AGENCY))
    reload()
  }, [])
  const pick = (id: string) => {
    setAgencyId(id)
    save('agency', id)
  }
  const agencies = all
  // A new agency starts from a copy of a built-in one: its rules, categories, roles and documents.
  const templates = all.filter((a) => !a.custom)
  const agency = agencies.find((a) => a.id === agencyId) ?? agencies.find((a) => a.id === DEFAULT_AGENCY) ?? agencies[0]
  return { agencies, templates, agency, pick, error, reload }
}
