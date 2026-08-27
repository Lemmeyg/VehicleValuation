/**
 * Ranks comparable vehicle listings against a subject vehicle by best match, in
 * priority order: model-year closeness, then real distance (computed offline,
 * never trusted from MarketCheck's own field — see lib/utils/geo-distance.ts),
 * then price proximity to the subject's own predicted valuation, then mileage
 * closeness. Used both to decide which order listings get their links checked
 * in (url-validator.ts) and to pick which validated listings a report displays.
 *
 * Replaces an earlier same-state/bordering-state approximation, which ranked
 * a listing 800 miles away in a large state as "close" while ranking one just
 * over a state line as "far" — the root cause of a real customer complaint
 * (see docs/comp-selection-process-2026-08-26.md).
 */

import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { computeDistanceMiles, DISTANCE_TIER_MILES } from '@/lib/utils/geo-distance'

export interface RankSubject {
  year: number
  mileage: number
  zip: string | null
  /** The report's own predicted price, if known. Optional — when absent,
   * the price-proximity tier is skipped (treated as a tie) so existing
   * callers that don't pass it keep working unchanged. */
  predictedPrice?: number
}

const PRICE_PROXIMITY_FRACTION = 0.1 // "within 10% of valuation" — a first guess, not a measured optimum

// Display-time price banding (getBestMatchListings): the shown comps exist to
// justify the report's own Fair Market Value, so they must be priced like it.
// Try the tightest band first; widen only if it can't fill the table. Infinity
// is the terminal band (every priced listing), so this always resolves.
const DISPLAY_PRICE_BANDS = [0.1, 0.15, 0.2, 0.25, 0.35, Infinity]

/**
 * 0 = within DISTANCE_TIER_MILES[0] (250mi today)
 * 1 = within DISTANCE_TIER_MILES[1] (500mi today)
 * 2 = within DISTANCE_TIER_MILES[2] (750mi today)
 * 3 = farther than that, or distance couldn't be determined at all
 */
function distanceTierFor(listing: MarketCheckComparable, subjectZip: string | null): 0 | 1 | 2 | 3 {
  if (!subjectZip) return 3
  const dist = computeDistanceMiles(subjectZip, listing)
  if (dist === null) return 3
  for (let i = 0; i < DISTANCE_TIER_MILES.length; i++) {
    if (dist <= DISTANCE_TIER_MILES[i]) return i as 0 | 1 | 2
  }
  return 3
}

/** 0 = within 10% of the subject's predicted price (or price unknown — neutral), 1 = outside it. */
function priceProximityTierFor(
  listing: MarketCheckComparable,
  predictedPrice: number | undefined
): 0 | 1 {
  if (predictedPrice === undefined || predictedPrice <= 0) return 0
  const diff = Math.abs(listing.price - predictedPrice) / predictedPrice
  return diff <= PRICE_PROXIMITY_FRACTION ? 0 : 1
}

/**
 * Sorts listings by best match to the subject vehicle. Does not mutate the
 * input array or limit the result — callers slice to however many they need.
 */
export function rankByBestMatch(
  listings: MarketCheckComparable[],
  subject: RankSubject
): MarketCheckComparable[] {
  return [...listings].sort((a, b) => {
    const yearDiffA = Math.abs(a.year - subject.year)
    const yearDiffB = Math.abs(b.year - subject.year)
    if (yearDiffA !== yearDiffB) return yearDiffA - yearDiffB

    const distTierA = distanceTierFor(a, subject.zip)
    const distTierB = distanceTierFor(b, subject.zip)
    if (distTierA !== distTierB) return distTierA - distTierB

    const priceTierA = priceProximityTierFor(a, subject.predictedPrice)
    const priceTierB = priceProximityTierFor(b, subject.predictedPrice)
    if (priceTierA !== priceTierB) return priceTierA - priceTierB

    const mileageDiffA = Math.abs(a.miles - subject.mileage)
    const mileageDiffB = Math.abs(b.miles - subject.mileage)
    return mileageDiffA - mileageDiffB
  })
}

/**
 * Narrows a priced listing set to those near the subject's predicted price,
 * using the tightest band from DISPLAY_PRICE_BANDS that still holds enough
 * listings to fill the table (`limit`, or the whole set if it's smaller).
 * With no predicted price to compare against, returns the input untouched.
 */
function withinValuationBand(
  priced: MarketCheckComparable[],
  predictedPrice: number | undefined,
  limit: number
): MarketCheckComparable[] {
  if (predictedPrice === undefined || predictedPrice <= 0) return priced
  const needed = Math.min(limit, priced.length)
  for (const band of DISPLAY_PRICE_BANDS) {
    if (band === Infinity) break
    const inBand = priced.filter(l => Math.abs(l.price - predictedPrice) / predictedPrice <= band)
    if (inBand.length >= needed) return inBand
  }
  return priced // no band tight enough could fill the table — show the full spread
}

/**
 * The best `limit` matching listings for the subject vehicle, ranked by
 * `rankByBestMatch`. Used at display time to pick which listings a report
 * shows (web view, print page, and PDF all call this).
 *
 * Two display-only guards run before ranking:
 *  - Zero- and missing-price listings are dropped. The pipeline should already
 *    have removed them (comparables-cleaner.ts), but a "$0 / call for price"
 *    listing must never render on a report even if one slips through.
 *  - When the subject has a predicted price, the set is narrowed to listings
 *    priced near it (see withinValuationBand) so the shown comps are consistent
 *    with the report's own Fair Market Value rather than the closest-by-distance
 *    listings regardless of price.
 * Neither touches `rankByBestMatch`, which still orders the full set for the
 * URL-validation pass.
 */
export function getBestMatchListings(
  listings: MarketCheckComparable[],
  subject: RankSubject,
  limit: number = 10
): MarketCheckComparable[] {
  const priced = listings.filter(l => l.price != null && l.price > 0)
  const nearValuation = withinValuationBand(priced, subject.predictedPrice, limit)
  return rankByBestMatch(nearValuation, subject).slice(0, limit)
}

/** The subset of a stored marketcheck_valuation this selector needs. */
interface StoredValuation {
  predictedPrice?: number
  recentComparables?: { listings?: MarketCheckComparable[] }
}

/**
 * The single entry point the web view, print page, and PDF template all use to
 * pick the comparables a report displays — so all three render the exact same
 * rows. Reads both the listings and the predicted price straight out of the
 * stored `marketcheck_valuation`; the caller supplies only year/mileage/zip.
 */
export function selectDisplayComparables(
  valuation: StoredValuation | null | undefined,
  subject: { year: number; mileage: number; zip: string | null },
  limit: number = 10
): MarketCheckComparable[] {
  const listings = valuation?.recentComparables?.listings ?? []
  return getBestMatchListings(
    listings,
    { ...subject, predictedPrice: valuation?.predictedPrice },
    limit
  )
}
