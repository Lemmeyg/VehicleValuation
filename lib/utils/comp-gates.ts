/**
 * Cheap disqualifying gates for comparable listings. Run BEFORE URL validation
 * at report creation (so a disqualified comp is never HTTP-checked) and again,
 * defensively, inside selectDisplayComparables. See
 * docs/plans/2026-08-27-comp-selection-unified-release.md §2.
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'

const PRICE_GATE_FRACTION = 0.4 // keep in sync with comp-relevance-score.ts

export interface GateSubject {
  model?: string
}

export function passesHardGates(
  comp: MarketCheckComparable,
  subject: GateSubject,
  predictedPrice?: number
): boolean {
  if (subject.model && comp.model && subject.model.toLowerCase() !== comp.model.toLowerCase()) {
    return false
  }
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
  subject: GateSubject,
  predictedPrice?: number
): MarketCheckComparable[] {
  return listings.filter(l => passesHardGates(l, subject, predictedPrice))
}
