/**
 * Ranks comparable vehicle listings against a subject vehicle by best match, in
 * priority order: model-year closeness, then location closeness, then mileage
 * closeness. Used both to decide which order listings get their links checked in
 * (url-validator.ts) and to pick which validated listings a report displays.
 */

import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { resolveStateCodeFromZip } from '@/lib/personalization/zip-to-state'
import { locationTier } from '@/lib/utils/state-geo'

export interface RankSubject {
  year: number
  mileage: number
  zip: string | null
}

/**
 * Resolves a listing's state from whatever location data it has, in order of
 * confidence: an explicit ZIP, then explicit state text. Returns null if neither
 * is present (including listings that only carry raw latitude/longitude — MarketCheck
 * sometimes omits the dealer address block entirely).
 */
function resolveListingState(listing: MarketCheckComparable): string | null {
  if (listing.location?.zip) return resolveStateCodeFromZip(listing.location.zip)
  if (listing.location?.state) return listing.location.state
  return null
}

/**
 * How close a listing's location is to the subject, for ranking:
 *   0 = same state
 *   1 = a bordering state, OR only raw coordinates are known (real signal, just
 *       not resolvable to a state without a proper reverse-geocode)
 *   2 = a confirmed non-bordering state, or no location data at all
 */
function locationTierFor(listing: MarketCheckComparable, subjectState: string | null): 0 | 1 | 2 {
  const listingState = resolveListingState(listing)
  if (listingState) return locationTier(subjectState, listingState)
  if (listing.latitude && listing.longitude) return 1
  return 2
}

/**
 * Sorts listings by best match to the subject vehicle: model-year closeness first,
 * then location closeness, then mileage closeness. Does not mutate the input array
 * or limit the result — callers slice to however many they need.
 */
export function rankByBestMatch(
  listings: MarketCheckComparable[],
  subject: RankSubject
): MarketCheckComparable[] {
  const subjectState = resolveStateCodeFromZip(subject.zip)

  return [...listings].sort((a, b) => {
    const yearDiffA = Math.abs(a.year - subject.year)
    const yearDiffB = Math.abs(b.year - subject.year)
    if (yearDiffA !== yearDiffB) return yearDiffA - yearDiffB

    const locationA = locationTierFor(a, subjectState)
    const locationB = locationTierFor(b, subjectState)
    if (locationA !== locationB) return locationA - locationB

    const mileageDiffA = Math.abs(a.miles - subject.mileage)
    const mileageDiffB = Math.abs(b.miles - subject.mileage)
    return mileageDiffA - mileageDiffB
  })
}

/**
 * The best `limit` matching listings for the subject vehicle, ranked by
 * `rankByBestMatch`. Used at display time to pick which validated listings a
 * report shows.
 */
export function getBestMatchListings(
  listings: MarketCheckComparable[],
  subject: RankSubject,
  limit: number = 10
): MarketCheckComparable[] {
  return rankByBestMatch(listings, subject).slice(0, limit)
}
