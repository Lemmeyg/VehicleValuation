/**
 * MarketCheck Client Tests
 *
 * Tests for VIN prediction fallback to search when VIN decode fails.
 */

const mockFetch = jest.fn()
global.fetch = mockFetch

process.env.MARKETCHECK_API_KEY = 'test-api-key'

import { fetchMarketCheckData, fetchMarketCheckSearchFallback } from '@/lib/api/marketcheck-client'

describe('fetchMarketCheckData - search fallback', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns fallbackUsed falsy on successful VIN prediction', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        marketcheck_price: 15000,
        confidence: 'high',
        recent_comparables: { num_found: 5, listings: [] },
      }),
    })

    const result = await fetchMarketCheckData('1HGBH41JXMN109186', 50000, '90210')
    expect(result.success).toBe(true)
    expect(result.fallbackUsed).toBeFalsy()
  })

  it('triggers search fallback when VIN prediction returns Failed to decode VIN', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ code: 400, message: { detail: 'Failed to decode VIN' } }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 68,
        listings: [
          {
            id: 'abc123',
            vin: 'YV4CZ982681452972',
            price: 5499,
            miles: 138163,
            seller_type: 'dealer',
            build: { year: 2008, make: 'Volvo', model: 'XC90', trim: '3.2 AWD' },
            dom: 1463,
            vdp_url: 'https://example.com/listing',
            first_seen_at_date: '2025-06-25T18:38:25.000Z',
          },
          {
            id: 'def456',
            vin: 'YV4CZ982681499999',
            price: 6200,
            miles: 95000,
            seller_type: 'franchise',
            build: { year: 2008, make: 'Volvo', model: 'XC90', trim: 'V8 Sport' },
            dom: 30,
            vdp_url: 'https://example.com/listing2',
            first_seen_at_date: '2025-06-20T10:00:00.000Z',
          },
        ],
      }),
    })

    const result = await fetchMarketCheckData(
      'YV4CT852681482540',
      125775,
      '14051',
      false,
      { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 },
      { year: 2008, make: 'Volvo', model: 'XC90' }
    )

    expect(result.success).toBe(true)
    expect(result.fallbackUsed).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.recentComparables!.listings).toHaveLength(2)
    expect(result.data!.predictedPrice).toBeGreaterThan(0)
  })

  it('does NOT trigger fallback on non-VIN-decode 400 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ code: 400, message: { detail: 'Invalid zip code' } }),
    })

    const result = await fetchMarketCheckData('1HGBH41JXMN109186', 50000, 'XXXXX', false, {
      maxAttempts: 1,
      initialDelayMs: 0,
      maxDelayMs: 0,
      backoffMultiplier: 1,
    })
    expect(result.success).toBe(false)
    expect(result.fallbackUsed).toBeFalsy()
  })

  it('returns failure when fallback search also fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ code: 400, message: { detail: 'Failed to decode VIN' } }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error',
    })

    const result = await fetchMarketCheckData(
      'YV4CT852681482540',
      125775,
      '14051',
      false,
      { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 },
      { year: 2008, make: 'Volvo', model: 'XC90' }
    )

    expect(result.success).toBe(false)
    expect(result.fallbackUsed).toBeFalsy()
  })

  it('synthesises predictedPrice as mean of listing prices', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          JSON.stringify({ code: 400, message: { detail: 'Failed to decode VIN' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          num_found: 2,
          listings: [
            {
              id: '1',
              price: 4000,
              miles: 100000,
              seller_type: 'dealer',
              build: { year: 2008, make: 'Volvo', model: 'XC90' },
              vdp_url: '',
            },
            {
              id: '2',
              price: 6000,
              miles: 90000,
              seller_type: 'dealer',
              build: { year: 2008, make: 'Volvo', model: 'XC90' },
              vdp_url: '',
            },
          ],
        }),
      })

    const result = await fetchMarketCheckData(
      'YV4CT852681482540',
      125775,
      '14051',
      false,
      { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 },
      { year: 2008, make: 'Volvo', model: 'XC90' }
    )

    expect(result.data!.predictedPrice).toBe(5000)
  })

  it('sets confidence based on listing count', async () => {
    const makeSearchResponse = (count: number) => ({
      ok: true,
      json: async () => ({
        num_found: count,
        listings: Array.from({ length: count }, (_, i) => ({
          id: String(i),
          price: 5000,
          miles: 100000,
          seller_type: 'dealer',
          build: { year: 2008, make: 'Volvo', model: 'XC90' },
          vdp_url: '',
        })),
      }),
    })

    const vinDecodeFail = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ code: 400, message: { detail: 'Failed to decode VIN' } }),
    }

    const retryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 }
    const subject = { year: 2008, make: 'Volvo', model: 'XC90' }

    mockFetch.mockResolvedValueOnce(vinDecodeFail).mockResolvedValueOnce(makeSearchResponse(20))
    const high = await fetchMarketCheckData(
      'YV4CT852681482540',
      125775,
      '14051',
      false,
      retryConfig,
      subject
    )
    expect(high.data!.confidence).toBe('high')

    mockFetch.mockResolvedValueOnce(vinDecodeFail).mockResolvedValueOnce(makeSearchResponse(5))
    const medium = await fetchMarketCheckData(
      'YV4CT852681482540',
      125775,
      '14051',
      false,
      retryConfig,
      subject
    )
    expect(medium.data!.confidence).toBe('medium')

    mockFetch.mockResolvedValueOnce(vinDecodeFail).mockResolvedValueOnce(makeSearchResponse(2))
    const low = await fetchMarketCheckData(
      'YV4CT852681482540',
      125775,
      '14051',
      false,
      retryConfig,
      subject
    )
    expect(low.data!.confidence).toBe('low')
  })
})

describe('fetchMarketCheckSearchFallback — model + body_type split ladder', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  const VIN = '2HGFC4B03HH000000'

  // helper: a search response with `n` synthetic priced listings
  const searchResp = (numFound: number, n: number = numFound) => ({
    ok: true,
    json: async () => ({
      num_found: numFound,
      listings: Array.from({ length: n }, (_, i) => ({
        id: `L${i}`,
        vin: `LADDERVIN${String(i).padStart(7, '0')}`,
        price: 15000 + i * 10,
        miles: 60000,
        seller_type: 'franchise',
        build: { year: 2017, make: 'Honda', model: 'Civic' },
        dealer_address: { city: 'Rochester', state: 'NY', zip: '14450' },
        vdp_url: `https://dealer.com/inventory/L${i}`,
        first_seen_at_date: '2025-01-01',
      })),
    }),
  })

  const paramsOf = (callIdx: number) =>
    new URL(mockFetch.mock.calls[callIdx][0] as string).searchParams

  it('attempt 1 sends model=Civic & body_type=Coupe & year, and STOPS when it returns >= 10', async () => {
    mockFetch.mockResolvedValueOnce(searchResp(12))

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2017,
      'Honda',
      'Civic Coupe',
      VIN,
      78000,
      '14450'
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const p = paramsOf(0)
    expect(p.get('model')).toBe('Civic')
    expect(p.get('body_type')).toBe('Coupe')
    expect(p.get('year')).toBe('2017')
    expect(result.success).toBe(true)
  })

  it('widens to attempt 2 (bare model, keep year) when attempt 1 is thin (<10) and returns the wider set', async () => {
    mockFetch
      .mockResolvedValueOnce(searchResp(4)) // attempt 1: model=Civic&body_type=Coupe -> 4
      .mockResolvedValueOnce(searchResp(90)) // attempt 2: model=Civic (no body_type) -> 90

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2017,
      'Honda',
      'Civic Coupe',
      VIN,
      78000,
      '14450'
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const p1 = paramsOf(0)
    expect(p1.get('model')).toBe('Civic')
    expect(p1.get('body_type')).toBe('Coupe')
    expect(p1.get('year')).toBe('2017')

    const p2 = paramsOf(1)
    expect(p2.get('model')).toBe('Civic')
    expect(p2.has('body_type')).toBe(false)
    expect(p2.get('year')).toBe('2017')

    // returned the wider (attempt 2) set
    expect(result.success).toBe(true)
    expect(result.data!.totalComparablesFound).toBe(90)
  })

  it('drops year at attempt 3, then body_type+year at attempt 4, when every attempt returns 0', async () => {
    mockFetch
      .mockResolvedValueOnce(searchResp(0, 0)) // attempt 1
      .mockResolvedValueOnce(searchResp(0, 0)) // attempt 2
      .mockResolvedValueOnce(searchResp(0, 0)) // attempt 3
      .mockResolvedValueOnce(searchResp(0, 0)) // attempt 4

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2017,
      'Honda',
      'Civic Coupe',
      VIN,
      78000,
      '14450'
    )

    expect(mockFetch).toHaveBeenCalledTimes(4)

    // attempt 1: model + body_type + year
    expect(paramsOf(0).get('model')).toBe('Civic')
    expect(paramsOf(0).get('body_type')).toBe('Coupe')
    expect(paramsOf(0).get('year')).toBe('2017')

    // attempt 2: model + year, no body_type
    expect(paramsOf(1).get('model')).toBe('Civic')
    expect(paramsOf(1).has('body_type')).toBe(false)
    expect(paramsOf(1).get('year')).toBe('2017')

    // attempt 3: model + body_type, no year
    expect(paramsOf(2).get('model')).toBe('Civic')
    expect(paramsOf(2).get('body_type')).toBe('Coupe')
    expect(paramsOf(2).has('year')).toBe(false)

    // attempt 4: bare model, no body_type, no year
    expect(paramsOf(3).get('model')).toBe('Civic')
    expect(paramsOf(3).has('body_type')).toBe(false)
    expect(paramsOf(3).has('year')).toBe(false)

    expect(result.success).toBe(false)
  })

  it('stops at attempt 3 when it recovers listings (no attempt 4)', async () => {
    mockFetch
      .mockResolvedValueOnce(searchResp(0, 0)) // attempt 1
      .mockResolvedValueOnce(searchResp(0, 0)) // attempt 2
      .mockResolvedValueOnce(searchResp(6)) // attempt 3 recovers 6

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2017,
      'Honda',
      'Civic Coupe',
      VIN,
      78000,
      '14450'
    )

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(paramsOf(2).get('body_type')).toBe('Coupe')
    expect(paramsOf(2).has('year')).toBe(false)
    expect(result.success).toBe(true)
  })

  it('canonical multi-word model (Grand Highlander) sends NO body_type and makes exactly ONE attempt at >= 10', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 15,
        listings: Array.from({ length: 15 }, (_, i) => ({
          id: `G${i}`,
          vin: `GHVIN${String(i).padStart(11, '0')}`,
          price: 40000,
          miles: 20000,
          seller_type: 'franchise',
          build: { year: 2020, make: 'Toyota', model: 'Grand Highlander' },
          dealer_address: { city: 'Reno', state: 'NV', zip: '89503' },
          vdp_url: `https://dealer.com/inventory/G${i}`,
          first_seen_at_date: '2025-01-01',
        })),
      }),
    })

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Toyota',
      'Grand Highlander',
      VIN,
      20000,
      '89503'
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const p = paramsOf(0)
    expect(p.get('model')).toBe('Grand Highlander')
    expect(p.has('body_type')).toBe(false)
    expect(p.get('year')).toBe('2020')
    expect(result.success).toBe(true)
  })

  it('canonical model that returns 0 still makes exactly ONE attempt (no widening without a body_type split)', async () => {
    mockFetch.mockResolvedValueOnce(searchResp(0, 0))

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Toyota',
      'Grand Highlander',
      VIN,
      20000,
      '89503'
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(false)
  })
})

describe('fetchMarketCheckSearchFallback — API params', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  function mockSearchSuccess() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          {
            id: 'abc',
            vin: 'VIN1',
            price: 10000,
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            distance: 42,
            dealer_address: { city: 'Austin', state: 'TX', zip: '78701' },
            vdp_url: 'https://dealer.com/inventory/abc',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })
  }

  it('does NOT include radius or zip in the search URL (national, ungeofiltered search)', async () => {
    // zip without radius returns 0 results from the MarketCheck API (treats as 0-mile radius).
    // The search endpoint also never returns a distance field, so zip provides no benefit.
    mockSearchSuccess()
    await fetchMarketCheckSearchFallback('key', 2020, 'Honda', 'Civic', 'VIN0', 50000, '78701')
    const calledUrl = mockFetch.mock.calls[0][0] as string
    const params = new URL(calledUrl).searchParams
    expect(params.has('radius')).toBe(false)
    expect(params.has('zip')).toBe(false)
  })

  it('uses start=0 by default', async () => {
    mockSearchSuccess()
    await fetchMarketCheckSearchFallback('key', 2020, 'Honda', 'Civic', 'VIN0', 50000, '78701')
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(new URL(calledUrl).searchParams.get('start')).toBe('0')
  })

  it('passes start=50 when requested (pagination)', async () => {
    mockSearchSuccess()
    await fetchMarketCheckSearchFallback('key', 2020, 'Honda', 'Civic', 'VIN0', 50000, '78701', 50)
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(new URL(calledUrl).searchParams.get('start')).toBe('50')
  })

  it('maps distance from API response into location.distance_miles', async () => {
    mockSearchSuccess()
    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '78701'
    )
    expect(result.success).toBe(true)
    const listing = result.data!.recentComparables!.listings[0]
    expect(listing.location?.distance_miles).toBe(42)
  })

  it('distance_miles is undefined when API omits distance field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          {
            id: 'xyz',
            vin: 'VIN2',
            price: 10000,
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            // no distance field
            dealer_address: { city: 'Austin', state: 'TX', zip: '78701' },
            vdp_url: 'https://dealer.com/inventory/xyz',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })
    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '78701'
    )
    const listing = result.data!.recentComparables!.listings[0]
    expect(listing.location?.distance_miles).toBeUndefined()
  })
})

describe('fetchMarketCheckSearchFallback — price synthesis', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('excludes far-away listings from the price average when nearby ones exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 2,
        listings: [
          {
            id: 'near',
            vin: 'NEARVIN000000001',
            price: 10000,
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Sacramento', state: 'CA', zip: '95814' }, // ~110mi from 89503
            vdp_url: 'https://dealer.com/inventory/near',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'far',
            vin: 'FARVIN0000000001',
            price: 100000, // wildly different price — should NOT pull the average toward it
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Miami', state: 'FL', zip: '33101' }, // ~2500mi from 89503
            vdp_url: 'https://dealer.com/inventory/far',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '89503' // subject ZIP — Reno, NV
    )

    expect(result.success).toBe(true)
    expect(result.data!.predictedPrice).toBe(10000) // only the near listing counted
  })

  it('falls back to the full cleaned set when nothing is within 750mi', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          {
            id: 'far',
            vin: 'FARVIN0000000002',
            price: 20000,
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Miami', state: 'FL', zip: '33101' },
            vdp_url: 'https://dealer.com/inventory/far2',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '89503'
    )

    expect(result.success).toBe(true)
    expect(result.data!.predictedPrice).toBe(20000) // no nearby listings — falls back to using it anyway
  })
})

describe('fetchMarketCheckSearchFallback — comp cleanup', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('excludes listings with no usable price from the stored comparables', async () => {
    // The search endpoint routinely returns "call for price" listings (price 0 or
    // absent). The VIN-matched path drops these via cleanAndFilterComparables; the
    // fallback path must do the same before its listings are stored/displayed.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 3,
        listings: [
          {
            id: 'priced',
            vin: 'PRICEDVIN00000001',
            price: 18000,
            miles: 40000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Austin', state: 'TX', zip: '78701' },
            vdp_url: 'https://dealer.com/inventory/priced',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'zero',
            vin: 'ZEROVIN0000000001',
            price: 0,
            miles: 45000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Dallas', state: 'TX', zip: '75201' },
            vdp_url: 'https://dealer.com/inventory/zero',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'noprice',
            vin: 'NOPRICEVIN0000001',
            // price field absent entirely
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Houston', state: 'TX', zip: '77002' },
            vdp_url: 'https://dealer.com/inventory/noprice',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '78701'
    )

    expect(result.success).toBe(true)
    const listings = result.data!.recentComparables!.listings
    expect(listings).toHaveLength(1)
    expect(listings[0].id).toBe('priced')
    expect(listings.every(l => l.price > 0)).toBe(true)
    expect(result.data!.recentComparables!.num_found).toBe(1)
  })
})

describe('source_tier tagging', () => {
  it('tags primary-endpoint listings with the dealer type the call used', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        marketcheck_price: 15000,
        recent_comparables: {
          num_found: 1,
          listings: [
            {
              id: 'a',
              vin: 'AAAAAAAAAAAAAAAAA',
              year: 2020,
              make: 'Toyota',
              model: 'Highlander',
              miles: 50000,
              price: 15000,
              dealer_name: 'D',
              dealer_type: 'independent',
            },
          ],
        },
      }),
    })
    const res = await fetchMarketCheckData(
      'AAAAAAAAAAAAAAAAA',
      50000,
      '89503',
      false,
      undefined,
      { year: 2020, make: 'Toyota', model: 'Highlander' },
      'independent'
    )
    expect(res.success).toBe(true)
    expect(res.data!.recentComparables!.listings[0].source_tier).toBe('independent')
  })

  it('tags nationwide fallback-search listings as fallback_search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          {
            id: 'f',
            vin: 'FFFFFFFFFFFFFFFFF',
            miles: 60000,
            price: 14000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Toyota', model: 'Highlander' },
            dealer_address: { zip: '95814' },
            vdp_url: 'https://d.com/i/1',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })
    const res = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Toyota',
      'Highlander',
      'VIN0',
      60000,
      '89503'
    )
    expect(res.success).toBe(true)
    expect(res.data!.recentComparables!.listings[0].source_tier).toBe('fallback_search')
  })
})
