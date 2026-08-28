/**
 * Cheap disqualifying gates for comparable listings. Run BEFORE URL validation
 * at report creation (so a disqualified comp is never HTTP-checked) and again,
 * defensively, inside selectDisplayComparables.
 *
 * Model is NOT gated: verified 2026-08-28 that a token-overlap model gate drops
 * 0 comps across 80 paid reports / 4,863 stored comps — MarketCheck only ever
 * returns same-model comps and cleanAndFilterComparables keeps them consistent.
 * If wrong-model bleed ever appears (see the fallback-search fix in this same
 * release), guard it at creation in cleanAndFilterComparables, not here.
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { PRICE_GATE_FRACTION } from '@/lib/utils/comp-relevance-score'

export function passesHardGates(comp: MarketCheckComparable, predictedPrice?: number): boolean {
  if (comp.price == null || comp.price <= 0) return false
  if (comp.miles == null) return false
  if (predictedPrice && predictedPrice > 0) {
    const frac = Math.abs(comp.price - predictedPrice) / predictedPrice
    if (frac > PRICE_GATE_FRACTION) return false
  }
  return true
}

export function gateListings(
  listings: MarketCheckComparable[],
  predictedPrice?: number
): MarketCheckComparable[] {
  return listings.filter(l => passesHardGates(l, predictedPrice))
}
