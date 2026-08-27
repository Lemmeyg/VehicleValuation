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
 * The best `limit` matching listings for the subject vehicle, ranked by
 * `rankByBestMatch`. Used at display time to pick which listings a report
 * shows (web view, print page, and PDF all call this).
 *
 * Zero- and missing-price listings are dropped here as a last-resort guard:
 * the pipeline should already have removed them (comparables-cleaner.ts), but
 * a "$0 / call for price" listing must never render on a report even if one
 * slips through, or out-ranks priced listings on year/distance/mileage.
 */
export function getBestMatchListings(
  listings: MarketCheckComparable[],
  subject: RankSubject,
  limit: number = 10
): MarketCheckComparable[] {
  const priced = listings.filter(l => l.price != null && l.price > 0)
  return rankByBestMatch(priced, subject).slice(0, limit)
}
