import { locationTier } from '@/lib/utils/state-geo'

describe('locationTier', () => {
  it('returns 0 when the listing is in the same state as the subject', () => {
    expect(locationTier('MO', 'MO')).toBe(0)
  })

  it('returns 1 when the listing is in a state bordering the subject state', () => {
    // Missouri borders Illinois
    expect(locationTier('MO', 'IL')).toBe(1)
  })

  it('returns 2 when the listing is in a non-bordering state', () => {
    // Missouri does not border Ohio
    expect(locationTier('MO', 'OH')).toBe(2)
  })

  it('returns 2 when the subject state is unknown', () => {
    expect(locationTier(null, 'MO')).toBe(2)
  })

  it('returns 2 when the listing state is unknown', () => {
    expect(locationTier('MO', null)).toBe(2)
  })

  it('treats state codes case-insensitively', () => {
    expect(locationTier('mo', 'mo')).toBe(0)
    expect(locationTier('Mo', 'Il')).toBe(1)
  })
})
