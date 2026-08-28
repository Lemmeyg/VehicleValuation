/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import {
  weightedRelevanceScore,
  tokenTrimMatch,
  makeScoreSortFn,
  DEAD_LINK_SCORE_FLOOR,
  type ScoreSubject,
} from '@/lib/utils/comp-relevance-score'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 100000,
    price: 20000,
    source: 'marketcheck',
    ...o,
  }
}
// Reno, NV
const subject: ScoreSubject = {
  year: 2020,
  mileage: 100000,
  zip: '89503',
  model: 'Highlander',
  trim: 'XLE',
}

describe('tokenTrimMatch', () => {
  it('exact when normalised strings are equal', () => {
    expect(tokenTrimMatch('XLE', 'xle')).toBe('exact')
  })
  it('partial when they share a token', () => {
    expect(tokenTrimMatch('FWD 4dr V6 SE (Natl)', 'SE')).toBe('partial')
  })
  it('none when no token overlaps', () => {
    expect(tokenTrimMatch('Limited', 'Base')).toBe('none')
  })
  it('unknown when either side is missing', () => {
    expect(tokenTrimMatch(undefined, 'SE')).toBe('unknown')
    expect(tokenTrimMatch('SE', '')).toBe('unknown')
  })
})

describe('weightedRelevanceScore', () => {
  it('scores a near-identical, nearby, fresh, same-price, same-trim comp >= 90', () => {
    const comp = makeListing({
      miles: 101000,
      price: 20000,
      year: 2020,
      trim: 'XLE',
      dos_active: 10,
      location: { zip: '89502' }, // ~2mi from 89503
    })
    expect(weightedRelevanceScore(comp, subject, 20000)).toBeGreaterThanOrEqual(90)
  })

  it('a comp thats only close on mileage stays well below 90', () => {
    const comp = makeListing({
      miles: 100000,
      price: 34000,
      year: 2018,
      trim: 'Base',
      dos_active: 200,
      location: { zip: '33101' }, // Miami
    })
    expect(weightedRelevanceScore(comp, subject, 20000)).toBeLessThan(90)
  })

  it('mileage closeness drives ordering when all else is equal', () => {
    const near = makeListing({ miles: 100000, location: { zip: '89503' } })
    const far = makeListing({ miles: 160000, location: { zip: '89503' } })
    expect(weightedRelevanceScore(near, subject, 20000)).toBeGreaterThan(
      weightedRelevanceScore(far, subject, 20000)
    )
  })

  it('distance null (no zip, no lat/long) yields 0.15 for that factor, not a throw', () => {
    const noLoc = makeListing()
    expect(() => weightedRelevanceScore(noLoc, subject, 20000)).not.toThrow()
    const withLoc = makeListing({ location: { zip: '89503' } })
    expect(weightedRelevanceScore(withLoc, subject, 20000)).toBeGreaterThan(
      weightedRelevanceScore(noLoc, subject, 20000)
    )
  })

  it('missing subject.mileage makes the mileage factor neutral for all comps (no divide-by-zero)', () => {
    const s2: ScoreSubject = { ...subject, mileage: 0 }
    const a = weightedRelevanceScore(
      makeListing({ miles: 50000, location: { zip: '89503' } }),
      s2,
      20000
    )
    const b = weightedRelevanceScore(
      makeListing({ miles: 250000, location: { zip: '89503' } }),
      s2,
      20000
    )
    expect(Number.isFinite(a)).toBe(true)
    expect(a).toBeCloseTo(b, 5)
  })

  it('missing predictedPrice makes the price factor neutral', () => {
    const a = weightedRelevanceScore(
      makeListing({ price: 5000, location: { zip: '89503' } }),
      subject,
      undefined
    )
    const b = weightedRelevanceScore(
      makeListing({ price: 90000, location: { zip: '89503' } }),
      subject,
      undefined
    )
    expect(a).toBeCloseTo(b, 5)
  })

  it('stays within 0..100 for extreme inputs', () => {
    const wild = makeListing({ miles: 9_000_000, price: 9_999_999, year: 1900 })
    const s = weightedRelevanceScore(wild, subject, 20000)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(100)
  })
})

describe('makeScoreSortFn', () => {
  it('sorts by score descending and does not mutate the input', () => {
    const input = [
      makeListing({ vin: 'FAR', miles: 180000, location: { zip: '33101' } }),
      makeListing({ vin: 'NEAR', miles: 100000, location: { zip: '89503' } }),
    ]
    const sorted = makeScoreSortFn(subject, 20000)(input)
    expect(sorted.map(l => l.vin)).toEqual(['NEAR', 'FAR'])
    expect(input[0].vin).toBe('FAR') // unchanged
  })
})

describe('constants', () => {
  it('DEAD_LINK_SCORE_FLOOR is 90', () => {
    expect(DEAD_LINK_SCORE_FLOOR).toBe(90)
  })
})
