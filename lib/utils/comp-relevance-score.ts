/**
 * Weighted comp relevance score (0–100). The single ranking signal for both the
 * displayed comp set (selectDisplayComparables) and the URL-validation order at
 * report creation. Replaces the lexicographic year→distance→price→mileage tier
 * sort. See docs/plans/2026-08-27-comp-selection-unified-release.md §5.
 *
 * Every weight and threshold below is a FIRST GUESS, not a measured optimum —
 * tune here.
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { computeDistanceMiles } from '@/lib/utils/geo-distance'

export interface ScoreSubject {
  year: number
  mileage: number
  zip: string | null
  model?: string
  trim?: string
}

const WEIGHTS = {
  mileage: 0.35,
  distance: 0.25,
  price: 0.15,
  trim: 0.1,
  freshness: 0.1,
  year: 0.05,
} as const

export const PRICE_GATE_FRACTION = 0.4 // the shared price-band fraction; comp-gates.ts imports this
const DISTANCE_DENOMINATOR_MILES = 500
const DISTANCE_UNKNOWN_SUBSCORE = 0.15
const FRESHNESS_FRESH_DAYS = 45
const FRESHNESS_STALE_DAYS = 180
const YEAR_SPAN = 3
const NEUTRAL = 0.5

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Lower-case, strip punctuation, split on whitespace, drop empties. Used by
 * the trim matcher below. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

export function tokenTrimMatch(
  subjectTrim?: string,
  compTrim?: string
): 'exact' | 'partial' | 'none' | 'unknown' {
  if (!subjectTrim || !compTrim) return 'unknown'
  const a = norm(subjectTrim)
  const b = norm(compTrim)
  if (a.length === 0 || b.length === 0) return 'unknown'
  if (a.join(' ') === b.join(' ')) return 'exact'
  const aSet = new Set(a)
  return b.some(t => aSet.has(t)) ? 'partial' : 'none'
}

function mileageSub(comp: MarketCheckComparable, subject: ScoreSubject): number {
  if (!subject.mileage || subject.mileage <= 0 || comp.miles == null) return NEUTRAL
  return clamp01(1 - Math.abs(comp.miles - subject.mileage) / subject.mileage)
}

function distanceSub(comp: MarketCheckComparable, subject: ScoreSubject): number {
  if (!subject.zip) return NEUTRAL
  const d = computeDistanceMiles(subject.zip, comp)
  if (d == null) return DISTANCE_UNKNOWN_SUBSCORE
  return clamp01(1 - d / DISTANCE_DENOMINATOR_MILES)
}

function priceSub(comp: MarketCheckComparable, predictedPrice?: number): number {
  if (!predictedPrice || predictedPrice <= 0 || comp.price == null) return NEUTRAL
  const frac = Math.abs(comp.price - predictedPrice) / predictedPrice
  return clamp01(1 - frac / PRICE_GATE_FRACTION)
}

function trimSub(comp: MarketCheckComparable, subject: ScoreSubject): number {
  switch (tokenTrimMatch(subject.trim, comp.trim)) {
    case 'exact':
      return 1
    case 'partial':
      return 0.5
    case 'none':
      return 0.15
    default:
      return NEUTRAL
  }
}

function freshnessSub(comp: MarketCheckComparable): number {
  const dom = comp.dos_active ?? comp.dom
  if (dom == null) return NEUTRAL
  if (dom <= FRESHNESS_FRESH_DAYS) return 1
  if (dom >= FRESHNESS_STALE_DAYS) return 0
  return 1 - (dom - FRESHNESS_FRESH_DAYS) / (FRESHNESS_STALE_DAYS - FRESHNESS_FRESH_DAYS)
}

function yearSub(comp: MarketCheckComparable, subject: ScoreSubject): number {
  if (!subject.year || comp.year == null) return NEUTRAL
  return clamp01(1 - Math.abs(comp.year - subject.year) / YEAR_SPAN)
}

export function weightedRelevanceScore(
  comp: MarketCheckComparable,
  subject: ScoreSubject,
  predictedPrice?: number
): number {
  const total =
    WEIGHTS.mileage * mileageSub(comp, subject) +
    WEIGHTS.distance * distanceSub(comp, subject) +
    WEIGHTS.price * priceSub(comp, predictedPrice) +
    WEIGHTS.trim * trimSub(comp, subject) +
    WEIGHTS.freshness * freshnessSub(comp) +
    WEIGHTS.year * yearSub(comp, subject)
  return Math.round(clamp01(total) * 100 * 10) / 10
}

export function makeScoreSortFn(subject: ScoreSubject, predictedPrice?: number) {
  return (listings: MarketCheckComparable[]): MarketCheckComparable[] =>
    [...listings].sort(
      (a, b) =>
        weightedRelevanceScore(b, subject, predictedPrice) -
        weightedRelevanceScore(a, subject, predictedPrice)
    )
}
