/**
 * MarketCheck Client Tests
 *
 * Tests for VIN prediction fallback to search when VIN decode fails.
 */

const mockFetch = jest.fn()
global.fetch = mockFetch

process.env.MARKETCHECK_API_KEY = 'test-api-key'

import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'

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
