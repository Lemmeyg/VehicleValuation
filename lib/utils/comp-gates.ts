/**
 * Cheap disqualifying gates for comparable listings. Run BEFORE URL validation
 * at report creation (so a disqualified comp is never HTTP-checked) and again,
 * defensively, inside selectDisplayComparables. See
 * docs/plans/2026-08-27-comp-selection-unified-release.md §2 and §C1.
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { norm, PRICE_GATE_FRACTION } from '@/lib/utils/comp-relevance-score'

export interface GateSubject {
  model?: string
}

/**
 * Model gate — token-overlap, NOT exact equality.
 *
 * `subject.model` is the auto.dev VIN-decode model; `comp.model` is
 * MarketCheck's, and the two vendors disagree on real vehicles (documented
 * case: 'C-Max Energi' vs 'C-Max'). Exact equality drops every comp for such a
 * vehicle. Instead: fail only when both strings are present, each tokenizes to
 * ≥1 token, and they share NO token. So 'c-max energi' vs 'c-max' (shares
 * 'c','max') → keep; 'Highlander' vs 'Camry' (no overlap) → drop.
 */
export function modelTokensOverlap(subjectModel?: string, compModel?: string): boolean {
  if (!subjectModel || !compModel) return true
  const a = norm(subjectModel)
  const b = norm(compModel)
  if (a.length === 0 || b.length === 0) return true
  const aSet = new Set(a)
  return b.some(t => aSet.has(t))
}

export function passesHardGates(
  comp: MarketCheckComparable,
  subject: GateSubject,
  predictedPrice?: number,
  options?: { skipModelGate?: boolean }
): boolean {
  if (!options?.skipModelGate && !modelTokensOverlap(subject.model, comp.model)) {
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
  const gated = listings.filter(l => passesHardGates(l, subject, predictedPrice))
  if (gated.length > 0) return gated

  // Safety valve: the model gate wiped the whole pool. If disabling ONLY the
  // model predicate leaves a non-empty set, the wipeout was a vendor
  // model-string mismatch (e.g. 'C-Max Energi' vs 'C-Max') — keep those comps
  // rather than hand the customer a paid report with zero comparables.
  const withoutModelGate = listings.filter(l =>
    passesHardGates(l, subject, predictedPrice, { skipModelGate: true })
  )
  if (withoutModelGate.length > 0) {
    const sampleCompModels = Array.from(
      new Set(withoutModelGate.map(l => l.model).filter(Boolean))
    ).slice(0, 3)
    console.warn('[gateListings] model gate emptied the pool; keeping non-model-gated comps', {
      subjectModel: subject.model,
      sampleCompModels,
    })
    return withoutModelGate
  }

  return gated
}
