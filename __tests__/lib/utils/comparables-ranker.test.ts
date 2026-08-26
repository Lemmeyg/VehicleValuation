/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import {
  rankByBestMatch,
  getBestMatchListings,
  type RankSubject,
} from '@/lib/utils/comparables-ranker'

function makeListing(overrides: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 100000,
    price: 15000,
    source: 'marketcheck',
    ...overrides,
  }
}

const subject: RankSubject = { year: 2020, mileage: 100000, zip: '89503' } // Reno, NV

describe('rankByBestMatch', () => {
  it('ranks closer model years first, above everything else', () => {
    const listings = [
      makeListing({ vin: 'A', year: 2015, location: { zip: '89503' } }), // same ZIP, far year
      makeListing({ vin: 'B', year: 2019, location: { zip: '33101' } }), // Miami, close year
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('B')
  })

  it('ranks real distance tiers ahead of the old same-state heuristic', () => {
    // Both listings are the same model year as the subject, so this
    // isolates the distance-tier factor. "same-state" (NV) is now
    // irrelevant — a same-state listing 400+ miles away must rank BEHIND
    // a different-state listing that's genuinely closer.
    const listings = [
      makeListing({ vin: 'FAR_SAME_STATE', location: { zip: '89101' } }), // Las Vegas, NV — ~440mi from Reno
      makeListing({ vin: 'NEAR_OTHER_STATE', location: { zip: '95814' } }), // Sacramento, CA — ~110mi from Reno
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('NEAR_OTHER_STATE')
  })

  it('within the same distance tier, prefers price within 10% of the subject valuation', () => {
    const subjectWithPrice: RankSubject = { ...subject, predictedPrice: 15000 }
    const listings = [
      makeListing({ vin: 'FAR_PRICE', price: 25000, location: { zip: '95814' } }), // +66%
      makeListing({ vin: 'CLOSE_PRICE', price: 15500, location: { zip: '95814' } }), // +3.3%
    ]
    const result = rankByBestMatch(listings, subjectWithPrice)
    expect(result[0].vin).toBe('CLOSE_PRICE')
  })

  it('skips the price tier entirely when predictedPrice is not provided', () => {
    const listings = [
      makeListing({ vin: 'A', price: 999999, miles: 150000, location: { zip: '95814' } }),
      makeListing({ vin: 'B', price: 1, miles: 100000, location: { zip: '95814' } }),
    ]
    // No predictedPrice on `subject` — falls through to mileage, so the
    // closer-mileage listing (B) wins despite its absurd price.
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('B')
  })

  it('falls back to mileage closeness as the final tiebreaker', () => {
    const listings = [
      makeListing({ vin: 'A', miles: 140000, location: { zip: '95814' } }),
      makeListing({ vin: 'B', miles: 105000, location: { zip: '95814' } }),
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('B')
  })

  it('treats a listing with no usable location as the worst distance tier, not a crash', () => {
    const listings = [
      makeListing({ vin: 'NO_LOCATION' }),
      makeListing({ vin: 'HAS_LOCATION', location: { zip: '95814' } }),
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('HAS_LOCATION')
  })
})

describe('getBestMatchListings', () => {
  it('returns at most `limit` listings, best-ranked first', () => {
    const listings = Array.from({ length: 15 }, (_, i) =>
      makeListing({ vin: `V${i}`, miles: 100000 + i * 1000, location: { zip: '89503' } })
    )
    const result = getBestMatchListings(listings, subject, 10)
    expect(result).toHaveLength(10)
    expect(result[0].vin).toBe('V0') // exact mileage match
  })
})
