'use client'

import { useEffect, useState } from 'react'
import { api, type Agency } from './api'
import { save, stored } from './storage'

/** Loads the agency list and remembers which agency the viewer picked. */
export function useAgencies() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [agencyId, setAgencyId] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setAgencyId(stored('agency', 'social_services'))
    api.agencies().then(setAgencies).catch((e) => setError(String(e)))
  }, [])
  const pick = (id: string) => {
    setAgencyId(id)
    save('agency', id)
  }
  const agency = agencies.find((a) => a.id === agencyId) ?? agencies[0]
  return { agencies, agency, pick, error }
}
