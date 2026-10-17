import { describe, expect, it } from 'vitest'
import { AGENCIES } from '@/lib/agencies'
import { decide } from '@/lib/policy'
import type { Triage } from '@/lib/schemas'

const cp = AGENCIES.child_protection
const sa = AGENCIES.social_services
const triage = (over: Partial<Triage>): Triage => ({
  category: 'education',
  urgency: 'normal',
  urgency_reason: 'x',
  sentiment: 'neutral',
  flags: [],
  summary: 's',
  confidence: 0.9,
  ...over,
})

describe('policy rules', () => {
  it('routes a normal case by category', () => {
    const p = decide(cp, 'my child is bullied at school', triage({}))
    expect(p.route).toBe('assigned')
    expect(p.queue).toBe('education')
    expect(p.sla_hours).toBe(72)
  })

  it('escalates a safety flag even when the model rated it normal', () => {
    const p = decide(cp, 'text', triage({ flags: ['child_safety'] }))
    expect(p.route).toBe('escalated')
    expect(p.final_urgency).toBe('critical')
    expect(p.reasons.join()).toContain('raised from normal')
  })

  it('escalates on keywords the model missed', () => {
    const p = decide(cp, 'he was BLEEDING after', triage({ urgency: 'low' }))
    expect(p.route).toBe('escalated')
  })

  it('applies agency rules: minimum urgency per category and confidence threshold', () => {
    const custom = {
      ...cp,
      categories: cp.categories.map((c) => (c.id === 'education' ? { ...c, min_urgency: 'high' as const } : c)),
      escalation: { ...cp.escalation, confidence_floor: 0.95 },
    }
    const p = decide(custom, 'school withheld report card', triage({ urgency: 'low', confidence: 0.99 }))
    expect(p.final_urgency).toBe('high')
    expect(p.sla_hours).toBe(cp.sla_hours.high)
    expect(decide(custom, 'text', triage({ confidence: 0.9 })).route).toBe('manual_review')
  })

  it('always escalates configured categories', () => {
    expect(decide(cp, 'text', triage({ category: 'sexual_abuse' })).route).toBe('escalated')
    expect(decide(sa, 'text', triage({ category: 'domestic_violence' })).route).toBe('escalated')
  })

  it('does not escalate flags outside the agency list', () => {
    const p = decide(cp, 'text', triage({ flags: ['basic_needs_crisis', 'possible_fraud'] }))
    expect(p.route).toBe('assigned')
  })

  it('sends low confidence and unknown categories to manual review', () => {
    expect(decide(cp, 'text', triage({ confidence: 0.5 })).route).toBe('manual_review')
    expect(decide(cp, 'text', triage({ category: 'nope' })).route).toBe('manual_review')
  })

  it('falls back to keywords then manual review when the model fails', () => {
    expect(decide(sa, 'we have no food at all', null).route).toBe('escalated')
    expect(decide(sa, 'when is the next payment', null).route).toBe('manual_review')
  })

  it('escalates a safety concern found in an attachment, and keywords in a transcript', () => {
    const media = { transcript: null, photo_description: 'bruises', safety_concern: true, safety_reason: 'visible bruises' }
    expect(decide(cp, 'see photo', triage({}), media).route).toBe('escalated')
    const voice = { transcript: 'he said he will kill myself', photo_description: null, safety_concern: false, safety_reason: '' }
    expect(decide(cp, '', triage({}), voice).route).toBe('escalated')
  })
})
