/**
 * Tests for URL validator utility
 *
 * IMPORTANT: global.fetch is already mocked in __tests__/setup.ts
 * Use (global.fetch as jest.Mock).mockResolvedValueOnce(...) to control responses.
 */

import { validateListingUrls } from '@/lib/utils/url-validator'
import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'

// Helper to build a minimal MarketCheckPrediction with listings
function makePrediction(
  listings: Array<{
    vdp_url?: string
    dos_active?: number
    price?: number
  }>
): MarketCheckPrediction {
  return {
    predictedPrice: 20000,
    confidence: 'high',
    priceRange: { min: 18000, max: 22000 },
    msrp: null,
    totalComparablesFound: listings.length,
    comparablesStats: undefined,
    recentComparables: {
      num_found: listings.length,
      listings: listings.map((l, i) => ({
        id: String(i),
        vin: `VIN${i}`,
        year: 2020,
        make: 'Honda',
        model: 'Civic',
        miles: 30000,
        price: l.price ?? 20000,
        dos_active: l.dos_active,
        source: 'marketcheck',
        vdp_url: l.vdp_url,
      })),
      stats: undefined,
    },
    generatedAt: new Date().toISOString(),
  } as MarketCheckPrediction
}

// Helper to mock a successful fetch response
function mockFetchOk(
  finalUrl: string,
  body = '<html><title>2020 Honda Civic for sale</title></html>'
) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 200,
    url: finalUrl,
    text: async () => body,
  })
}

// Helper to mock a 404 response
function mockFetch404(finalUrl: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 404,
    url: finalUrl,
    text: async () => '',
  })
}

// Helper to mock a fetch that times out (AbortError)
function mockFetchTimeout() {
  ;(global.fetch as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
  )
}

// Helper to mock a fetch that redirects to the homepage
function mockFetchHomepageRedirect(originalUrl: string) {
  const domain = new URL(originalUrl).origin
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 200,
    url: `${domain}/`, // final URL is homepage
    text: async () => '<html><title>Dealer Home</title></html>',
  })
}

describe('validateListingUrls', () => {
  it('returns prediction unchanged if no recentComparables', async () => {
    const prediction: MarketCheckPrediction = {
      predictedPrice: 20000,
      confidence: 'high',
      priceRange: { min: 18000, max: 22000 },
      msrp: null,
      totalComparablesFound: 0,
      comparablesStats: undefined,
      recentComparables: undefined,
      generatedAt: new Date().toISOString(),
    } as MarketCheckPrediction

    const result = await validateListingUrls(prediction)
    expect(result).toBe(prediction)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('marks listing as validated when URL returns 200 with vehicle content', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchOk('https://dealer.com/inventory/vehicle/12345')

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(true)
  })

  it('marks listing as validated when it has no vdp_url (data still valid)', async () => {
    const prediction = makePrediction([
      { dos_active: 5 }, // no vdp_url
    ])

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects listing when fetch times out', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchTimeout()

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when URL returns 404', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetch404('https://dealer.com/inventory/vehicle/12345')

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when URL returns 403 (bot blocked)', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 403,
      url: 'https://dealer.com/inventory/vehicle/12345',
      text: async () => '',
    })

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when URL redirects to dealer homepage', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchHomepageRedirect('https://dealer.com/inventory/vehicle/12345')

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when URL redirects to a single-segment path', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      url: 'https://dealer.com/inventory', // only 1 segment, likely listing index
      text: async () => '<html><title>All Inventory</title></html>',
    })

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when body contains "no longer available"', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchOk(
      'https://dealer.com/inventory/vehicle/12345',
      '<html><body>Sorry, this vehicle is no longer available.</body></html>'
    )

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when body contains "vehicle has been sold"', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchOk(
      'https://dealer.com/inventory/vehicle/12345',
      '<html><body>This vehicle has been sold. Please browse our inventory.</body></html>'
    )

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when URL redirects to a different domain', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      url: 'https://completelydifferentsite.com/home', // different domain
      text: async () => '<html><title>Other site</title></html>',
    })

    const result = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('validates multiple listings in parallel and annotates each correctly', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/111', dos_active: 3 },
      { vdp_url: 'https://dealer.com/inventory/vehicle/222', dos_active: 7 },
      { vdp_url: 'https://dealer.com/inventory/vehicle/333', dos_active: 14 },
    ])

    // Listing 0: valid
    mockFetchOk('https://dealer.com/inventory/vehicle/111')
    // Listing 1: 404
    mockFetch404('https://dealer.com/inventory/vehicle/222')
    // Listing 2: valid
    mockFetchOk('https://dealer.com/inventory/vehicle/333')

    const result = await validateListingUrls(prediction)
    const listings = result.recentComparables!.listings
    expect(listings[0].url_validated).toBe(true)
    expect(listings[1].url_validated).toBe(false)
    expect(listings[2].url_validated).toBe(true)
  })

  it('only validates top 30 candidates by dos_active; remaining listings get url_validated: false', async () => {
    // Create 32 listings; indices 0-29 are candidates (lowest dos_active)
    const listings = Array.from({ length: 32 }, (_, i) => ({
      vdp_url: `https://dealer.com/inventory/vehicle/${i}`,
      dos_active: i, // index = dos_active value; 0-29 are top 30
    }))

    const prediction = makePrediction(listings)

    // Mock 30 valid responses (top 30 candidates)
    for (let i = 0; i < 30; i++) {
      mockFetchOk(`https://dealer.com/inventory/vehicle/${i}`)
    }

    const result = await validateListingUrls(prediction)
    const resultListings = result.recentComparables!.listings

    // Top 30 should be validated true
    for (let i = 0; i < 30; i++) {
      expect(resultListings[i].url_validated).toBe(true)
    }
    // Listings 30 and 31 were not candidates - should be false
    expect(resultListings[30].url_validated).toBe(false)
    expect(resultListings[31].url_validated).toBe(false)
    // fetch should have been called exactly 30 times
    expect(global.fetch).toHaveBeenCalledTimes(30)
  })
})
