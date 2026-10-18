import { describe, expect, it } from 'vitest'
import { duration } from '@/components/ui'

describe('duration', () => {
  it('reads like a person would say it', () => {
    expect(duration(0.75)).toBe('45 min')
    expect(duration(5 + 20 / 60)).toBe('5 h 20 min')
    expect(duration(14.4)).toBe('14 h')
    expect(duration(24)).toBe('1 d')
    expect(duration(26.2)).toBe('1 d 2 h')
    expect(duration(245)).toBe('10 d 5 h')
  })
})
