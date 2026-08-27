/**
 * Tests for supplementWithAlternateDealerType.
 *
 * global.fetch is pre-mocked in __tests__/setup.ts.
 * MARKETCHECK_API_KEY must be set before imports.
 */

process.env.MARKETCHECK_API_KEY = 'test-key'

import { supplementWithAlternateDealerType } from '@/lib/utils/dealer-type-supplementer'
import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeListing(overrides: { vin?: string; price?: number }) {
  return {
    id: overrides.vin ?? 'TESTVIN0000000001',
    vin: overrides.vin ?? 'TESTVIN0000000001',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    miles: 30000,
    price: overrides.price ?? 20000,
    vdp_url: `https://dealer.com/listing/${overrides.vin ?? 'TESTVIN0000000001'}`,
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
    requestParams: {
      vin: 'TESTVIN0000000001',
      miles: 30000,
      zip: '90210',
      dealer_type: 'franchise',
    },
    generatedAt: new Date().toISOString(),
  }
}

const subjectVehicle = { year: 2020, make: 'Honda', model: 'Civic', trim: 'EX' }

function mockMarketCheckPrimarySuccess(listings: { vin: string; price?: number }[]) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      marketcheck_price: 20000,
      confidence: 'high',
      recent_comparables: {
        num_found: listings.length,
        listings: listings.map(l => ({
          vin: l.vin,
          year: 2020,
          make: 'Honda',
          model: 'Civic',
          miles: 30000,
          price: l.price ?? 20000,
          vdp_url: `https://dealer.com/listing/${l.vin}`,
        })),
      },
    }),
  })
}

function mockHeadOk(url: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ status: 200, url })
}

// ─── Early-return guards ───────────────────────────────────────────────────────

describe('supplementWithAlternateDealerType — early-return guards', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('returns unchanged when validatedCount already meets the target (10)', async () => {
    const prediction = makePrediction([])
    const result = await supplementWithAlternateDealerType(
      prediction,
      10,
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )
    expect(result.supplemented).toBe(false)
    expect(result.prediction).toBe(prediction)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── The actual second call ─────────────────────────────────────────────────────

describe('supplementWithAlternateDealerType — firing the second call', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('asks for the OTHER dealer type, not the same one again', async () => {
    const prediction = makePrediction([makeListing({ vin: 'ORIGINAL1' })])
    mockMarketCheckPrimarySuccess([{ vin: 'NEWVIN1' }])
    mockHeadOk('https://dealer.com/listing/NEWVIN1')

    await supplementWithAlternateDealerType(
      prediction,
      1, // below MIN_VALID
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(new URL(calledUrl).searchParams.get('dealer_type')).toBe('independent')
  })

  it('merges new listings in, keeps the original predictedPrice unchanged', async () => {
    const prediction = makePrediction([makeListing({ vin: 'ORIGINAL1', price: 15000 })])
    mockMarketCheckPrimarySuccess([{ vin: 'NEWVIN1', price: 30000 }])
    mockHeadOk('https://dealer.com/listing/NEWVIN1')

    const result = await supplementWithAlternateDealerType(
      prediction,
      1,
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )

    expect(result.supplemented).toBe(true)
    expect(result.prediction.predictedPrice).toBe(20000) // unchanged from the original
    const vins = result.prediction.recentComparables!.listings.map(l => l.vin)
    expect(vins).toEqual(['ORIGINAL1', 'NEWVIN1'])
  })

  it('deduplicates by VIN — a listing already present is not added again', async () => {
    const prediction = makePrediction([makeListing({ vin: 'DUPLICATE1' })])
    mockMarketCheckPrimarySuccess([{ vin: 'DUPLICATE1' }, { vin: 'NEWVIN2' }])
    mockHeadOk('https://dealer.com/listing/NEWVIN2')

    const result = await supplementWithAlternateDealerType(
      prediction,
      1,
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )

    const vins = result.prediction.recentComparables!.listings.map(l => l.vin)
    expect(vins).toEqual(['DUPLICATE1', 'NEWVIN2'])
  })

  it('returns unchanged (not supplemented) when the second call fails', async () => {
    const prediction = makePrediction([makeListing({ vin: 'ORIGINAL1' })])
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'error',
    })

    const result = await supplementWithAlternateDealerType(
      prediction,
      1,
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )

    expect(result.supplemented).toBe(false)
    expect(result.prediction).toBe(prediction)
  })

  it('returns unchanged when the second call succeeds but finds nothing new', async () => {
    const prediction = makePrediction([makeListing({ vin: 'ORIGINAL1' })])
    mockMarketCheckPrimarySuccess([{ vin: 'ORIGINAL1' }]) // only a duplicate

    const result = await supplementWithAlternateDealerType(
      prediction,
      1,
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )

    expect(result.supplemented).toBe(false)
  })

  it('passes subjectVehicle through so the year band still applies to the second call', async () => {
    const prediction = makePrediction([makeListing({ vin: 'ORIGINAL1' })])
    // Second call returns one listing inside the year band (2020) and one outside it (2015) —
    // cleanAndFilterComparables (subjectYear-3..+1 = 2017-2021) should drop the 2015 one.
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        marketcheck_price: 20000,
        confidence: 'high',
        recent_comparables: {
          num_found: 2,
          listings: [
            {
              vin: 'INBAND',
              year: 2020,
              make: 'Honda',
              model: 'Civic',
              miles: 30000,
              price: 20000,
              vdp_url: 'https://dealer.com/listing/INBAND',
            },
            {
              vin: 'OUTOFBAND',
              year: 2015,
              make: 'Honda',
              model: 'Civic',
              miles: 30000,
              price: 20000,
              vdp_url: 'https://dealer.com/listing/OUTOFBAND',
            },
          ],
        },
      }),
    })
    mockHeadOk('https://dealer.com/listing/INBAND')

    const result = await supplementWithAlternateDealerType(
      prediction,
      1,
      'TESTVIN0000000001',
      30000,
      '90210',
      'franchise',
      subjectVehicle
    )

    const vins = result.prediction.recentComparables!.listings.map(l => l.vin)
    expect(vins).toContain('INBAND')
    expect(vins).not.toContain('OUTOFBAND')
  })
})
