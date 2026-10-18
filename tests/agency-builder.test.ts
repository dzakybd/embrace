import { describe, expect, it } from 'vitest'
import { buildAgency, NewAgency } from '@/lib/agency-builder'
import { decide } from '@/lib/policy'
import { indexFor, registerDocs, sourcesFor } from '@/lib/sop'
import type { Triage } from '@/lib/schemas'

const form = (over: Partial<NewAgency> = {}) => NewAgency.parse({
  template: 'dinsos_demak',
  name: 'Department of Social Welfare, Cebu City',
  short_name: 'DSWD Cebu',
  country: 'Philippines',
  emergency_line: '911',
  reply_signature: 'Complaints desk, DSWD Cebu',
  categories: [
    { label: 'Violence against women and children', team: 'Women and Child Protection', escalate: true },
    { label: 'Cash grant not received', team: 'Pantawid Team' },
  ],
  team: [
    { name: 'Ana Cruz', role: 'leader', title: 'City Social Welfare Officer' },
    { name: 'Ben Reyes', role: 'supervisor', title: 'Duty supervisor' },
    { name: 'Carla Santos', role: 'officer', title: 'Caseworker', teams: ['Pantawid Team'] },
  ],
  keywords: ['Gibunalan', 'walay pagkaon'],
  keep_template_docs: false,
  docs: [{ title: 'Grievance SOP', text: '# SOP\n\n## 1. Cash grant not received\nThe Pantawid team checks the payroll within 3 days.' }],
  ...over,
})

describe('agency builder', () => {
  it('turns the form into an agency with queues, a PIC per team, rules and searchable documents', async () => {
    const a = await buildAgency(form())
    if (typeof a === 'string') throw new Error(a)
    expect(a.code).toBe('DSWDC')
    expect(Object.values(a.queues)).toEqual(['Women and Child Protection', 'Pantawid Team'])
    const grant = a.categories[1]
    expect(a.team.find((m) => m.role === 'officer')!.queues).toEqual([grant.queue])
    expect(a.escalation.always_escalate_categories).toEqual([a.categories[0].id])
    expect(a.escalation.keywords).toContain('walay pagkaon')

    const triage: Triage = { category: a.categories[0].id, urgency: 'normal', urgency_reason: '', sentiment: 'neutral', flags: [], summary: '', confidence: 0.9 }
    expect(decide(a, 'my neighbour hits his wife', triage).route).toBe('escalated')

    registerDocs(a.id, a.docs!)
    expect(indexFor(a.id).search('cash grant not received', 1)[0].loc).toBe('section 1')
  })

  it('rejects a team without a duty supervisor', async () => {
    const r = await buildAgency(form({ team: [
      { name: 'Ana Cruz', role: 'leader', title: 'Head', teams: [] },
      { name: 'Carla Santos', role: 'officer', title: 'Caseworker', teams: [] },
      { name: 'Dan Lim', role: 'officer', title: 'Caseworker', teams: [] },
    ] }))
    expect(r).toMatch(/duty supervisor/)
  })

  it('can keep the template documents', async () => {
    const a = await buildAgency(form({ keep_template_docs: true, docs: [] }))
    if (typeof a === 'string') throw new Error(a)
    // Shipped documents are kept by reference and expanded when the agency's documents are registered.
    expect(a.docs!.template).toBe('dinsos_demak')
    expect(a.docs!.keep).toContain('Demak service flows')
    registerDocs(a.id, a.docs!)
    expect(sourcesFor(a.id).map((s) => s.short)).toContain('Demak service flows')
    expect(indexFor(a.id).search('tidal flood aid', 1).length).toBe(1)
  })
})
