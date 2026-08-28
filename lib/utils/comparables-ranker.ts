/**
 * The single entry point the web view, print page, and PDF template all use to
 * pick the comparables a report displays — so all three render identical rows.
 *
 * Pipeline (see docs/plans/2026-08-27-comp-selection-unified-release.md §"The
 * selection algorithm"):
 *   hard gates -> link split (live / checked-failed / never-checked)
 *   -> two-tier pool (franchise+independent primary; nationwide fallback only
 *      on a <limit shortfall)
 *   -> weighted relevance score
 *   -> assemble top `limit`, allowing <= MAX_DEAD_LINK_COMPS checked-failed
 *      comps that score >= DEAD_LINK_SCORE_FLOOR to back-fill a small live
 *      shortfall (or to stand in entirely when no link survived validation).
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { gateListings } from '@/lib/utils/comp-gates'
import {
  weightedRelevanceScore,
  DEAD_LINK_SCORE_FLOOR,
  MAX_DEAD_LINK_COMPS,
  type ScoreSubject,
} from '@/lib/utils/comp-relevance-score'

export type RankSubject = ScoreSubject

/** Score-descending order. Non-mutating. Kept for callers that want a bare
 * comparator over an already-prepared list (e.g. url-validator). */
export function rankByBestMatch(
  listings: MarketCheckComparable[],
  subject: RankSubject,
  predictedPrice?: number
): MarketCheckComparable[] {
  return [...listings].sort(
    (a, b) =>
      weightedRelevanceScore(b, subject, predictedPrice) -
      weightedRelevanceScore(a, subject, predictedPrice)
  )
}

interface StoredValuation {
  predictedPrice?: number
  recentComparables?: { listings?: MarketCheckComparable[] }
}

export function selectDisplayComparables(
  valuation: StoredValuation | null | undefined,
  subject: { year: number; mileage: number; zip: string | null; model?: string; trim?: string },
  limit = 10
): MarketCheckComparable[] {
  const all = valuation?.recentComparables?.listings ?? []
  if (all.length === 0) return []

  const predictedPrice = valuation?.predictedPrice
  const scoreSubject: ScoreSubject = { ...subject }
  const score = (c: MarketCheckComparable) =>
    weightedRelevanceScore(c, scoreSubject, predictedPrice)

  // 1. hard gates
  const gated = gateListings(all, subject, predictedPrice)
  if (gated.length === 0) return []

  // 2. link split
  const anyHasFlag = gated.some(c => Object.prototype.hasOwnProperty.call(c, 'url_validated'))
  let live: MarketCheckComparable[]
  let failedCheck: MarketCheckComparable[]
  if (!anyHasFlag) {
    live = gated // report predates link validation
    failedCheck = []
  } else {
    live = gated.filter(c => c.url_validated === true)
    failedCheck = gated.filter(c => c.url_validated === false)
  }

  // 3. two-tier pool (on `live`)
  const livePrimary = live.filter(c => c.source_tier !== 'fallback_search')
  const poolForScoring = livePrimary.length >= limit ? livePrimary : live

  // 4. how many checked-failed comps we may admit.
  //    - no live comp survived  -> stand in with up to MAX_DEAD_LINK_COMPS high scorers
  //    - live pool is <= MAX short of `limit` -> back-fill exactly that gap
  //    - live pool is full, or too far short to paper over -> none
  const gap = limit - poolForScoring.length
  let deadBudget: number
  if (poolForScoring.length === 0) {
    deadBudget = MAX_DEAD_LINK_COMPS
  } else if (gap > 0 && gap <= MAX_DEAD_LINK_COMPS) {
    deadBudget = gap
  } else {
    deadBudget = 0
  }

  const deadAllowance =
    deadBudget === 0
      ? []
      : [...failedCheck]
          .sort((a, b) => score(b) - score(a))
          .filter(c => score(c) >= DEAD_LINK_SCORE_FLOOR)
          .slice(0, deadBudget)

  // 5. assemble
  return [...poolForScoring, ...deadAllowance].sort((a, b) => score(b) - score(a)).slice(0, limit)
}
