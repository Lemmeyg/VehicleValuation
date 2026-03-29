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
import { validateListingUrls } from '@/lib/utils/url-validator'

const MIN_VALID = 10

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

  // Progressive year widening: try ±2 years, then ±5, then all.
  // The search index only covers up to 2022, so newer vehicles may need wider bands.
  // Filtering before URL validation avoids wasting HTTP checks on out-of-range listings.
  const YEAR_DELTAS = [2, 5, Infinity]
  let yearFiltered: MarketCheckComparable[] = []
  let appliedDelta = Infinity
  for (const delta of YEAR_DELTAS) {
    const band =
      delta === Infinity
        ? fallbackListings
        : fallbackListings.filter(l => Math.abs(l.year - subjectVehicle.year) <= delta)
    if (band.length > 0) {
      yearFiltered = band
      appliedDelta = delta
      break
    }
  }

  if (yearFiltered.length === 0) return unchanged

  console.log('[supplementComparables] Year filter applied', {
    subjectYear: subjectVehicle.year,
    delta: appliedDelta === Infinity ? 'none' : `±${appliedDelta}`,
    beforeFilter: fallbackListings.length,
    afterFilter: yearFiltered.length,
  })

  // Validate URLs on the year-filtered listings only
  const predictionForValidation: MarketCheckPrediction = {
    ...fallbackResult.data,
    recentComparables: {
      ...fallbackResult.data.recentComparables!,
      listings: yearFiltered,
    },
  }

  let validatedFallbackListings: MarketCheckComparable[] = []
  try {
    const { prediction: validatedFallback } = await validateListingUrls(predictionForValidation)
    validatedFallbackListings = validatedFallback.recentComparables?.listings ?? []
  } catch (err) {
    console.error('[supplementComparables] validateListingUrls threw on fallback:', err)
    return unchanged
  }

  // Original listings (flags preserved unchanged)
  const originalListings = prediction.recentComparables?.listings ?? []

  // Build set of VINs already in the original pool (for deduplication)
  const originalVinSet = new Set(originalListings.map(l => l.vin).filter(Boolean))

  // Fallback listings not already in original pool (dedup — original wins)
  const newFallbackListings = validatedFallbackListings.filter(l => !originalVinSet.has(l.vin))
  if (newFallbackListings.length === 0) return unchanged

  // Original listings keep their flags entirely; fallback listings appended after,
  // with whatever url_validated flags they received from validateListingUrls — unchanged.
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
