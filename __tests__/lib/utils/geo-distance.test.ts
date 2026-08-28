/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { computeDistanceMiles, DISTANCE_TIER_MILES } from '@/lib/utils/geo-distance'

function makeListing(overrides: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 50000,
    price: 18000,
    source: 'marketcheck',
    ...overrides,
  }
}

describe('computeDistanceMiles', () => {
  it('computes real distance from a listing ZIP (Reno, NV -> Sacramento, CA)', () => {
    const listing = makeListing({ location: { zip: '95814' } })
    const dist = computeDistanceMiles('89503', listing)
    expect(dist).not.toBeNull()
    expect(dist!).toBeGreaterThan(100)
    expect(dist!).toBeLessThan(125)
  })

  it('normalizes a ZIP+4 listing ZIP before computing distance (Reno, NV -> Sacramento, CA)', () => {
    const listing = makeListing({ location: { zip: '89503-1234' } })
    const dist = computeDistanceMiles('95814', listing)
    expect(dist).not.toBeNull()
    expect(dist!).toBeGreaterThan(100)
    expect(dist!).toBeLessThan(125)
  })

  it('falls back to raw latitude/longitude when no ZIP is present', () => {
    // Sacramento, CA coordinates, no location.zip at all
    const listing = makeListing({ latitude: '38.5816', longitude: '-121.4944' })
    const dist = computeDistanceMiles('89503', listing)
    expect(dist).not.toBeNull()
    expect(dist!).toBeGreaterThan(100)
    expect(dist!).toBeLessThan(125)
  })

  it('returns null when the listing has neither a ZIP nor coordinates', () => {
    const listing = makeListing()
    expect(computeDistanceMiles('89503', listing)).toBeNull()
  })

  it('returns null when the listing ZIP is not a real US ZIP', () => {
    const listing = makeListing({ location: { zip: '00000' } })
    expect(computeDistanceMiles('89503', listing)).toBeNull()
  })
})

describe('DISTANCE_TIER_MILES', () => {
  it('is the agreed 250/500/750 tier boundaries', () => {
    expect(DISTANCE_TIER_MILES).toEqual([250, 500, 750])
  })
})
