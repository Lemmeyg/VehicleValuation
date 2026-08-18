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

  it('returns unchanged when all fallback listings fail cleaning (0-mile inventory)', async () => {
    // Fallback returns only 0-mile (new car) listings — all dropped by cleanAndFilterComparables
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 5,
        listings: Array.from({ length: 5 }, (_, i) => ({
          id: `NEW0000000000${i}`,
          vin: `NEW0000000000${i}`,
          price: 42000,
          miles: 0,
          seller_type: 'franchise',
          build: {
            year: subjectVehicle.year,
            make: subjectVehicle.make,
            model: subjectVehicle.model,
          },
          vdp_url: `https://dealer.com/listing/NEW0000000000${i}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })

    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      0, // validCount — primary has no valid listings
      subjectVehicle,
      'VIN0',
      50000,
      '90210'
    )

    expect(result.supplemented).toBe(false)
    expect(result.prediction.recentComparables?.listings).toHaveLength(0)
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
            miles: 35000,
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
    // After dedup, only NEW_VIN is added. validCount(1) + 1 new valid = 2 < 10, so pass 2 fires.
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })

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
    // validCount(1) + 1 fallback valid = 2 < 10, so pass 2 fires.
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })

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

// ─── Sort order and pagination ─────────────────────────────────────────────────

describe('supplementComparables — sort order and pagination', () => {
  it('processes listings by best match first: year, then location, then mileage', async () => {
    // Subject: 2020 Honda Civic, 30000 miles, ZIP 90210 (CA).
    // L_X: year=2020 (diff=0), CA (same state, tier 0), miles=30000 (diff=0)     — best match
    // L_Y: year=2020 (diff=0), TX (non-bordering, tier 2), miles=35000 (diff=5000)
    // L_Z: year=2018 (diff=2), NY (non-bordering, tier 2), miles=30500 (diff=500) — year differs, ranks last
    // Expected sort: L_X → L_Y → L_Z
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 3,
        listings: [
          {
            id: 'L_Y',
            vin: 'L_Y',
            price: 19000,
            miles: 35000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Austin', state: 'TX', zip: '78701' },
            vdp_url: 'https://dealer.com/listing/L_Y',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'L_X',
            vin: 'L_X',
            price: 20000,
            miles: 30000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'LA', state: 'CA', zip: '90210' },
            vdp_url: 'https://dealer.com/listing/L_X',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'L_Z',
            vin: 'L_Z',
            price: 15000,
            miles: 30500,
            seller_type: 'franchise',
            build: { year: 2018, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'NY', state: 'NY', zip: '10001' },
            vdp_url: 'https://dealer.com/listing/L_Z',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })
    // HEAD requests consumed in best-match order: L_X, L_Y, L_Z
    mockHeadOk('https://dealer.com/listing/L_X')
    mockHeadOk('https://dealer.com/listing/L_Y')
    mockHeadOk('https://dealer.com/listing/L_Z')
    // Pass 2: validCount(0) + 3 = 3 < 10, so pass 2 fires → return empty
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })

    const prediction = makePrediction([])
    await supplementComparables(
      prediction,
      0,
      { year: 2020, make: 'Honda', model: 'Civic' },
      'VIN0',
      30000,
      '90210'
    )

    const calls = (global.fetch as jest.Mock).mock.calls
    // calls[0]: search API (page 1)
    // calls[1]: HEAD for L_X (year=2020, same state as subject, exact mileage match) — best match
    // calls[2]: HEAD for L_Y (year=2020, non-bordering state)
    // calls[3]: HEAD for L_Z (year=2018 — year differs from subject, ranks last regardless of location/mileage)
    // calls[4]: search API (page 2)
    expect(calls[1][0]).toBe('https://dealer.com/listing/L_X')
    expect(calls[2][0]).toBe('https://dealer.com/listing/L_Y')
    expect(calls[3][0]).toBe('https://dealer.com/listing/L_Z')
  })

  it('does NOT make a second API call when pass 1 finds >= 10 valid listings', async () => {
    // 10 fallback listings, all valid. validCount=0 + 10 = 10 >= MIN_VALID → no pass 2.
    const vins = Array.from({ length: 10 }, (_, i) => `PASS1_${i}`)
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
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    vins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    const prediction = makePrediction([])
    await supplementComparables(prediction, 0, subjectVehicle, 'VIN0', 30000, '90210')

    // Only 1 search API call (page 1) + 10 HEAD calls = 11 total. No page 2.
    const allCalls = (global.fetch as jest.Mock).mock.calls
    const searchApiCalls = allCalls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('api.marketcheck.com')
    )
    expect(searchApiCalls.length).toBe(1)
  })

  it('makes a second API call (start=50) when pass 1 finds fewer than 10 valid', async () => {
    // Pass 1: 3 listings, all valid. validCount=0 + 3 = 3 < 10 → pass 2 fires.
    const pass1Vins = ['P1_A', 'P1_B', 'P1_C']
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: pass1Vins.length,
        listings: pass1Vins.map((vin, i) => ({
          id: vin,
          vin,
          price: 18000,
          miles: 40000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    pass1Vins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    // Pass 2: returns empty
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })

    const prediction = makePrediction([])
    await supplementComparables(prediction, 0, subjectVehicle, 'VIN0', 30000, '90210')

    const allCalls = (global.fetch as jest.Mock).mock.calls
    const searchApiCalls = allCalls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('api.marketcheck.com')
    )
    expect(searchApiCalls.length).toBe(2)
    // Second call should have start=50
    const pass2Url = new URL(searchApiCalls[1][0] as string)
    expect(pass2Url.searchParams.get('start')).toBe('50')
  })

  it('deduplicates pass 2 listings against pass 1 listings', async () => {
    // Pass 1: returns VIN "SHARED" + "UNIQUE_P1". Pass 2: returns "SHARED" + "UNIQUE_P2".
    // Result should have UNIQUE_P1 and UNIQUE_P2 but only one SHARED (from pass 1).
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 2,
        listings: ['SHARED', 'UNIQUE_P1'].map((vin, i) => ({
          id: vin,
          vin,
          price: 18000,
          miles: 40000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    mockHeadOk('https://dealer.com/listing/SHARED')
    mockHeadOk('https://dealer.com/listing/UNIQUE_P1')

    // Pass 2
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 2,
        listings: ['SHARED', 'UNIQUE_P2'].map((vin, i) => ({
          id: vin,
          vin,
          price: 99999,
          miles: 1000, // different price to verify dedup keeps pass 1 version
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    mockHeadOk('https://dealer.com/listing/SHARED')
    mockHeadOk('https://dealer.com/listing/UNIQUE_P2')

    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      0,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    const allListings = result.prediction.recentComparables!.listings
    const sharedListings = allListings.filter(l => l.vin === 'SHARED')
    expect(sharedListings.length).toBe(1)
    expect(sharedListings[0].price).toBe(18000) // pass 1 price wins, not pass 2's 99999
    expect(allListings.some(l => l.vin === 'UNIQUE_P1')).toBe(true)
    expect(allListings.some(l => l.vin === 'UNIQUE_P2')).toBe(true)
  })

  it('includes pass 2 valid listings in the result even if pass 1 had some valid', async () => {
    // Pass 1: 3 valid. Pass 2: 2 more valid. Final result has all 5 as fallback.
    const pass1Vins = ['P1_A', 'P1_B', 'P1_C']
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 3,
        listings: pass1Vins.map((vin, i) => ({
          id: vin,
          vin,
          price: 18000,
          miles: 40000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    pass1Vins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    const pass2Vins = ['P2_A', 'P2_B']
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 2,
        listings: pass2Vins.map((vin, i) => ({
          id: vin,
          vin,
          price: 17000,
          miles: 45000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Honda', model: 'Civic' },
          dos_active: i + 1,
          vdp_url: `https://dealer.com/listing/${vin}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })
    pass2Vins.forEach(vin => mockHeadOk(`https://dealer.com/listing/${vin}`))

    const prediction = makePrediction([])
    const result = await supplementComparables(
      prediction,
      0,
      subjectVehicle,
      'VIN0',
      30000,
      '90210'
    )

    expect(result.supplemented).toBe(true)
    const fallbackInResult = result.prediction.recentComparables!.listings
    expect(fallbackInResult.some(l => l.vin === 'P1_A')).toBe(true)
    expect(fallbackInResult.some(l => l.vin === 'P2_A')).toBe(true)
    expect(fallbackInResult.length).toBe(5) // 3 pass1 + 2 pass2
  })
})

describe('supplementComparables — search model derivation', () => {
  it('uses model from existing comparables, not subject vehicle model, when they differ', async () => {
    // Simulates the C-Max Energi case: VIN-decoded model = 'C-Max Energi',
    // but MarketCheck search index model = 'C-Max' (as seen on the listing objects).
    const existingListing = {
      ...makeListing({ vin: 'ORIG_1', url_validated: false }),
      model: 'C-Max', // MarketCheck search-index model name
    }
    const prediction = makePrediction([existingListing])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          {
            id: 'FB_1',
            vin: 'FB_1',
            price: 11000,
            miles: 55000,
            seller_type: 'franchise',
            build: { year: 2016, make: 'Ford', model: 'C-Max' },
            vdp_url: 'https://dealer.com/listing/FB_1',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })
    mockHeadOk('https://dealer.com/listing/FB_1')
    // Pass 2 empty (0 + 1 valid < 10)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })

    await supplementComparables(
      prediction,
      0,
      { year: 2016, make: 'Ford', model: 'C-Max Energi', trim: 'SEL' }, // VIN-decoded model
      'SUBJECT_VIN',
      54040,
      '94563'
    )

    // The search API call (calls[0]) should use 'C-Max' (from existing listing),
    // NOT 'C-Max Energi' (from subjectVehicle).
    const searchUrl: string = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(searchUrl).toContain('model=C-Max')
    expect(searchUrl).not.toContain('model=C-Max+Energi')
    expect(searchUrl).not.toContain('model=C-Max%20Energi')
  })

  it('falls back to subject vehicle model when no existing comparables', async () => {
    const prediction = makePrediction([]) // no existing listings

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ num_found: 0, listings: [] }),
    })

    await supplementComparables(
      prediction,
      0,
      { year: 2016, make: 'Ford', model: 'C-Max Energi', trim: 'SEL' },
      'SUBJECT_VIN',
      54040,
      '94563'
    )

    // No existing listings → falls back to subjectVehicle.model
    const searchUrl: string = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(searchUrl).toContain('model=C-Max')
  })
})
