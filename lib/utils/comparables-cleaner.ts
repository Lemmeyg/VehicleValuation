import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'

export const MAX_DEALER_LISTINGS = 2
const MAX_YEAR_ABOVE_SUBJECT = 1
const MIN_YEAR_BELOW_SUBJECT = 3

/**
 * Removes bad data and normalises a raw comparable listings array.
 * Apply to any listings array before storing or displaying.
 *
 * Filters (in order):
 * 1. Drop miles === 0 or missing (new/unlisted inventory — not comparable to a used vehicle)
 * 2. Drop price === 0 or missing
 * 3. Drop duplicate VINs — keep first occurrence
 * 4. Year range: subjectYear-3 → subjectYear+1 (skipped when subjectYear undefined)
 * 5. Dealer cap: max MAX_DEALER_LISTINGS per named dealer
 */
export function cleanAndFilterComparables(
  listings: MarketCheckComparable[],
  subjectYear?: number
): MarketCheckComparable[] {
  let result = listings.filter(l => l.miles != null && l.miles > 0)

  result = result.filter(l => l.price != null && l.price > 0)

  const seenVins = new Set<string>()
  result = result.filter(l => {
    if (!l.vin) return true
    if (seenVins.has(l.vin)) return false
    seenVins.add(l.vin)
    return true
  })

  if (subjectYear !== undefined) {
    const minYear = subjectYear - MIN_YEAR_BELOW_SUBJECT
    const maxYear = subjectYear + MAX_YEAR_ABOVE_SUBJECT
    result = result.filter(l => l.year >= minYear && l.year <= maxYear)
  }

  const dealerCounts = new Map<string, number>()
  result = result.filter(l => {
    const dealer = l.dealer_name ?? (l.dealer_id != null ? String(l.dealer_id) : null)
    if (!dealer) return true
    const count = dealerCounts.get(dealer) ?? 0
    if (count >= MAX_DEALER_LISTINGS) return false
    dealerCounts.set(dealer, count + 1)
    return true
  })

  return result
}
