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

  it('does not mutate the input array', () => {
    const listings = [
      makeListing({ vin: 'A', year: 2015, location: { zip: '89503' } }),
      makeListing({ vin: 'B', year: 2019, location: { zip: '33101' } }),
      makeListing({ vin: 'C', year: 2020, location: { zip: '95814' } }),
    ]
    const originalVinOrder = listings.map(l => l.vin)
    rankByBestMatch(listings, subject)
    expect(listings.map(l => l.vin)).toEqual(originalVinOrder)
  })

  it('prefers a nearer distance tier over a better price match in a farther tier', () => {
    const subjectWithPrice: RankSubject = { ...subject, predictedPrice: 15000 }
    const listings = [
      // Sacramento, CA — same distance tier as subject's tier-0 range (~110mi),
      // but a bad price match (+66%).
      makeListing({ vin: 'NEAR_BAD_PRICE', price: 25000, location: { zip: '95814' } }),
      // Miami, FL — thousands of miles away (worst distance tier), but a
      // near-perfect price match.
      makeListing({ vin: 'FAR_GREAT_PRICE', price: 15100, location: { zip: '33101' } }),
    ]
    const result = rankByBestMatch(listings, subjectWithPrice)
    expect(result[0].vin).toBe('NEAR_BAD_PRICE')
  })

  it("does NOT drop zero-price listings — filtering is getBestMatchListings' job, not the sort's", () => {
    // rankByBestMatch also orders listings for URL validation; dropping any here
    // would silently shrink that pass. The price filter belongs one level up.
    const listings = [
      makeListing({ vin: 'ZERO', price: 0, location: { zip: '89503' } }),
      makeListing({ vin: 'PRICED', price: 15000, location: { zip: '89503' } }),
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result.map(l => l.vin).sort()).toEqual(['PRICED', 'ZERO'])
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

  it('never returns a listing with a zero or missing price', () => {
    // A $0 "call for price" listing must never reach a report, even if it
    // out-ranks priced listings on year/distance/mileage. Last-resort guard —
    // the pipeline should already have dropped these upstream.
    const listings = [
      makeListing({ vin: 'PRICED', price: 15000, location: { zip: '89503' } }),
      makeListing({ vin: 'ZERO', price: 0, location: { zip: '89503' } }),
      makeListing({
        vin: 'MISSING',
        price: undefined as unknown as number,
        location: { zip: '89503' },
      }),
    ]
    const result = getBestMatchListings(listings, subject, 10)
    expect(result.map(l => l.vin)).toEqual(['PRICED'])
  })

  it('drops listings priced far from the valuation, even when they rank better on distance', () => {
    // The displayed comps justify the report's own Fair Market Value, so they
    // must be priced like it — a closer-but-wildly-mispriced listing is worse
    // than a fairly-priced one further away.
    const subjectWithPrice: RankSubject = { ...subject, predictedPrice: 15000 }
    const listings = [
      // Subject's own ZIP (best distance tier) but ~47% underpriced
      makeListing({ vin: 'NEAR_CHEAP_1', price: 8000, location: { zip: '89503' } }),
      makeListing({ vin: 'NEAR_CHEAP_2', price: 8000, location: { zip: '89503' } }),
      makeListing({ vin: 'NEAR_CHEAP_3', price: 8000, location: { zip: '89503' } }),
      // Miami — far away, but right on the valuation
      ...Array.from({ length: 10 }, (_, i) =>
        makeListing({ vin: `FAR_FAIR_${i}`, price: 15000, location: { zip: '33101' } })
      ),
    ]
    const result = getBestMatchListings(listings, subjectWithPrice, 10)
    expect(result.every(l => Math.abs(l.price - 15000) / 15000 <= 0.1)).toBe(true)
    expect(result.some(l => l.vin.startsWith('NEAR_CHEAP'))).toBe(false)
  })

  it('widens the price band when the tightest one cannot fill the table', () => {
    const subjectWithPrice: RankSubject = { ...subject, predictedPrice: 15000 }
    const listings = [
      // 4 within ±10% ($14,500), far away
      ...Array.from({ length: 4 }, (_, i) =>
        makeListing({ vin: `TIGHT_${i}`, price: 14500, location: { zip: '33101' } })
      ),
      // 8 within ±20% but outside ±10% ($12,100 ≈ −19%), far away
      ...Array.from({ length: 8 }, (_, i) =>
        makeListing({ vin: `MID_${i}`, price: 12100, location: { zip: '33101' } })
      ),
      // 15 way off ($6,000 = −60%), in the subject's own ZIP (best distance tier)
      ...Array.from({ length: 15 }, (_, i) =>
        makeListing({ vin: `OFF_${i}`, price: 6000, location: { zip: '89503' } })
      ),
    ]
    const result = getBestMatchListings(listings, subjectWithPrice, 10)
    expect(result).toHaveLength(10)
    expect(result.some(l => l.vin.startsWith('OFF_'))).toBe(false)
    expect(result.every(l => /^(TIGHT|MID)_/.test(l.vin!))).toBe(true)
  })

  it('applies no price band when the subject has no predicted price', () => {
    const listings = [
      makeListing({ vin: 'CHEAP', price: 3000, location: { zip: '89503' } }),
      makeListing({ vin: 'FAIR', price: 15000, location: { zip: '89503' } }),
    ]
    // `subject` carries no predictedPrice — both listings must survive
    const result = getBestMatchListings(listings, subject, 10)
    expect(result.map(l => l.vin).sort()).toEqual(['CHEAP', 'FAIR'])
  })
})
