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
 *      checked-failed comps; on any live shortfall (including zero live) the
 *      table is back-filled toward `limit` from every checked-failed comp that
 *      still passes every hard gate, ordered so a probable bot-block
 *      (blocked / transient) comes before a redirect, before "page gone"
 *      (dead), and by relevance score within each of those groups. Back-filled
 *      rows are never labelled — a thin-market report simply shows fewer rows.
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { gateListings, passesHardGates } from '@/lib/utils/comp-gates'
import { weightedRelevanceScore, type ScoreSubject } from '@/lib/utils/comp-relevance-score'

export type RankSubject = ScoreSubject

interface StoredValuation {
  predictedPrice?: number
  recentComparables?: { listings?: MarketCheckComparable[] }
}

/**
 * Back-fill ordering key for a checked-failed comp. Lower sorts first.
 * `blocked` / `transient` (0) are the failures most likely to be a live page
 * behind a bot-wall; `redirected` (1) might still be the right car; `dead` (2)
 * is the genuine "page gone" and is the last-resort fill, never excluded. A
 * pre-Task-4 report can have `url_validated === false` with no
 * `url_check_result` — that missing case sorts with the redirects (1).
 */
export function linkFailurePreference(reason: MarketCheckComparable['url_check_result']): number {
  switch (reason) {
    case 'blocked':
    case 'transient':
      return 0
    case 'dead':
      return 2
    case 'redirected':
    default:
      return 1
  }
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

  // 4. back-fill: when the live pool can't fill the table, add the best-ranked
  //    comps whose link check FAILED but that still pass every hard gate,
  //    preferring failures that are likely bot-blocks over "page gone".
  let assembled: MarketCheckComparable[]
  if (poolForScoring.length >= limit) {
    assembled = [...poolForScoring].sort((a, b) => score(b) - score(a)).slice(0, limit)
  } else {
    const need = limit - poolForScoring.length
    const backfill = failedCheck
      .filter(c => passesHardGates(c, predictedPrice))
      .sort((a, b) => {
        const pa = linkFailurePreference(a.url_check_result)
        const pb = linkFailurePreference(b.url_check_result)
        if (pa !== pb) return pa - pb
        return score(b) - score(a)
      })
      .slice(0, need)
    assembled = [...poolForScoring, ...backfill].sort((a, b) => score(b) - score(a)).slice(0, limit)
  }

  if (assembled.length === 0) {
    console.warn('[selectDisplayComparables] no comp survived link/score selection', {
      gated: gated.length,
      live: live.length,
      failedCheck: failedCheck.length,
    })
    return []
  }

  // 5. observability: when the table was back-filled, record the live / failed
  //    split so a thin-market report is visible in the logs (spec A3).
  if (assembled.length > poolForScoring.length) {
    const bf = assembled.filter(c => c.url_validated !== true)
    console.info('[selectDisplayComparables] backfilled', {
      shown: assembled.length,
      live: assembled.length - bf.length,
      backfilled: {
        blocked: bf.filter(c => c.url_check_result === 'blocked').length,
        transient: bf.filter(c => c.url_check_result === 'transient').length,
        redirected: bf.filter(c => c.url_check_result === 'redirected').length,
        dead: bf.filter(c => c.url_check_result === 'dead').length,
      },
    })
  }

  return assembled
}
