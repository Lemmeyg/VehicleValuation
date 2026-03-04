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

// Helper to mock a successful HEAD response
function mockFetchOk(finalUrl: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 200,
    url: finalUrl,
  })
}

// Helper to mock a 405 (Method Not Allowed) response — HEAD not supported but URL exists
function mockFetch405(finalUrl: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 405,
    url: finalUrl,
  })
}

// Helper to mock a 404 response
function mockFetch404(finalUrl: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 404,
    url: finalUrl,
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

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result).toBe(prediction)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(stats.checkedCount).toBe(0)
    expect(stats.failedCount).toBe(0)
    expect(stats.failedUrls).toEqual([])
    expect(stats.batchesUsed).toBe(0)
  })

  it('marks listing as validated when HEAD request returns 200', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchOk('https://dealer.com/inventory/vehicle/12345')

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(true)
    expect(stats.checkedCount).toBe(1)
    expect(stats.failedCount).toBe(0)
    expect(stats.failedUrls).toEqual([])
    expect(stats.validatedUrls).toEqual(['https://dealer.com/inventory/vehicle/12345'])
    expect(stats.batchesUsed).toBe(1)
  })

  it('uses HEAD requests to reduce bot-detection on dealer sites', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/12345', dos_active: 5 },
    ])

    mockFetchOk('https://dealer.com/inventory/12345')

    await validateListingUrls(prediction)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://dealer.com/inventory/12345',
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('accepts listing when server returns 405 (HEAD not supported but URL exists)', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/12345', dos_active: 5 },
    ])

    mockFetch405('https://dealer.com/inventory/12345')

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(true)
    expect(stats.failedCount).toBe(0)
  })

  it('accepts listing when URL resolves to a 2-segment path (common VDP format)', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/12345', dos_active: 5 },
    ])

    mockFetchOk('https://dealer.com/inventory/12345')

    const { prediction: result } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(true)
  })

  it('marks listing as validated when it has no vdp_url (data still valid)', async () => {
    const prediction = makePrediction([
      { dos_active: 5 }, // no vdp_url
    ])

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(stats.checkedCount).toBe(0) // no URL checked
    expect(stats.failedCount).toBe(0)
  })

  it('rejects listing when fetch times out', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchTimeout()

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
    expect(stats.failedCount).toBe(1)
    expect(stats.failedUrls).toEqual(['https://dealer.com/inventory/vehicle/12345'])
  })

  it('rejects listing when URL returns 404', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetch404('https://dealer.com/inventory/vehicle/12345')

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
    expect(stats.failedCount).toBe(1)
    expect(stats.failedUrls).toEqual(['https://dealer.com/inventory/vehicle/12345'])
  })

  it('rejects listing when URL returns 403 (bot blocked)', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 403,
      url: 'https://dealer.com/inventory/vehicle/12345',
    })

    const { prediction: result, stats } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
    expect(stats.failedCount).toBe(1)
  })

  it('rejects listing when URL redirects to dealer homepage', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    mockFetchHomepageRedirect('https://dealer.com/inventory/vehicle/12345')

    const { prediction: result } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('rejects listing when URL redirects to a path with 1 segment (inventory index)', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      url: 'https://dealer.com/inventory', // 1 segment — inventory index page
    })

    const { prediction: result } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('returns prediction with url_validated: true when listings array is empty', async () => {
    const prediction: MarketCheckPrediction = {
      predictedPrice: 20000,
      confidence: 'high',
      priceRange: { min: 18000, max: 22000 },
      msrp: null,
      totalComparablesFound: 0,
      comparablesStats: undefined,
      recentComparables: {
        num_found: 0,
        listings: [],
        stats: undefined,
      },
      generatedAt: new Date().toISOString(),
    } as MarketCheckPrediction

    const { prediction: result } = await validateListingUrls(prediction)
    expect(result).toBe(prediction)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects listing when URL redirects to a different domain', async () => {
    const prediction = makePrediction([
      { vdp_url: 'https://dealer.com/inventory/vehicle/12345', dos_active: 5 },
    ])

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      url: 'https://completelydifferentsite.com/home', // different domain
    })

    const { prediction: result } = await validateListingUrls(prediction)
    expect(result.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('validates multiple listings in parallel within a batch and annotates each correctly', async () => {
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

    const { prediction: result, stats } = await validateListingUrls(prediction)
    const listings = result.recentComparables!.listings
    expect(listings[0].url_validated).toBe(true)
    expect(listings[1].url_validated).toBe(false)
    expect(listings[2].url_validated).toBe(true)
    expect(stats.checkedCount).toBe(3)
    expect(stats.failedCount).toBe(1)
    expect(stats.failedUrls).toEqual(['https://dealer.com/inventory/vehicle/222'])
    expect(stats.validatedUrls).toEqual([
      'https://dealer.com/inventory/vehicle/111',
      'https://dealer.com/inventory/vehicle/333',
    ])
    expect(stats.batchesUsed).toBe(1)
  })

  it('stops after first batch when TARGET_VALID (10) listings pass', async () => {
    // 25 listings total; first 10 all pass — should only fetch batch 1 (20 URLs)
    // and stop without fetching the remaining 5
    const listings = Array.from({ length: 25 }, (_, i) => ({
      vdp_url: `https://dealer.com/inventory/vehicle/${i}`,
      dos_active: i,
    }))
    const prediction = makePrediction(listings)

    // All 20 in batch 1 return OK (10 valid is reached within this batch)
    for (let i = 0; i < 20; i++) {
      mockFetchOk(`https://dealer.com/inventory/vehicle/${i}`)
    }

    const { prediction: result, stats } = await validateListingUrls(prediction)

    // fetch called exactly 20 times (batch 1 only)
    expect(global.fetch).toHaveBeenCalledTimes(20)
    expect(stats.batchesUsed).toBe(1)

    // First 20 listings should be validated (≥10 passed, batch stopped)
    const resultListings = result.recentComparables!.listings
    for (let i = 0; i < 20; i++) {
      expect(resultListings[i].url_validated).toBe(true)
    }
    // Listings 20-24 never checked → false
    for (let i = 20; i < 25; i++) {
      expect(resultListings[i].url_validated).toBe(false)
    }
  })

  it('fetches a second batch when first batch yields fewer than 10 valid', async () => {
    // 40 listings; batch 1 (0-19) has only 3 valid, batch 2 (20-39) has 10 valid
    const listings = Array.from({ length: 40 }, (_, i) => ({
      vdp_url: `https://dealer.com/inventory/vehicle/${i}`,
      dos_active: i,
    }))
    const prediction = makePrediction(listings)

    // Batch 1 (indices 0-19): only indices 0, 1, 2 pass (3 valid)
    for (let i = 0; i < 20; i++) {
      if (i < 3) {
        mockFetchOk(`https://dealer.com/inventory/vehicle/${i}`)
      } else {
        mockFetch404(`https://dealer.com/inventory/vehicle/${i}`)
      }
    }
    // Batch 2 (indices 20-39): all pass
    for (let i = 20; i < 40; i++) {
      mockFetchOk(`https://dealer.com/inventory/vehicle/${i}`)
    }

    const { prediction: result, stats } = await validateListingUrls(prediction)

    // fetch called 40 times (both batches)
    expect(global.fetch).toHaveBeenCalledTimes(40)
    expect(stats.batchesUsed).toBe(2)
    expect(stats.failedCount).toBe(17) // 17 failed in batch 1

    // Batch 1 pass/fail
    const resultListings = result.recentComparables!.listings
    for (let i = 0; i < 3; i++) {
      expect(resultListings[i].url_validated).toBe(true)
    }
    for (let i = 3; i < 20; i++) {
      expect(resultListings[i].url_validated).toBe(false)
    }
    // Batch 2: all validated true
    for (let i = 20; i < 40; i++) {
      expect(resultListings[i].url_validated).toBe(true)
    }
  })

  it('stops mid-pool when TARGET_VALID reached; unchecked listings get url_validated: false', async () => {
    // 50 listings. Batch 1 (0-19): 5 pass. Batch 2 (20-39): 5 pass → total 10, stop.
    // Listings 40-49 never touched.
    const listings = Array.from({ length: 50 }, (_, i) => ({
      vdp_url: `https://dealer.com/inventory/vehicle/${i}`,
      dos_active: i,
    }))
    const prediction = makePrediction(listings)

    // Batch 1: first 5 pass, rest fail
    for (let i = 0; i < 20; i++) {
      if (i < 5) mockFetchOk(`https://dealer.com/inventory/vehicle/${i}`)
      else mockFetch404(`https://dealer.com/inventory/vehicle/${i}`)
    }
    // Batch 2: first 5 pass, rest fail
    for (let i = 20; i < 40; i++) {
      if (i < 25) mockFetchOk(`https://dealer.com/inventory/vehicle/${i}`)
      else mockFetch404(`https://dealer.com/inventory/vehicle/${i}`)
    }

    const { prediction: result, stats } = await validateListingUrls(prediction)

    expect(global.fetch).toHaveBeenCalledTimes(40) // batches 1 and 2 only
    expect(stats.batchesUsed).toBe(2)

    const resultListings = result.recentComparables!.listings
    // Passed in batch 1
    for (let i = 0; i < 5; i++) expect(resultListings[i].url_validated).toBe(true)
    // Failed in batch 1
    for (let i = 5; i < 20; i++) expect(resultListings[i].url_validated).toBe(false)
    // Passed in batch 2
    for (let i = 20; i < 25; i++) expect(resultListings[i].url_validated).toBe(true)
    // Failed in batch 2
    for (let i = 25; i < 40; i++) expect(resultListings[i].url_validated).toBe(false)
    // Never checked
    for (let i = 40; i < 50; i++) expect(resultListings[i].url_validated).toBe(false)
  })

  it('exhausts entire pool when TARGET_VALID is never reached', async () => {
    // 25 listings; all fail — should check all 25 across 2 batches (20 + 5)
    const listings = Array.from({ length: 25 }, (_, i) => ({
      vdp_url: `https://dealer.com/inventory/vehicle/${i}`,
      dos_active: i,
    }))
    const prediction = makePrediction(listings)

    for (let i = 0; i < 25; i++) {
      mockFetch404(`https://dealer.com/inventory/vehicle/${i}`)
    }

    const { prediction: result, stats } = await validateListingUrls(prediction)

    expect(global.fetch).toHaveBeenCalledTimes(25)
    expect(stats.batchesUsed).toBe(2)
    expect(stats.failedCount).toBe(25)
    expect(stats.checkedCount).toBe(25)

    const resultListings = result.recentComparables!.listings
    for (let i = 0; i < 25; i++) {
      expect(resultListings[i].url_validated).toBe(false)
    }
  })
})
