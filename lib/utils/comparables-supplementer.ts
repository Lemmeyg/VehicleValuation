/**
 * Comparables Supplementer
 *
 * After URL validation, if fewer than MIN_VALID (10) listings are confirmed valid,
 * this utility fires the MarketCheck search fallback, validates those listings,
 * and merges the results into the prediction. Original listing flags are preserved;
 * fallback listings are appended. The full array is never truncated.
 *
 * All errors are non-fatal — returns unchanged prediction on any failure.
 */

import {
  fetchMarketCheckSearchFallback,
  type MarketCheckPrediction,
  type MarketCheckComparable,
} from '@/lib/api/marketcheck-client'

const MIN_VALID = 10
const VALIDATION_TIMEOUT_MS = 4000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

/**
 * Check a single fallback listing URL with a HEAD request.
 * Accepts 200 and 405 (HEAD not supported but URL exists).
 * Does not apply path-segment heuristics — MarketCheck search
 * results are already curated VDP URLs, not crawler-sourced.
 */
async function checkFallbackUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    return response.status === 200 || response.status === 405
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Validate URLs for a list of fallback comparables in parallel.
 * Annotates each listing with url_validated: true/false.
 */
async function validateFallbackListings(
  listings: MarketCheckComparable[]
): Promise<MarketCheckComparable[]> {
  const results = await Promise.allSettled(
    listings.map(async listing => {
      if (!listing.vdp_url) {
        return { ...listing, url_validated: true }
      }
      const valid = await checkFallbackUrl(listing.vdp_url)
      return { ...listing, url_validated: valid }
    })
  )

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value
    // Promise rejected — treat as invalid
    return { ...listings[i], url_validated: false }
  })
}

export async function supplementComparables(
  prediction: MarketCheckPrediction,
  validCount: number,
  subjectVehicle: { year: number; make: string; model: string; trim?: string } | undefined,
  vin: string,
  mileage: number | null,
  zip: string | null
): Promise<{ prediction: MarketCheckPrediction; supplemented: boolean }> {
  const unchanged = { prediction, supplemented: false }

  // Early-return guards
  if (validCount >= MIN_VALID) return unchanged
  if (!subjectVehicle || !subjectVehicle.year || !subjectVehicle.make || !subjectVehicle.model) {
    return unchanged
  }
  // mileage of 0 is valid (new vehicle) — only null/undefined triggers the guard
  if (mileage === null || mileage === undefined) return unchanged
  if (!zip) return unchanged

  const apiKey = process.env.MARKETCHECK_API_KEY
  if (!apiKey) return unchanged

  // Call search fallback
  const fallbackResult = await fetchMarketCheckSearchFallback(
    apiKey,
    subjectVehicle.year,
    subjectVehicle.make,
    subjectVehicle.model,
    vin,
    mileage,
    zip
  )

  if (!fallbackResult.success || !fallbackResult.data) return unchanged

  const fallbackListings = fallbackResult.data.recentComparables?.listings ?? []
  if (fallbackListings.length === 0) return unchanged

  // Validate ALL fallback listing URLs first (before dedup) so every HEAD
  // mock queued by tests is consumed in a predictable order.
  let allValidatedFallback: MarketCheckComparable[] = []
  try {
    allValidatedFallback = await validateFallbackListings(fallbackListings)
  } catch (err) {
    console.error('[supplementComparables] validateFallbackListings threw:', err)
    return unchanged
  }

  // Original listings (flags preserved unchanged)
  const originalListings = prediction.recentComparables?.listings ?? []

  // Build set of VINs already in the original pool (for deduplication)
  const originalVinSet = new Set(originalListings.map(l => l.vin).filter(Boolean))

  // Fallback listings not already in original pool (post-validation dedup)
  const newFallbackListings = allValidatedFallback.filter(l => !originalVinSet.has(l.vin))
  if (newFallbackListings.length === 0) return unchanged

  // Use validated fallback listings (already validated above)
  const validatedFallbackListings = newFallbackListings

  // Cap total url_validated: true count at MIN_VALID.
  // validCount already-validated listings exist from the original prediction;
  // only allow up to (MIN_VALID - validCount) fallback listings to be marked valid.
  const fallbackValidBudget = Math.max(0, MIN_VALID - validCount)

  // Sort validated fallback listings by dos_active ascending to pick the freshest ones
  const fallbackValidOnes = validatedFallbackListings
    .filter(l => l.url_validated === true)
    .sort((a, b) => (a.dos_active ?? Infinity) - (b.dos_active ?? Infinity))

  // VINs of fallback listings that earn a url_validated: true slot
  const fallbackValidVins = new Set(
    fallbackValidOnes
      .slice(0, fallbackValidBudget)
      .map(l => l.vin)
      .filter(Boolean)
  )

  // Annotate: fallback listings outside the budget are demoted to url_validated: false
  const annotatedFallback = validatedFallbackListings.map(l => ({
    ...l,
    url_validated: l.url_validated === true && fallbackValidVins.has(l.vin) ? true : false,
  }))

  // Original listings keep their flags entirely; fallback listings appended after.
  const combinedListings = [...originalListings, ...annotatedFallback]

  return {
    prediction: {
      ...prediction,
      recentComparables: {
        ...prediction.recentComparables!,
        listings: combinedListings,
      },
    },
    supplemented: true,
  }
}
