'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type Agency, type Notification, type TeamMember } from '../api'
import { save, stored } from '../storage'
import { useAgencies } from '../useAgencies'

interface Staff {
  agencies: Agency[]
  agency: Agency
  me: TeamMember
  pickAgency: (id: string) => void
  /** Reloads agencies after their settings or channels change. */
  reload: () => void
  pickMe: (id: string) => void
  notes: Notification[]
  refreshNotes: () => void
}

const Ctx = createContext<Staff | null>(null)

export function useStaff(): Staff {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStaff outside StaffProvider')
  return s
}

/** Agency, demo sign-in (who you are on the team) and notifications for every staff page. */
export function StaffProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { agencies, agency, pick, error, reload } = useAgencies()
  const [meIds, setMeIds] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Notification[]>([])

  const supervisorId = agency?.team.find((m) => m.role === 'supervisor')?.id ?? ''
  const meId = agency ? (meIds[agency.id] ?? stored(`persona:${agency.id}`, supervisorId)) : ''
  const me = agency?.team.find((m) => m.id === meId) ?? agency?.team[0]

  const refreshNotes = useCallback(() => {
    if (agency && me)
      api
        .notifications(agency.id, me.id)
        .then(setNotes)
        .catch(() => setNotes([]))
  }, [agency, me])
  useEffect(() => {
    refreshNotes()
    const t = setInterval(refreshNotes, 20_000)
    return () => clearInterval(t)
  }, [refreshNotes])

  // Entry from the landing page: /staff/...?as=officer|supervisor|leader signs in as the first member with that role.
  useEffect(() => {
    if (!agency) return
    const params = new URLSearchParams(location.search)
    const role = params.get('as')
    if (!role) return
    const m = agency.team.find((x) => x.role === role)
    if (m) {
      setMeIds((ids) => ({ ...ids, [agency.id]: m.id }))
      save(`persona:${agency.id}`, m.id)
    }
    params.delete('as')
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : ''))
  }, [agency])

  if (error) return <p className="error pad">Could not reach the API: {error}</p>
  if (!agency || !me) return <>{fallback}</>
  const pickMe = (id: string) => {
    setMeIds((m) => ({ ...m, [agency.id]: id }))
    save(`persona:${agency.id}`, id)
  }
  return (
    <Ctx.Provider value={{ agencies, agency, me, pickAgency: pick, pickMe, notes, refreshNotes, reload }}>
      {children}
    </Ctx.Provider>
  )
}
