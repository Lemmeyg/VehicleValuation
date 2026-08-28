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
 *   -> assemble top `limit`: a full live slate (>= limit) admits no
 *      checked-failed comps; any live shortfall (including zero live) admits
 *      up to MAX_DEAD_LINK_COMPS checked-failed comps that score
 *      >= DEAD_LINK_SCORE_FLOOR to back-fill it.
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
  // Score every comp exactly once — weightedRelevanceScore does a zipcodes
  // distance lookup, and it is read from inside several sort comparators below.
  const scoreByComp = new Map<MarketCheckComparable, number>(
    all.map(c => [c, weightedRelevanceScore(c, scoreSubject, predictedPrice)])
  )
  const score = (c: MarketCheckComparable) => scoreByComp.get(c) ?? 0

  // 1. hard gates
  const gated = gateListings(all, predictedPrice)
  if (gated.length === 0) {
    console.warn('[selectDisplayComparables] all comps failed the hard gates', {
      total: all.length,
      predictedPrice,
    })
    return []
  }

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

  // 4. how many checked-failed comps we may admit: none when the live pool
  //    already fills the report; otherwise up to MAX_DEAD_LINK_COMPS high
  //    scorers to back-fill the shortfall (covers "no link survived" too).
  const deadBudget = poolForScoring.length >= limit ? 0 : MAX_DEAD_LINK_COMPS

  const deadAllowance =
    deadBudget === 0
      ? []
      : [...failedCheck]
          .filter(c => score(c) >= DEAD_LINK_SCORE_FLOOR)
          .sort((a, b) => score(b) - score(a))
          .slice(0, deadBudget)

  // 5. assemble
  const assembled = [...poolForScoring, ...deadAllowance]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)

  if (assembled.length === 0) {
    console.warn('[selectDisplayComparables] no comp survived link/score selection', {
      gated: gated.length,
      live: live.length,
      failedCheck: failedCheck.length,
    })
    return []
  }

  return assembled
}
