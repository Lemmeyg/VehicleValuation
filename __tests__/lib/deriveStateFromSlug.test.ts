import { describe, it, expect } from '@jest/globals'
import { deriveStateFromSlug } from '@/lib/deriveStateFromSlug'

describe('deriveStateFromSlug', () => {
  it('returns a single-word state name', () => {
    expect(deriveStateFromSlug('indiana-total-loss-law-explained')).toBe('Indiana')
  })

  it('returns a two-word state name', () => {
    expect(deriveStateFromSlug('new-mexico-total-loss-law-explained')).toBe('New Mexico')
  })

  it('returns a three-word state name', () => {
    expect(deriveStateFromSlug('district-of-columbia-total-loss-law-explained')).toBe(
      'District of Columbia'
    )
  })

  it('returns null for a non-state article slug', () => {
    expect(deriveStateFromSlug('how-to-challenge-insurance-total-loss')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(deriveStateFromSlug('')).toBeNull()
  })
})
