import { rankByBestMatch, getBestMatchListings } from '@/lib/utils/comparables-ranker'
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'

const subject = { year: 2022, mileage: 32597, zip: '63109' } // St. Louis, MO

function makeListing(
  overrides: Partial<MarketCheckComparable> & { id: string }
): MarketCheckComparable {
  return {
    id: overrides.id,
    vin: overrides.id,
    year: 2022,
    make: 'Volkswagen',
    model: 'Taos',
    miles: 32597,
    price: 20000,
    source: 'marketcheck',
    ...overrides,
  }
}

describe('rankByBestMatch', () => {
  it('ranks an exact model-year match above an off-year match', () => {
    const offYear = makeListing({ id: 'OFF_YEAR', year: 2019 })
    const exactYear = makeListing({ id: 'EXACT_YEAR', year: 2022 })

    const ranked = rankByBestMatch([offYear, exactYear], subject)

    expect(ranked.map(l => l.id)).toEqual(['EXACT_YEAR', 'OFF_YEAR'])
  })

  it('ranks a same-state listing above a bordering-state listing, above a far-state listing', () => {
    const farState = makeListing({ id: 'FAR', location: { state: 'CA' } })
    const borderingState = makeListing({ id: 'BORDER', location: { state: 'IL' } }) // borders MO
    const sameState = makeListing({ id: 'SAME', location: { state: 'MO' } })

    const ranked = rankByBestMatch([farState, borderingState, sameState], subject)

    expect(ranked.map(l => l.id)).toEqual(['SAME', 'BORDER', 'FAR'])
  })

  it('resolves a listing state from its ZIP when no state text is given', () => {
    // 63105 is a St. Louis, MO ZIP - same state as subject, no location.state given
    const zipOnly = makeListing({ id: 'ZIP_ONLY', location: { zip: '63105' } })
    const farState = makeListing({ id: 'FAR', location: { state: 'CA' } })

    const ranked = rankByBestMatch([farState, zipOnly], subject)

    expect(ranked.map(l => l.id)).toEqual(['ZIP_ONLY', 'FAR'])
  })

  it('within the same year and location tier, ranks the closer mileage first', () => {
    const farMileage = makeListing({ id: 'FAR_MILES', miles: 90000 })
    const closeMileage = makeListing({ id: 'CLOSE_MILES', miles: 33000 })

    const ranked = rankByBestMatch([farMileage, closeMileage], subject)

    expect(ranked.map(l => l.id)).toEqual(['CLOSE_MILES', 'FAR_MILES'])
  })

  it('ranks a listing with only raw coordinates (no zip or state) above one with no location data at all', () => {
    // Mirrors a real MarketCheck gap: some listings only carry latitude/longitude,
    // with no dealer_address block at all (e.g. Dean Team VW Kirkwood, MO).
    const coordinatesOnly = makeListing({
      id: 'COORDS_ONLY',
      latitude: '38.601229',
      longitude: '-90.394485',
    })
    const noLocationAtAll = makeListing({ id: 'NO_LOCATION' })

    const ranked = rankByBestMatch([noLocationAtAll, coordinatesOnly], subject)

    expect(ranked.map(l => l.id)).toEqual(['COORDS_ONLY', 'NO_LOCATION'])
  })

  it('ranks a listing with only raw coordinates above a confirmed far-state listing', () => {
    const coordinatesOnly = makeListing({
      id: 'COORDS_ONLY',
      latitude: '38.601229',
      longitude: '-90.394485',
    })
    const farState = makeListing({ id: 'FAR', location: { state: 'CA' } })

    const ranked = rankByBestMatch([farState, coordinatesOnly], subject)

    expect(ranked.map(l => l.id)).toEqual(['COORDS_ONLY', 'FAR'])
  })

  it('does not mutate the input array', () => {
    const listings = [makeListing({ id: 'A', year: 2019 }), makeListing({ id: 'B', year: 2022 })]
    const original = [...listings]

    rankByBestMatch(listings, subject)

    expect(listings).toEqual(original)
  })
})

describe('getBestMatchListings', () => {
  it('returns only the top N ranked listings', () => {
    const listings = Array.from({ length: 15 }, (_, i) =>
      makeListing({ id: `L${i}`, miles: 32597 + i * 1000 })
    )

    const result = getBestMatchListings(listings, subject, 10)

    expect(result).toHaveLength(10)
    expect(result[0].id).toBe('L0') // closest mileage to subject
  })
})
