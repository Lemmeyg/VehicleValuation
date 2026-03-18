/**
 * Tests for supplementComparables utility.
 *
 * global.fetch is pre-mocked in __tests__/setup.ts.
 * MARKETCHECK_API_KEY must be set before imports.
 */

process.env.MARKETCHECK_API_KEY = 'test-key'

import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeListing(overrides: {
  vin?: string
  dos_active?: number
  url_validated?: boolean
  vdp_url?: string
  price?: number
}) {
  return {
    id: overrides.vin ?? 'VIN0',
    vin: overrides.vin ?? 'VIN0',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    miles: 30000,
    price: overrides.price ?? 20000,
    dos_active: overrides.dos_active,
    url_validated: overrides.url_validated,
    vdp_url: overrides.vdp_url ?? `https://dealer.com/listing/${overrides.vin ?? 'VIN0'}`,
    source: 'marketcheck' as const,
  }
}

function makePrediction(listings: ReturnType<typeof makeListing>[]): MarketCheckPrediction {
  return {
    predictedPrice: 20000,
    confidence: 'high',
    priceRange: { min: 18000, max: 22000 },
    msrp: undefined,
    totalComparablesFound: listings.length,
    comparablesStats: undefined,
    recentComparables: {
      num_found: listings.length,
      listings,
      stats: undefined,
    },
    dataSource: 'marketcheck',
    requestParams: { vin: 'VIN0', miles: 30000, zip: '90210', dealer_type: 'franchise' },
    generatedAt: new Date().toISOString(),
  }
}

const subjectVehicle = { year: 2020, make: 'Honda', model: 'Civic', trim: 'EX' }

function mockHeadOk(url: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ status: 200, url })
}

function mockHeadFail() {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ status: 404, url: '' })
}

// ─── Early-return guards ───────────────────────────────────────────────────────

describe('supplementComparables — early-return guards', () => {
  it('returns unchanged when validCount >= 10', async () => {
    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      10,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )
    expect(result.supplemented).toBe(false)
    expect(result.prediction).toBe(prediction)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns unchanged when subjectVehicle is undefined', async () => {
    const prediction = makePrediction([])
    const result = await supplementComparables(prediction, 5, undefined, 'VIN0', 30000, '90210')
    expect(result.supplemented).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns unchanged when subjectVehicle is missing make', async () => {
    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      5,
      { year: 2020, make: '', model: 'Civic' },
      'VIN0',
      30000,
      '90210'
    )
    expect(result.supplemented).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns unchanged when mileage is null', async () => {
    const prediction = makePrediction([])
    const result = await supplementComparables(prediction, 5, subjectVehicle, 'VIN0', null, '90210')
    expect(result.supplemented).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('allows mileage of 0 (new vehicle) — search fallback is attempted', async () => {
    // 0 is valid mileage; guard must NOT fire. Fallback will fail (mocked below) but that
    // is irrelevant — what matters is that the guard didn't prevent the attempt.
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Error',
      text: async () => 'error',
    })
    const prediction = makePrediction([])
    const result = await supplementComparables(prediction, 5, subjectVehicle, 'VIN0', 0, '90210')
    expect(global.fetch).toHaveBeenCalled() // search fallback was attempted
    expect(result.supplemented).toBe(false) // failed, so no change
  })

  it('returns unchanged when zip is null', async () => {
    const prediction = makePrediction([])
    const result = await supplementComparables(prediction, 5, subjectVehicle, 'VIN0', 30000, null)
    expect(result.supplemented).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns unchanged when MARKETCHECK_API_KEY is absent', async () => {
    const saved = process.env.MARKETCHECK_API_KEY
    delete process.env.MARKETCHECK_API_KEY
    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      5,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )
    expect(result.supplemented).toBe(false)
    process.env.MARKETCHECK_API_KEY = saved
  })
})

// ─── Fallback API failures ─────────────────────────────────────────────────────

describe('supplementComparables — fallback API failures', () => {
  it('returns unchanged when search fallback API returns an error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'error',
    })
    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      5,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )
    expect(result.supplemented).toBe(false)
    expect(result.prediction).toBe(prediction)
  })

  it('returns unchanged when search fallback returns empty listings', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })
    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      5,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )
    expect(result.supplemented).toBe(false)
  })
})

// ─── Merge logic ───────────────────────────────────────────────────────────────

describe('supplementComparables — merge logic', () => {
  function mockSearchResponse(vins: string[]) {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: vins.length,
        listings: vins.map((vin, i) => ({
          id: vin,
          vin,
          price: 18000,
          miles: 40000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic', trim: 'EX' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
  }

  it('appends validated fallback listings and returns supplemented: true', async () => {
    const existingValid = Array.from({ length: 5 }, (_, i) =>
      makeListing({ vin: `ORIG${i}`, url_validated: true, dos_active: i + 10 })
    )
    const prediction = makePrediction(existingValid)

    const fallbackVins = ['FB0', 'FB1', 'FB2', 'FB3', 'FB4']
    mockSearchResponse(fallbackVins)
    fallbackVins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    const result = await supplementComparables(
      prediction,
      5,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    expect(result.supplemented).toBe(true)
    const allListings = result.prediction.recentComparables!.listings
    const fallbackInResult = allListings.filter(l => fallbackVins.includes(l.vin ?? ''))
    expect(fallbackInResult.length).toBe(5)
    expect(fallbackInResult.every(l => l.url_validated === true)).toBe(true)
  })

  it('deduplicates by VIN — original listing wins on collision', async () => {
    const existing = [
      makeListing({ vin: 'SHARED_VIN', url_validated: true, dos_active: 5, price: 20000 }),
    ]
    const prediction = makePrediction(existing)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 2,
        listings: [
          {
            id: 'SHARED_VIN',
            vin: 'SHARED_VIN',
            price: 999,
            miles: 0,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dos_active: 1,
            vdp_url: 'https://dealer.com/listing/SHARED_VIN',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'NEW_VIN',
            vin: 'NEW_VIN',
            price: 18000,
            miles: 40000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dos_active: 2,
            vdp_url: 'https://dealer.com/listing/NEW_VIN',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })
    mockHeadOk('https://dealer.com/listing/SHARED_VIN')
    mockHeadOk('https://dealer.com/listing/NEW_VIN')

    const result = await supplementComparables(
      prediction,
      1,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    const allListings = result.prediction.recentComparables!.listings
    const shared = allListings.filter(l => l.vin === 'SHARED_VIN')
    expect(shared.length).toBe(1) // only one entry for shared VIN
    expect(shared[0].price).toBe(20000) // original wins — not the fallback's 999
  })

  it('does not truncate the full listings array', async () => {
    const existing = Array.from({ length: 15 }, (_, i) =>
      makeListing({ vin: `ORIG${i}`, url_validated: i < 3, dos_active: i + 1 })
    )
    const prediction = makePrediction(existing)

    const fallbackVins = Array.from({ length: 10 }, (_, i) => `FB${i}`)
    mockSearchResponse(fallbackVins)
    fallbackVins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    const result = await supplementComparables(
      prediction,
      3,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    // 15 originals + 10 fallback = 25 total
    expect(result.prediction.recentComparables!.listings.length).toBe(25)
    // Original valid flags are preserved (3 originals with url_validated: true)
    const originals = result.prediction.recentComparables!.listings.filter(l =>
      l.vin?.startsWith('ORIG')
    )
    expect(originals.filter(l => l.url_validated === true).length).toBe(3)
  })

  it('preserves url_validated: true on original valid listings', async () => {
    const existing = Array.from({ length: 12 }, (_, i) =>
      makeListing({ vin: `ORIG${i}`, url_validated: true, dos_active: i + 1 })
    )
    const prediction = makePrediction(existing)

    const fallbackVins = ['FB0', 'FB1', 'FB2', 'FB3', 'FB4']
    mockSearchResponse(fallbackVins)
    fallbackVins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    const result = await supplementComparables(
      prediction,
      6,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    const originals = result.prediction.recentComparables!.listings.filter(l =>
      l.vin?.startsWith('ORIG')
    )
    // All originals keep their url_validated: true flag (not demoted)
    expect(originals.every(l => l.url_validated === true)).toBe(true)
  })

  it('sets supplemented: true even when merged valid count is still < 10 (partial success)', async () => {
    const existing = [makeListing({ vin: 'ORIG0', url_validated: true, dos_active: 1 })]
    const prediction = makePrediction(existing)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 3,
        listings: Array.from({ length: 3 }, (_, i) => ({
          id: `FB${i}`,
          vin: `FB${i}`,
          price: 18000,
          miles: 40000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/FB${i}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    // Only first fallback listing passes URL validation
    mockHeadOk('https://dealer.com/listing/FB0')
    mockHeadFail()
    mockHeadFail()

    const result = await supplementComparables(
      prediction,
      1,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    expect(result.supplemented).toBe(true)
    const validCount = result.prediction.recentComparables!.listings.filter(
      l => l.url_validated
    ).length
    expect(validCount).toBe(2) // 1 original + 1 fallback
  })
})
