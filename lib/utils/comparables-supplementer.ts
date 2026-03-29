/**
 * Comparables Supplementer
 *
 * After URL validation, if fewer than MIN_VALID (10) listings are confirmed valid,
 * this utility fires the MarketCheck search fallback in up to two paginated passes
 * (rows 0–49, then 50–99 if still < 10 valid), validates those listings in
 * year-closeness-then-distance order, and merges the results into the prediction.
 * Original listing flags are preserved; fallback listings are appended.
 * The full array is never truncated.
 *
 * All errors are non-fatal — returns unchanged prediction on any failure.
 */

import {
  fetchMarketCheckSearchFallback,
  type MarketCheckPrediction,
  type MarketCheckComparable,
} from '@/lib/api/marketcheck-client'
import { validateListingUrls } from '@/lib/utils/url-validator'

const MIN_VALID = 10

/**
 * Sort comparables by year closeness to subject vehicle (ascending), then by
 * distance from the subject ZIP (ascending). Listings without distance_miles
 * sort to the end within each year group.
 */
function sortByYearThenDistance(
  listings: MarketCheckComparable[],
  subjectYear: number
): MarketCheckComparable[] {
  return [...listings].sort((a, b) => {
    const yearDiff = Math.abs(a.year - subjectYear) - Math.abs(b.year - subjectYear)
    if (yearDiff !== 0) return yearDiff
    const aDist = a.location?.distance_miles ?? Infinity
    const bDist = b.location?.distance_miles ?? Infinity
    return aDist - bDist
  })
}

/**
 * Apply progressive year widening (±2, ±5, all) to a list of fallback listings.
 * Returns the tightest band that yields at least one result, or empty array if none.
 */
function applyYearFilter(
  listings: MarketCheckComparable[],
  subjectYear: number
): MarketCheckComparable[] {
  const YEAR_DELTAS = [2, 5, Infinity]
  for (const delta of YEAR_DELTAS) {
    const band =
      delta === Infinity ? listings : listings.filter(l => Math.abs(l.year - subjectYear) <= delta)
    if (band.length > 0) {
      console.log('[supplementComparables] Year filter applied', {
        subjectYear,
        delta: delta === Infinity ? 'none' : `±${delta}`,
        beforeFilter: listings.length,
        afterFilter: band.length,
      })
      return band
    }
  }
  return []
}

/**
 * Fetch one page of search fallback listings, apply year filter, sort by year+distance,
 * and validate URLs. Returns the validated listings array or null on any failure.
 */
async function fetchAndValidatePage(
  apiKey: string,
  subjectVehicle: { year: number; make: string; model: string; trim?: string },
  vin: string,
  mileage: number,
  zip: string,
  start: number
): Promise<MarketCheckComparable[] | null> {
  const fallbackResult = await fetchMarketCheckSearchFallback(
    apiKey,
    subjectVehicle.year,
    subjectVehicle.make,
    subjectVehicle.model,
    vin,
    mileage,
    zip,
    start
  )

  if (!fallbackResult.success || !fallbackResult.data) return null

  const listings = fallbackResult.data.recentComparables?.listings ?? []
  if (listings.length === 0) return null

  const predictionForValidation: MarketCheckPrediction = {
    ...fallbackResult.data,
    recentComparables: {
      ...fallbackResult.data.recentComparables!,
      listings,
    },
  }

  const { prediction: validated } = await validateListingUrls(predictionForValidation, {
    sortFn: l => sortByYearThenDistance(l, subjectVehicle.year),
  })

  return validated.recentComparables?.listings ?? null
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

  const originalListings = prediction.recentComparables?.listings ?? []
  const originalVinSet = new Set(originalListings.map(l => l.vin).filter(Boolean))

  // ── Pass 1 (rows 0–49) ───────────────────────────────────────────────────────
  let pass1Listings: MarketCheckComparable[] = []
  try {
    const validated = await fetchAndValidatePage(apiKey, subjectVehicle, vin, mileage, zip, 0)
    if (validated === null) return unchanged
    pass1Listings = validated.filter(l => !originalVinSet.has(l.vin))
  } catch (err) {
    console.error('[supplementComparables] Pass 1 threw:', err)
    return unchanged
  }

  const pass1ValidCount = pass1Listings.filter(l => l.url_validated).length
  const totalValidAfterPass1 = validCount + pass1ValidCount

  // ── Pass 2 (rows 50–99, only if still < MIN_VALID) ──────────────────────────
  let pass2Listings: MarketCheckComparable[] = []
  if (totalValidAfterPass1 < MIN_VALID) {
    const pass1VinSet = new Set([
      ...Array.from(originalVinSet),
      ...pass1Listings.map(l => l.vin).filter(Boolean),
    ])
    try {
      const validated = await fetchAndValidatePage(apiKey, subjectVehicle, vin, mileage, zip, 50)
      if (validated !== null) {
        pass2Listings = validated.filter(l => !pass1VinSet.has(l.vin))
      }
    } catch (err) {
      console.error('[supplementComparables] Pass 2 threw:', err)
      // Non-fatal: use pass 1 results
    }
  }

  const newFallbackListings = [...pass1Listings, ...pass2Listings]
  if (newFallbackListings.length === 0) return unchanged

  // Original listings keep their flags entirely; fallback listings appended after.
  const combinedListings = [...originalListings, ...newFallbackListings]

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
