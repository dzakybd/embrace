import { describe, expect, it } from 'vitest'
import { AGENCIES } from '@/lib/agencies'
import { applySetup, type Setup } from '@/lib/agency-setup'

const kpai = AGENCIES.kpai
const rulesOf = (a = kpai): NonNullable<Setup['rules']> => ({
  categories: a.categories.map((c) => ({
    id: c.id,
    label: c.label,
    label_id: c.label_id ?? '',
    team: a.queues[c.queue],
    always_escalate: a.escalation.always_escalate_categories.includes(c.id),
    min_urgency: c.min_urgency === 'normal' || c.min_urgency === 'high' ? c.min_urgency : undefined,
  })),
  keywords: a.escalation.keywords,
  flags: a.escalation.escalate_flags,
  custom_signals: [],
  confidence_floor: a.escalation.confidence_floor ?? 0.7,
  sla_hours: a.sla_hours,
})

describe('agency setup sections', () => {
  it('saving the rules unchanged keeps categories, laws, procedures and queues', () => {
    const out = applySetup(kpai, { rules: rulesOf() })
    if (typeof out === 'string') throw new Error(out)
    expect(out.categories).toEqual(kpai.categories)
    expect(out.procedures).toEqual(kpai.procedures)
    expect(Object.keys(out.queues!).sort()).toEqual(Object.keys(kpai.queues).sort())
    expect(out.name).toBeUndefined()
  })
  it('a new team name creates a team; escalation and minimum urgency follow the case type', () => {
    const r = rulesOf()
    r.categories[0] = { ...r.categories[0], team: 'Rapid response', always_escalate: true }
    const out = applySetup(kpai, { rules: r })
    if (typeof out === 'string') throw new Error(out)
    const id = out.categories![0].queue
    expect(out.queues![id]).toBe('Rapid response')
    expect(out.escalation!.always_escalate_categories).toContain(out.categories![0].id)
  })
  it('removing a case type drops it from procedures; the team needs every role', () => {
    const r = rulesOf()
    const gone = r.categories.pop()!
    const out = applySetup(kpai, { rules: r })
    if (typeof out === 'string') throw new Error(out)
    expect(out.procedures!.some((p) => p.categories.includes(gone.id!))).toBe(false)
    const people = kpai.team.filter((m) => m.role !== 'supervisor').map((m) => ({ ...m }))
    expect(applySetup(kpai, { people })).toMatch(/supervisor/)
  })
  it('an agency signal can alert the supervisor; unknown signal ids are refused', () => {
    const r = rulesOf()
    r.custom_signals = [
      { id: 'x_flood', label: 'Flood in homes', label_id: '', description: 'Flood water has entered homes tonight.' },
    ]
    r.flags = [...r.flags, 'x_flood']
    const out = applySetup(kpai, { rules: r })
    if (typeof out === 'string') throw new Error(out)
    expect(out.escalation!.custom_signals![0].id).toBe('x_flood')
    expect(out.escalation!.escalate_flags).toContain('x_flood')
    expect(applySetup(kpai, { rules: { ...rulesOf(), flags: ['x_unknown'] } })).toMatch(/Unknown safety signal/)
  })

  it('the profile changes names only', () => {
    const out = applySetup(kpai, {
      profile: {
        name: 'Komisi',
        short_name: 'KPAI',
        country: 'Indonesia',
        description: '',
        name_id: '',
        short_name_id: '',
        description_id: '',
        reply_signature: 'KPAI',
      },
    })
    expect(out).toMatchObject({ name: 'Komisi' })
    expect(out).not.toHaveProperty('categories')
  })
})
