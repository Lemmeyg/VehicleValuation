/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { selectDisplayComparables } from '@/lib/utils/comparables-ranker'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 100000,
    price: 20000,
    source: 'marketcheck',
    url_validated: true,
    source_tier: 'franchise',
    location: { zip: '89503' },
    dos_active: 20,
    ...o,
  }
}
function valuation(listings: MarketCheckComparable[], predictedPrice = 20000) {
  return { predictedPrice, recentComparables: { num_found: listings.length, listings } }
}
const subject = { year: 2020, mileage: 100000, zip: '89503', model: 'Highlander', trim: 'XLE' }

describe('selectDisplayComparables', () => {
  it('returns [] for empty / missing valuation', () => {
    expect(selectDisplayComparables(null, subject)).toEqual([])
    expect(selectDisplayComparables(valuation([]), subject)).toEqual([])
  })

  it('drops zero/negative price, missing mileage, and >40%-off comps', () => {
    const listings = [
      makeListing({ vin: 'OK' }),
      makeListing({ vin: 'PRICE0', price: 0 }),
      makeListing({ vin: 'NOMILES', miles: undefined as unknown as number }),
      makeListing({ vin: 'FARPRICE', price: 35000 }),
    ]
    const out = selectDisplayComparables(valuation(listings), subject).map(l => l.vin)
    expect(out).toEqual(['OK'])
  })

  it('no longer drops a different-model comp — the model gate is gone', () => {
    const listings = [makeListing({ vin: 'OK' }), makeListing({ vin: 'CAMRY', model: 'Camry' })]
    const out = selectDisplayComparables(valuation(listings), subject)
      .map(l => l.vin)
      .sort()
    expect(out).toEqual(['CAMRY', 'OK'])
  })

  it('a full live slate (>= limit) admits no failed-check comp, even a high-scoring one', () => {
    const live = Array.from({ length: 12 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, url_validated: true, miles: 100000 + i * 100 })
    )
    // Near-identical to the subject, so it would clear the 90 floor — but the
    // live pool already fills the report, so it must not displace a live comp.
    const dead = makeListing({
      vin: 'DEAD',
      url_validated: false,
      miles: 100000,
      price: 20000,
      year: 2020,
      trim: 'XLE',
      dos_active: 5,
      location: { zip: '89502' },
    })
    const out = selectDisplayComparables(valuation([...live, dead]), subject, 10)
    expect(out.length).toBe(10)
    expect(out.every(l => l.url_validated === true)).toBe(true)
    expect(out.some(l => l.vin === 'DEAD')).toBe(false)
  })

  it('ignores never-checked (undefined) comps entirely', () => {
    const listings = [
      makeListing({ vin: 'LIVE', url_validated: true }),
      makeListing({ vin: 'UNCHECKED', url_validated: undefined, miles: 100500 }),
    ]
    expect(selectDisplayComparables(valuation(listings), subject).map(l => l.vin)).toEqual(['LIVE'])
  })

  it('falls back to the gated set when NO comp carries a url_validated field', () => {
    const listings = [
      makeListing({ vin: 'A', url_validated: undefined, miles: 100000 }),
      makeListing({ vin: 'B', url_validated: undefined, miles: 140000 }),
    ].map(l => {
      delete (l as Record<string, unknown>).url_validated
      return l
    })
    const out = selectDisplayComparables(valuation(listings), subject).map(l => l.vin)
    expect(out).toEqual(['A', 'B']) // score desc
  })

  it('uses fallback_search comps only when fewer than `limit` primary live comps exist', () => {
    const primary = Array.from({ length: 5 }, (_, i) =>
      makeListing({ vin: `P${i}`, source_tier: 'franchise', miles: 100000 + i * 100 })
    )
    const fallback = Array.from({ length: 8 }, (_, i) =>
      makeListing({ vin: `F${i}`, source_tier: 'fallback_search', miles: 100000 + i * 50 })
    )
    const out = selectDisplayComparables(valuation([...primary, ...fallback]), subject, 10).map(
      l => l.vin
    )
    expect(out.length).toBe(10)
    expect(out.some(v => v.startsWith('F'))).toBe(true)

    const primary12 = Array.from({ length: 12 }, (_, i) =>
      makeListing({ vin: `P${i}`, source_tier: 'franchise', miles: 100000 + i * 100 })
    )
    const out2 = selectDisplayComparables(valuation([...primary12, ...fallback]), subject, 10).map(
      l => l.vin
    )
    expect(out2.every(v => v.startsWith('P'))).toBe(true)
  })

  it('treats missing source_tier as primary', () => {
    const listings = Array.from({ length: 11 }, (_, i) => {
      const l = makeListing({ vin: `P${i}`, miles: 100000 + i * 100 })
      delete (l as Record<string, unknown>).source_tier
      return l
    })
    const fallback = makeListing({ vin: 'F', source_tier: 'fallback_search', miles: 100000 })
    const out = selectDisplayComparables(valuation([...listings, fallback]), subject, 10).map(
      l => l.vin
    )
    expect(out.includes('F')).toBe(false)
  })

  it('admits at most MAX_DEAD_LINK_COMPS failed-check comps that score >= 90, unlabelled', () => {
    // 8 live comps, deliberately mediocre so they score < a near-perfect comp
    const live = Array.from({ length: 8 }, (_, i) =>
      makeListing({
        vin: `L${i}`,
        url_validated: true,
        miles: 130000,
        price: 24000,
        dos_active: 150,
        trim: 'Base',
        location: { zip: '90001' },
      })
    )
    const perfect = (vin: string) =>
      makeListing({
        vin,
        url_validated: false,
        miles: 100000,
        price: 20000,
        year: 2020,
        trim: 'XLE',
        dos_active: 5,
        location: { zip: '89502' },
      })
    const failedHigh = [perfect('D1'), perfect('D2'), perfect('D3')]
    const out = selectDisplayComparables(valuation([...live, ...failedHigh]), subject, 10)
    const deadShown = out.filter(l => l.url_validated === false).map(l => l.vin)
    expect(deadShown.length).toBe(2) // cap
    expect(out.length).toBe(10)
  })

  it('caps admitted failed-check comps at MAX_DEAD_LINK_COMPS even when the shortfall is larger', () => {
    // 5 live "nothing special" comps + 3 near-perfect failed-check comps, limit 10.
    // Shortfall is 5, but only the 2 highest-scoring dead comps may be admitted.
    const live = Array.from({ length: 5 }, (_, i) =>
      makeListing({
        vin: `L${i}`,
        url_validated: true,
        miles: 160000,
        price: 24000,
        trim: 'Base',
        dos_active: 175,
        location: { zip: '90001' },
      })
    )
    // Odometer separates the three: D1 (best) > D2 > D3 (still >= 90).
    const dead = [0, 3000, 6000].map((delta, i) =>
      makeListing({
        vin: `D${i + 1}`,
        url_validated: false,
        miles: 100000 + delta,
        price: 20000,
        year: 2020,
        trim: 'XLE',
        dos_active: 5,
        location: { zip: '89502' },
      })
    )
    const out = selectDisplayComparables(valuation([...live, ...dead]), subject, 10)
    expect(out.length).toBe(7) // 5 live + 2 dead
    const deadShown = out.filter(l => l.url_validated === false).map(l => l.vin)
    expect(deadShown.sort()).toEqual(['D1', 'D2'])
  })

  it('does NOT admit a failed-check comp scoring below the floor', () => {
    const live = Array.from({ length: 3 }, (_, i) =>
      makeListing({ vin: `L${i}`, url_validated: true })
    )
    const failedMediocre = makeListing({
      vin: 'D',
      url_validated: false,
      miles: 100000,
      price: 26000,
      year: 2018,
      trim: 'Base',
      dos_active: 170,
      location: { zip: '33101' },
    })
    const out = selectDisplayComparables(valuation([...live, failedMediocre]), subject, 10).map(
      l => l.vin
    )
    expect(out.includes('D')).toBe(false)
  })

  it('a live comp outranks an admitted failed-check comp of marginally lower score', () => {
    // limit 2 with only 1 live comp -> a shortfall, so the >= 90 dead comp IS
    // admitted into candidates and the sort tiebreak is actually exercised.
    const liveBest = makeListing({
      vin: 'LIVEBEST',
      url_validated: true,
      miles: 100000,
      price: 20000,
      trim: 'XLE',
      dos_active: 5,
      location: { zip: '89503' },
    })
    const deadHigh = makeListing({
      vin: 'DEADHIGH',
      url_validated: false,
      miles: 100500, // marginally worse odometer match -> scores just below liveBest, still >= 90
      price: 20000,
      trim: 'XLE',
      dos_active: 5,
      location: { zip: '89503' },
    })
    const out = selectDisplayComparables(valuation([deadHigh, liveBest]), subject, 2).map(
      l => l.vin
    )
    expect(out).toEqual(['LIVEBEST', 'DEADHIGH'])
  })

  it('all links failed, one comp >= 90 -> returns that one, not []', () => {
    const failed = [
      makeListing({
        vin: 'HI',
        url_validated: false,
        miles: 100000,
        price: 20000,
        trim: 'XLE',
        dos_active: 5,
        location: { zip: '89502' },
      }),
      makeListing({
        vin: 'LO',
        url_validated: false,
        miles: 100000,
        price: 26000,
        year: 2018,
        trim: 'Base',
        dos_active: 170,
        location: { zip: '33101' },
      }),
    ]
    expect(selectDisplayComparables(valuation(failed), subject, 10).map(l => l.vin)).toEqual(['HI'])
  })

  it('all links failed, none >= 90 -> returns []', () => {
    const failed = Array.from({ length: 5 }, (_, i) =>
      makeListing({
        vin: `X${i}`,
        url_validated: false,
        miles: 150000,
        price: 26000,
        year: 2018,
        trim: 'Base',
        dos_active: 170,
        location: { zip: '33101' },
      })
    )
    expect(selectDisplayComparables(valuation(failed), subject, 10)).toEqual([])
  })

  it('returns fewer than `limit` rather than padding with junk', () => {
    const listings = [
      makeListing({ vin: 'A', url_validated: true }),
      makeListing({ vin: 'B', url_validated: true, miles: 105000 }),
      makeListing({ vin: 'BAD', url_validated: true, price: 0 }),
    ]
    expect(
      selectDisplayComparables(valuation(listings), subject, 10)
        .map(l => l.vin)
        .sort()
    ).toEqual(['A', 'B'])
  })

  it('orders the result by weightedRelevanceScore descending', () => {
    const listings = [
      makeListing({ vin: 'FAR', miles: 180000, location: { zip: '33101' } }),
      makeListing({ vin: 'NEAR', miles: 100000, location: { zip: '89503' } }),
      makeListing({ vin: 'MID', miles: 130000, location: { zip: '95814' } }),
    ]
    expect(selectDisplayComparables(valuation(listings), subject, 3).map(l => l.vin)).toEqual([
      'NEAR',
      'MID',
      'FAR',
    ])
  })
})
