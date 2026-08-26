/**
 * Real, offline distance calculation between a subject ZIP and a listing's
 * own location — never trusted from MarketCheck's own distance field, which
 * is frequently absent entirely (confirmed against real production data,
 * see docs/comp-selection-process-2026-08-26.md).
 *
 * Uses the `zipcodes` package (offline US ZIP-centroid data, no network
 * calls) — the listing's ZIP when it has one, or its raw latitude/longitude
 * when it doesn't (roughly half of all comps only carry raw coordinates,
 * per the 2026-08-25 comp-relevance audit).
 */
import zipcodes from 'zipcodes'
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'

/** Distance tier boundaries, in miles, used both to rank comps (Task 5) and
 * to decide which comps count as "local" for price averaging (Task 4). A
 * first guess, not a measured optimum — tune here if the tiers turn out
 * wrong in practice. */
export const DISTANCE_TIER_MILES = [250, 500, 750] as const

const EARTH_RADIUS_MILES = 3958.8

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a))
}

export function computeDistanceMiles(
  subjectZip: string,
  listing: MarketCheckComparable
): number | null {
  const listingZip = listing.location?.zip
  if (listingZip) {
    try {
      const dist = zipcodes.distance(subjectZip, listingZip)
      return typeof dist === 'number' && !Number.isNaN(dist) ? dist : null
    } catch {
      return null
    }
  }

  const lat = listing.latitude ? Number(listing.latitude) : NaN
  const lng = listing.longitude ? Number(listing.longitude) : NaN
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  const subject = zipcodes.lookup(subjectZip)
  if (!subject) return null

  return haversineMiles(subject.latitude, subject.longitude, lat, lng)
}
