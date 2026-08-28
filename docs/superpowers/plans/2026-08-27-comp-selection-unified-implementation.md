# Comp Selection — Unified Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make comp selection a single link-aware, weighted-score path shared by the web
report, print page, and PDF — built on the unmerged `comp-selection-refinements` branch — and
ship it as one PR.

**Architecture:** One pure scoring function (`weightedRelevanceScore`) and one selector
(`selectDisplayComparables`) replace the branch's lexicographic tier ranking and its
`getBestMatchListings` / `withinValuationBand`. The selector runs: hard gates → link split
(live / checked-failed / never-checked) → two-tier pool (franchise+independent primary;
nationwide fallback only on a <10 shortfall) → weighted score → assemble top 10, allowing at
most 2 checked-failed comps that score ≥ 90. The same score orders URL validation at report
creation, and the same gates run before URL validation so disqualified comps are never
HTTP-checked. No new MarketCheck calls, no DB migration.

**Tech Stack:** Next.js App Router (TypeScript), Jest (`@jest-environment node` for lib
tests), `@react-pdf/renderer`, the `zipcodes` package (already on the branch), Supabase.

**Spec:** `../totallosstoolkit-workspace/docs/plans/2026-08-27-comp-selection-unified-release.md`
(read it alongside this plan).

## Global Constraints

- **Base branch:** `comp-selection-refinements` (head `32d4933`), which already carries PR #137.
  Work happens in a dedicated git worktree — see Task 0. Never branch off plain `main`.
- **No new MarketCheck API calls.** Every change works from data the app already fetches. The
  existing conditional supplement calls (dealer-type, nationwide) are unchanged.
- **No database migration.** `source_tier` rides inside the existing `marketcheck_valuation`
  JSONB; retrieval date and URLs are already stored.
- **Every tunable is a named constant in one place.** Weights `{mileage:0.35, distance:0.25,
  price:0.15, trim:0.10, freshness:0.10, year:0.05}`; thresholds `PRICE_GATE_FRACTION=0.40`,
  `DISTANCE_DENOMINATOR_MILES=500`, `FRESHNESS_FRESH_DAYS=45`, `FRESHNESS_STALE_DAYS=180`,
  `YEAR_SPAN=3`; `DEAD_LINK_SCORE_FLOOR=90`, `MAX_DEAD_LINK_COMPS=2`. All flagged "first
  guess, not a measured optimum".
- **TDD throughout.** Every behaviour gets a failing test first. Match the existing test style:
  `@jest-environment node`, a local `makeListing()` helper, `mockFetch` where fetch is used
  (see `__tests__/lib/utils/comparables-cleaner.test.ts` and `.../url-validator.test.ts` on
  the branch).
- **Regression gate:** `npx jest` must show **zero net-new failures** over the documented
  baseline (53 failed / 763 passed — CLAUDE.md). `npx tsc --noEmit -p tsconfig.json` and
  `npx eslint <touched files>` clean on every task.
- **Claude never merges.** The final deliverable is one open PR.

---

## File structure

**New:**

| File | Responsibility |
|---|---|
| `lib/utils/comp-relevance-score.ts` | Pure `weightedRelevanceScore(comp, subject, predictedPrice)`, the `tokenTrimMatch` helper, `makeScoreSortFn`, and all weight/threshold constants. No I/O. |
| `lib/utils/comp-gates.ts` | `passesHardGates(comp, subject, predictedPrice)` and `gateListings(listings, subject, predictedPrice)`. No I/O. |
| `__tests__/lib/utils/comp-relevance-score.test.ts` | Unit tests for the score + `tokenTrimMatch`. |
| `__tests__/lib/utils/comp-gates.test.ts` | Unit tests for the gates. |
| `__tests__/lib/utils/comp-selection.test.ts` | Unit tests for `selectDisplayComparables`. |

**Modified:**

| File | Change |
|---|---|
| `lib/api/marketcheck-client.ts` | Add `source_tier?` to `MarketCheckComparable`; tag primary listings `source_tier: dealerType`, fallback-search listings `'fallback_search'`. |
| `lib/utils/comparables-ranker.ts` | `rankByBestMatch` body → sort by `weightedRelevanceScore`; `RankSubject` += `model?`, `trim?`; rewrite `selectDisplayComparables` to the full algorithm; delete `getBestMatchListings` and `withinValuationBand`. |
| `lib/utils/url-validator.ts` | Annotate `url_validated: true \| false \| undefined` — `undefined` for comps never checked. |
| `app/api/reports/[id]/fetch-marketcheck/route.ts` | Gate listings before `validateListingUrls`; pass the weighted-score `sortFn`. |
| `app/api/lemonsqueezy/webhook/route.ts` | Same. |
| `app/api/admin/reports/create-free/route.ts` | Same. |
| `app/reports/[id]/view/page.tsx` | Pass `model`/`trim` to the selector; ensure `marketcheck_predicted_price` in the Supabase select; render retrieval date. |
| `app/reports/[id]/print/page.tsx` | Pass `model`/`trim`; render retrieval date + per-comp links. |
| `lib/pdf/report-template.tsx` | Pass `model`/`trim`; render retrieval date + per-comp `<Link>`. |
| `docs/comp-selection-process-2026-08-26.md` | Rewrite to match; commit it. |
| `__tests__/lib/utils/comparables-ranker.test.ts` | Retune from tier assertions to score assertions; drop removed-function cases. |
| `__tests__/lib/utils/url-validator.test.ts` | Add the tri-state cases + score-ordered check order. |

---

## Task 0: Worktree + branch

**Files:** none (git only).

- [ ] **Step 1: Create an isolated worktree off the base branch**

The website repo's main working tree is on another branch with untracked files that block a
plain checkout. Use a worktree instead.

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
git fetch origin
git worktree add ../vcs-comp-unified comp-selection-refinements
cd ../vcs-comp-unified
git switch -c comp-selection-unified
```

- [ ] **Step 2: Confirm the base**

```bash
git log --oneline -1          # expect: 32d4933 Web view, print page, and PDF now render the identical comp set
npm ci
npx jest --silent 2>&1 | tail -5   # record the baseline pass/fail counts; expect ~53 failed / ~763 passed
```

- [ ] **Step 3: Copy the spec in for executors**

```bash
mkdir -p docs/plans
cp "../totallosstoolkit-workspace/docs/plans/2026-08-27-comp-selection-unified-release.md" docs/plans/
cp "../totallosstoolkit-workspace/docs/plans/2026-08-27-comp-selection-unified-implementation.md" docs/superpowers/plans/
git add docs/plans/2026-08-27-comp-selection-unified-release.md docs/superpowers/plans/2026-08-27-comp-selection-unified-implementation.md
git commit -m "docs: spec + implementation plan for the unified comp-selection release"
```

All remaining tasks run from `../vcs-comp-unified`.

---

## Task 1: `source_tier` on every stored comp

**Files:**
- Modify: `lib/api/marketcheck-client.ts`
- Test: `__tests__/lib/api/marketcheck-client.test.ts`

**Interfaces:**
- Produces: `MarketCheckComparable.source_tier?: 'franchise' | 'independent' | 'fallback_search'`.
  Primary VIN-lookup listings carry the `dealerType` the call was made with; nationwide
  fallback-search listings carry `'fallback_search'`. Consumed by Task 4's two-tier pool.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/api/marketcheck-client.test.ts`:

```ts
describe('source_tier tagging', () => {
  it('tags primary-endpoint listings with the dealer type the call used', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        marketcheck_price: 15000,
        recent_comparables: {
          num_found: 1,
          listings: [
            { id: 'a', vin: 'AAAAAAAAAAAAAAAAA', year: 2020, make: 'Toyota', model: 'Highlander', miles: 50000, price: 15000, dealer_name: 'D', dealer_type: 'independent' },
          ],
        },
      }),
    })
    const res = await fetchMarketCheckData('AAAAAAAAAAAAAAAAA', 50000, '89503', false, undefined, { year: 2020, make: 'Toyota', model: 'Highlander' }, 'independent')
    expect(res.success).toBe(true)
    expect(res.data!.recentComparables!.listings[0].source_tier).toBe('independent')
  })

  it('tags nationwide fallback-search listings as fallback_search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          { id: 'f', vin: 'FFFFFFFFFFFFFFFFF', miles: 60000, price: 14000, seller_type: 'franchise', build: { year: 2020, make: 'Toyota', model: 'Highlander' }, dealer_address: { zip: '95814' }, vdp_url: 'https://d.com/i/1', first_seen_at_date: '2025-01-01' },
        ],
      }),
    })
    const res = await fetchMarketCheckSearchFallback('key', 2020, 'Toyota', 'Highlander', 'VIN0', 60000, '89503')
    expect(res.success).toBe(true)
    expect(res.data!.recentComparables!.listings[0].source_tier).toBe('fallback_search')
  })
})
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx jest __tests__/lib/api/marketcheck-client.test.ts -t "source_tier"`
Expected: FAIL — `source_tier` is `undefined`.

- [ ] **Step 3: Add the type field**

In `lib/api/marketcheck-client.ts`, in `interface MarketCheckComparable`, next to
`url_validated?: boolean`:

```ts
  /** Which acquisition path produced this listing. Set once at fetch/map time,
   * before merge into recentComparables.listings. Absent on reports created
   * before 2026-08-27 → treated as primary by the selector. */
  source_tier?: 'franchise' | 'independent' | 'fallback_search'
```

- [ ] **Step 4: Tag primary listings**

In `fetchMarketCheckData`, inside the `.map((listing: any) => ({ ... }))` that builds each
comparable for `recentComparables.listings`, add as the last property:

```ts
                    source_tier: dealerType,
```

(`dealerType` is the function's 7th parameter, `'franchise' | 'independent'`, default
`'franchise'`.)

- [ ] **Step 5: Tag fallback-search listings**

In `fetchMarketCheckSearchFallback`, inside its `.map((l: any) => ({ ... }))`, next to
`source: 'marketcheck',` add:

```ts
        source_tier: 'fallback_search' as const,
```

- [ ] **Step 6: Run the tests, confirm they pass; type-check; lint**

Run: `npx jest __tests__/lib/api/marketcheck-client.test.ts`
Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint lib/api/marketcheck-client.ts`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/api/marketcheck-client.ts __tests__/lib/api/marketcheck-client.test.ts
git commit -m "Tag every stored comp with its source_tier (franchise/independent/fallback_search)"
```

---

## Task 2: `weightedRelevanceScore` + constants + `tokenTrimMatch` + `makeScoreSortFn`

**Files:**
- Create: `lib/utils/comp-relevance-score.ts`
- Test: `__tests__/lib/utils/comp-relevance-score.test.ts`

**Interfaces:**
- Consumes: `computeDistanceMiles` from `lib/utils/geo-distance.ts` (already on branch);
  `MarketCheckComparable` from `lib/api/marketcheck-client.ts`.
- Produces:
  - `interface ScoreSubject { year: number; mileage: number; zip: string | null; model?: string; trim?: string }`
  - `tokenTrimMatch(subjectTrim?: string, compTrim?: string): 'exact' | 'partial' | 'none' | 'unknown'`
  - `weightedRelevanceScore(comp: MarketCheckComparable, subject: ScoreSubject, predictedPrice?: number): number` — 0–100
  - `makeScoreSortFn(subject: ScoreSubject, predictedPrice?: number): (listings: MarketCheckComparable[]) => MarketCheckComparable[]` — returns a new array sorted by score desc (for `validateListingUrls`'s `sortFn`)
  - `DEAD_LINK_SCORE_FLOOR = 90`, `MAX_DEAD_LINK_COMPS = 2`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/utils/comp-relevance-score.test.ts`:

```ts
/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import {
  weightedRelevanceScore,
  tokenTrimMatch,
  makeScoreSortFn,
  DEAD_LINK_SCORE_FLOOR,
  type ScoreSubject,
} from '@/lib/utils/comp-relevance-score'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return { year: 2020, make: 'Toyota', model: 'Highlander', miles: 100000, price: 20000, source: 'marketcheck', ...o }
}
// Reno, NV
const subject: ScoreSubject = { year: 2020, mileage: 100000, zip: '89503', model: 'Highlander', trim: 'XLE' }

describe('tokenTrimMatch', () => {
  it('exact when normalised strings are equal', () => {
    expect(tokenTrimMatch('XLE', 'xle')).toBe('exact')
  })
  it('partial when they share a token', () => {
    expect(tokenTrimMatch('FWD 4dr V6 SE (Natl)', 'SE')).toBe('partial')
  })
  it('none when no token overlaps', () => {
    expect(tokenTrimMatch('Limited', 'Base')).toBe('none')
  })
  it('unknown when either side is missing', () => {
    expect(tokenTrimMatch(undefined, 'SE')).toBe('unknown')
    expect(tokenTrimMatch('SE', '')).toBe('unknown')
  })
})

describe('weightedRelevanceScore', () => {
  it('scores a near-identical, nearby, fresh, same-price, same-trim comp >= 90', () => {
    const comp = makeListing({
      miles: 101000, price: 20000, year: 2020, trim: 'XLE',
      dos_active: 10, location: { zip: '89502' }, // ~2mi from 89503
    })
    expect(weightedRelevanceScore(comp, subject, 20000)).toBeGreaterThanOrEqual(90)
  })

  it('a comp thats only close on mileage stays well below 90', () => {
    const comp = makeListing({
      miles: 100000, price: 34000, year: 2018, trim: 'Base',
      dos_active: 200, location: { zip: '33101' }, // Miami
    })
    expect(weightedRelevanceScore(comp, subject, 20000)).toBeLessThan(90)
  })

  it('mileage closeness drives ordering when all else is equal', () => {
    const near = makeListing({ miles: 100000, location: { zip: '89503' } })
    const far = makeListing({ miles: 160000, location: { zip: '89503' } })
    expect(weightedRelevanceScore(near, subject, 20000)).toBeGreaterThan(
      weightedRelevanceScore(far, subject, 20000)
    )
  })

  it('distance null (no zip, no lat/long) yields 0.15 for that factor, not a throw', () => {
    const noLoc = makeListing()
    expect(() => weightedRelevanceScore(noLoc, subject, 20000)).not.toThrow()
    const withLoc = makeListing({ location: { zip: '89503' } })
    expect(weightedRelevanceScore(withLoc, subject, 20000)).toBeGreaterThan(
      weightedRelevanceScore(noLoc, subject, 20000)
    )
  })

  it('missing subject.mileage makes the mileage factor neutral for all comps (no divide-by-zero)', () => {
    const s2: ScoreSubject = { ...subject, mileage: 0 }
    const a = weightedRelevanceScore(makeListing({ miles: 50000, location: { zip: '89503' } }), s2, 20000)
    const b = weightedRelevanceScore(makeListing({ miles: 250000, location: { zip: '89503' } }), s2, 20000)
    expect(Number.isFinite(a)).toBe(true)
    expect(a).toBeCloseTo(b, 5)
  })

  it('missing predictedPrice makes the price factor neutral', () => {
    const a = weightedRelevanceScore(makeListing({ price: 5000, location: { zip: '89503' } }), subject, undefined)
    const b = weightedRelevanceScore(makeListing({ price: 90000, location: { zip: '89503' } }), subject, undefined)
    expect(a).toBeCloseTo(b, 5)
  })

  it('stays within 0..100 for extreme inputs', () => {
    const wild = makeListing({ miles: 9_000_000, price: 9_999_999, year: 1900 })
    const s = weightedRelevanceScore(wild, subject, 20000)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(100)
  })
})

describe('makeScoreSortFn', () => {
  it('sorts by score descending and does not mutate the input', () => {
    const input = [
      makeListing({ vin: 'FAR', miles: 180000, location: { zip: '33101' } }),
      makeListing({ vin: 'NEAR', miles: 100000, location: { zip: '89503' } }),
    ]
    const sorted = makeScoreSortFn(subject, 20000)(input)
    expect(sorted.map(l => l.vin)).toEqual(['NEAR', 'FAR'])
    expect(input[0].vin).toBe('FAR') // unchanged
  })
})

describe('constants', () => {
  it('DEAD_LINK_SCORE_FLOOR is 90', () => {
    expect(DEAD_LINK_SCORE_FLOOR).toBe(90)
  })
})
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx jest __tests__/lib/utils/comp-relevance-score.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/utils/comp-relevance-score.ts`:

```ts
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

const PRICE_GATE_FRACTION = 0.4 // also the gate in comp-gates.ts — keep in sync
const DISTANCE_DENOMINATOR_MILES = 500
const DISTANCE_UNKNOWN_SUBSCORE = 0.15
const FRESHNESS_FRESH_DAYS = 45
const FRESHNESS_STALE_DAYS = 180
const YEAR_SPAN = 3
const NEUTRAL = 0.5

export const DEAD_LINK_SCORE_FLOOR = 90
export const MAX_DEAD_LINK_COMPS = 2

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)

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
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx jest __tests__/lib/utils/comp-relevance-score.test.ts`
Expected: PASS. If the `>= 90` test fails, do **not** loosen the assertion — adjust the test
comp to be closer on the weakest factor, or note a real weight problem for review.

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint lib/utils/comp-relevance-score.ts __tests__/lib/utils/comp-relevance-score.test.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/utils/comp-relevance-score.ts __tests__/lib/utils/comp-relevance-score.test.ts
git commit -m "Add weightedRelevanceScore: one 0-100 signal for comp ranking"
```

---

## Task 3: Hard gates

**Files:**
- Create: `lib/utils/comp-gates.ts`
- Test: `__tests__/lib/utils/comp-gates.test.ts`

**Interfaces:**
- Consumes: `MarketCheckComparable`.
- Produces:
  - `interface GateSubject { model?: string }`
  - `passesHardGates(comp: MarketCheckComparable, subject: GateSubject, predictedPrice?: number): boolean`
  - `gateListings(listings: MarketCheckComparable[], subject: GateSubject, predictedPrice?: number): MarketCheckComparable[]`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/utils/comp-gates.test.ts`:

```ts
/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { passesHardGates, gateListings } from '@/lib/utils/comp-gates'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return { year: 2020, make: 'Toyota', model: 'Highlander', miles: 100000, price: 20000, source: 'marketcheck', ...o }
}
const subject = { model: 'Highlander' }

describe('passesHardGates', () => {
  it('passes a clean comp', () => {
    expect(passesHardGates(makeListing(), subject, 20000)).toBe(true)
  })
  it('drops a different model', () => {
    expect(passesHardGates(makeListing({ model: 'Camry' }), subject, 20000)).toBe(false)
  })
  it('is case-insensitive on model', () => {
    expect(passesHardGates(makeListing({ model: 'HIGHLANDER' }), subject, 20000)).toBe(true)
  })
  it('keeps a comp when subject.model is unknown', () => {
    expect(passesHardGates(makeListing({ model: 'Camry' }), {}, 20000)).toBe(true)
  })
  it('drops zero / missing price', () => {
    expect(passesHardGates(makeListing({ price: 0 }), subject, 20000)).toBe(false)
    expect(passesHardGates(makeListing({ price: undefined as unknown as number }), subject, 20000)).toBe(false)
  })
  it('drops missing mileage', () => {
    expect(passesHardGates(makeListing({ miles: undefined as unknown as number }), subject, 20000)).toBe(false)
  })
  it('drops a price more than 40% from the predicted price', () => {
    expect(passesHardGates(makeListing({ price: 29000 }), subject, 20000)).toBe(false) // +45%
    expect(passesHardGates(makeListing({ price: 27000 }), subject, 20000)).toBe(true)  // +35%
  })
  it('skips the price band when predictedPrice is absent', () => {
    expect(passesHardGates(makeListing({ price: 99000 }), subject, undefined)).toBe(true)
  })
})

describe('gateListings', () => {
  it('returns only the passing comps, order preserved', () => {
    const listings = [
      makeListing({ vin: 'OK1' }),
      makeListing({ vin: 'BADMODEL', model: 'Camry' }),
      makeListing({ vin: 'OK2' }),
      makeListing({ vin: 'BADPRICE', price: 100000 }),
    ]
    expect(gateListings(listings, subject, 20000).map(l => l.vin)).toEqual(['OK1', 'OK2'])
  })
})
```

- [ ] **Step 2: Run, confirm fail** — Run: `npx jest __tests__/lib/utils/comp-gates.test.ts` → module not found.

- [ ] **Step 3: Implement**

Create `lib/utils/comp-gates.ts`:

```ts
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
```

- [ ] **Step 4: Run, confirm pass** — `npx jest __tests__/lib/utils/comp-gates.test.ts`

- [ ] **Step 5: Type-check + lint** — `npx tsc --noEmit -p tsconfig.json`; `npx eslint lib/utils/comp-gates.ts __tests__/lib/utils/comp-gates.test.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/utils/comp-gates.ts __tests__/lib/utils/comp-gates.test.ts
git commit -m "Add hard gates (model / price / mileage / +-40% band) for comps"
```

---

## Task 4: Rewrite `comparables-ranker.ts` — `selectDisplayComparables` + score-based `rankByBestMatch`

**Files:**
- Modify: `lib/utils/comparables-ranker.ts` (full rewrite of the file)
- Create: `__tests__/lib/utils/comp-selection.test.ts`
- Modify: `__tests__/lib/utils/comparables-ranker.test.ts` (retune existing)

**Interfaces:**
- Consumes: `weightedRelevanceScore`, `ScoreSubject`, `DEAD_LINK_SCORE_FLOOR`,
  `MAX_DEAD_LINK_COMPS` (Task 2); `gateListings` (Task 3); `MarketCheckComparable`.
- Produces:
  - `interface RankSubject extends ScoreSubject {}` (i.e. `year, mileage, zip, model?, trim?`)
  - `rankByBestMatch(listings, subject: RankSubject, predictedPrice?): MarketCheckComparable[]`
    — score desc, non-mutating (kept for `url-validator` compatibility, though callers now
    prefer `makeScoreSortFn`).
  - `selectDisplayComparables(valuation, subject: { year; mileage; zip; model?; trim? }, limit = 10): MarketCheckComparable[]`
  - `getBestMatchListings` and `withinValuationBand` are **removed**.

- [ ] **Step 1: Confirm no external callers of the functions being removed**

Run: `git grep -n "getBestMatchListings\|withinValuationBand" -- 'lib' 'app' | grep -v comparables-ranker.ts | grep -v '.test.'`
Expected: no output. (The render sites already use `selectDisplayComparables`.) If anything
prints, add it to this task's file list and switch it to `selectDisplayComparables`.

- [ ] **Step 2: Write the failing tests for `selectDisplayComparables`**

Create `__tests__/lib/utils/comp-selection.test.ts`:

```ts
/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { selectDisplayComparables } from '@/lib/utils/comparables-ranker'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020, make: 'Toyota', model: 'Highlander', miles: 100000, price: 20000,
    source: 'marketcheck', url_validated: true, source_tier: 'franchise',
    location: { zip: '89503' }, dos_active: 20,
    ...o,
  }
}
function valuation(listings: MarketCheckComparable[], predictedPrice = 20000) {
  return { predictedPrice, recentComparables: { num_found: listings.length, listings } }
}
const subject = { year: 2020, mileage: 100000, zip: '89503', model: 'Highlander', trim: 'XLE' }

describe('selectDisplayComparables', () => {
  it('returns [] for empty / missing valuation', () => {
    expect(selectDisplayComparables(null, subject)).toEqual([])
    expect(selectDisplayComparables(valuation([]), subject)).toEqual([])
  })

  it('drops model-mismatch, zero/negative price, missing mileage, and >40%-off comps', () => {
    const listings = [
      makeListing({ vin: 'OK' }),
      makeListing({ vin: 'MODEL', model: 'Camry' }),
      makeListing({ vin: 'PRICE0', price: 0 }),
      makeListing({ vin: 'NOMILES', miles: undefined as unknown as number }),
      makeListing({ vin: 'FARPRICE', price: 35000 }),
    ]
    const out = selectDisplayComparables(valuation(listings), subject).map(l => l.vin)
    expect(out).toEqual(['OK'])
  })

  it('returns only url_validated === true comps in the normal case', () => {
    const listings = [
      makeListing({ vin: 'LIVE', url_validated: true }),
      makeListing({ vin: 'DEAD', url_validated: false, miles: 100000 }),
    ]
    expect(selectDisplayComparables(valuation(listings), subject).map(l => l.vin)).toEqual(['LIVE'])
  })

  it('ignores never-checked (undefined) comps entirely', () => {
    const listings = [
      makeListing({ vin: 'LIVE', url_validated: true }),
      makeListing({ vin: 'UNCHECKED', url_validated: undefined, miles: 100500 }),
    ]
    expect(selectDisplayComparables(valuation(listings), subject).map(l => l.vin)).toEqual(['LIVE'])
  })

  it('falls back to the gated set when NO comp carries a url_validated field', () => {
    const listings = [
      makeListing({ vin: 'A', url_validated: undefined, miles: 100000 }),
      makeListing({ vin: 'B', url_validated: undefined, miles: 140000 }),
    ].map(l => { delete (l as Record<string, unknown>).url_validated; return l })
    const out = selectDisplayComparables(valuation(listings), subject).map(l => l.vin)
    expect(out).toEqual(['A', 'B']) // score desc
  })

  it('uses fallback_search comps only when fewer than `limit` primary live comps exist', () => {
    const primary = Array.from({ length: 5 }, (_, i) =>
      makeListing({ vin: `P${i}`, source_tier: 'franchise', miles: 100000 + i * 100 })
    )
    const fallback = Array.from({ length: 8 }, (_, i) =>
      makeListing({ vin: `F${i}`, source_tier: 'fallback_search', miles: 100000 + i * 50 })
    )
    const out = selectDisplayComparables(valuation([...primary, ...fallback]), subject, 10).map(l => l.vin)
    expect(out.length).toBe(10)
    expect(out.some(v => v.startsWith('F'))).toBe(true)

    const primary12 = Array.from({ length: 12 }, (_, i) =>
      makeListing({ vin: `P${i}`, source_tier: 'franchise', miles: 100000 + i * 100 })
    )
    const out2 = selectDisplayComparables(valuation([...primary12, ...fallback]), subject, 10).map(l => l.vin)
    expect(out2.every(v => v.startsWith('P'))).toBe(true)
  })

  it('treats missing source_tier as primary', () => {
    const listings = Array.from({ length: 11 }, (_, i) => {
      const l = makeListing({ vin: `P${i}`, miles: 100000 + i * 100 })
      delete (l as Record<string, unknown>).source_tier
      return l
    })
    const fallback = makeListing({ vin: 'F', source_tier: 'fallback_search', miles: 100000 })
    const out = selectDisplayComparables(valuation([...listings, fallback]), subject, 10).map(l => l.vin)
    expect(out.includes('F')).toBe(false)
  })

  it('admits at most MAX_DEAD_LINK_COMPS failed-check comps that score >= 90, unlabelled', () => {
    // 8 live comps, deliberately mediocre so they score < a near-perfect comp
    const live = Array.from({ length: 8 }, (_, i) =>
      makeListing({ vin: `L${i}`, url_validated: true, miles: 130000, price: 24000, dos_active: 150, trim: 'Base', location: { zip: '90001' } })
    )
    const perfect = (vin: string) =>
      makeListing({ vin, url_validated: false, miles: 100000, price: 20000, year: 2020, trim: 'XLE', dos_active: 5, location: { zip: '89502' } })
    const failedHigh = [perfect('D1'), perfect('D2'), perfect('D3')]
    const out = selectDisplayComparables(valuation([...live, ...failedHigh]), subject, 10)
    const deadShown = out.filter(l => l.url_validated === false).map(l => l.vin)
    expect(deadShown.length).toBe(2) // cap
    expect(out.length).toBe(10)
  })

  it('does NOT admit a failed-check comp scoring below the floor', () => {
    const live = Array.from({ length: 3 }, (_, i) => makeListing({ vin: `L${i}`, url_validated: true }))
    const failedMediocre = makeListing({ vin: 'D', url_validated: false, miles: 100000, price: 26000, year: 2018, trim: 'Base', dos_active: 170, location: { zip: '33101' } })
    const out = selectDisplayComparables(valuation([...live, failedMediocre]), subject, 10).map(l => l.vin)
    expect(out.includes('D')).toBe(false)
  })

  it('a live comp scoring 91 outranks a failed-check comp scoring 90', () => {
    const liveBest = makeListing({ vin: 'LIVEBEST', url_validated: true, miles: 100000, price: 20000, trim: 'XLE', dos_active: 5, location: { zip: '89503' } })
    const deadHigh = makeListing({ vin: 'DEADHIGH', url_validated: false, miles: 100000, price: 20000, trim: 'XLE', dos_active: 5, location: { zip: '89504' } })
    const out = selectDisplayComparables(valuation([deadHigh, liveBest]), subject, 1).map(l => l.vin)
    expect(out).toEqual(['LIVEBEST'])
  })

  it('all links failed, one comp >= 90 -> returns that one, not []', () => {
    const failed = [
      makeListing({ vin: 'HI', url_validated: false, miles: 100000, price: 20000, trim: 'XLE', dos_active: 5, location: { zip: '89502' } }),
      makeListing({ vin: 'LO', url_validated: false, miles: 100000, price: 26000, year: 2018, trim: 'Base', dos_active: 170, location: { zip: '33101' } }),
    ]
    expect(selectDisplayComparables(valuation(failed), subject, 10).map(l => l.vin)).toEqual(['HI'])
  })

  it('all links failed, none >= 90 -> returns []', () => {
    const failed = Array.from({ length: 5 }, (_, i) =>
      makeListing({ vin: `X${i}`, url_validated: false, miles: 150000, price: 26000, year: 2018, trim: 'Base', dos_active: 170, location: { zip: '33101' } })
    )
    expect(selectDisplayComparables(valuation(failed), subject, 10)).toEqual([])
  })

  it('returns fewer than `limit` rather than padding with junk', () => {
    const listings = [
      makeListing({ vin: 'A', url_validated: true }),
      makeListing({ vin: 'B', url_validated: true, miles: 105000 }),
      makeListing({ vin: 'BAD', url_validated: true, model: 'Camry' }),
    ]
    expect(selectDisplayComparables(valuation(listings), subject, 10).map(l => l.vin).sort()).toEqual(['A', 'B'])
  })

  it('orders the result by weightedRelevanceScore descending', () => {
    const listings = [
      makeListing({ vin: 'FAR', miles: 180000, location: { zip: '33101' } }),
      makeListing({ vin: 'NEAR', miles: 100000, location: { zip: '89503' } }),
      makeListing({ vin: 'MID', miles: 130000, location: { zip: '95814' } }),
    ]
    expect(selectDisplayComparables(valuation(listings), subject, 3).map(l => l.vin)).toEqual(['NEAR', 'MID', 'FAR'])
  })
})
```

- [ ] **Step 3: Retune the existing ranker test file**

Open `__tests__/lib/utils/comparables-ranker.test.ts`. Delete every test asserting the old
tier order (year → same-state/bordering → mileage), the `withinValuationBand` block, and any
`getBestMatchListings` block. Replace with score-based assertions on `rankByBestMatch`:

```ts
/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { rankByBestMatch, type RankSubject } from '@/lib/utils/comparables-ranker'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return { year: 2020, make: 'Toyota', model: 'Highlander', miles: 100000, price: 20000, source: 'marketcheck', ...o }
}
const subject: RankSubject = { year: 2020, mileage: 100000, zip: '89503', model: 'Highlander', trim: 'XLE' }

describe('rankByBestMatch', () => {
  it('orders by weighted relevance score, closest overall match first', () => {
    const listings = [
      makeListing({ vin: 'FAR', miles: 175000, location: { zip: '33101' }, dos_active: 200 }),
      makeListing({ vin: 'NEAR', miles: 101000, location: { zip: '89502' }, dos_active: 10, trim: 'XLE' }),
    ]
    expect(rankByBestMatch(listings, subject, 20000)[0].vin).toBe('NEAR')
  })

  it('does not mutate the input array', () => {
    const input = [makeListing({ vin: 'A', miles: 175000 }), makeListing({ vin: 'B', miles: 100000 })]
    const snapshot = input.map(l => l.vin)
    rankByBestMatch(input, subject, 20000)
    expect(input.map(l => l.vin)).toEqual(snapshot)
  })
})
```

- [ ] **Step 4: Run both test files, confirm they fail**

Run: `npx jest __tests__/lib/utils/comp-selection.test.ts __tests__/lib/utils/comparables-ranker.test.ts`
Expected: FAIL — `selectDisplayComparables` still uses the old logic / `getBestMatchListings`
still referenced.

- [ ] **Step 5: Rewrite `lib/utils/comparables-ranker.ts`**

Replace the whole file with:

```ts
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
 *      comps that score >= DEAD_LINK_SCORE_FLOOR.
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
  const score = (c: MarketCheckComparable) => weightedRelevanceScore(c, scoreSubject, predictedPrice)

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

  // 4. assemble
  const deadAllowance = [...failedCheck]
    .sort((a, b) => score(b) - score(a))
    .filter(c => score(c) >= DEAD_LINK_SCORE_FLOOR)
    .slice(0, MAX_DEAD_LINK_COMPS)

  return [...poolForScoring, ...deadAllowance]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
}
```

- [ ] **Step 6: Run the tests, confirm they pass**

Run: `npx jest __tests__/lib/utils/comp-selection.test.ts __tests__/lib/utils/comparables-ranker.test.ts __tests__/lib/utils/comp-relevance-score.test.ts __tests__/lib/utils/comp-gates.test.ts`
Expected: PASS. Fix logic (not tests) on any red.

- [ ] **Step 7: Type-check + lint + full suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint lib/utils/comparables-ranker.ts __tests__/lib/utils/comp-selection.test.ts __tests__/lib/utils/comparables-ranker.test.ts`
Run: `npx jest --silent 2>&1 | tail -5`
Expected: tsc/eslint clean; jest shows **no new failures** vs the Task 0 baseline (the three
render-site call signatures still compile — `selectDisplayComparables` accepts the extra
optional `model`/`trim`, so old call sites that pass only `{year,mileage,zip}` still type-check).

- [ ] **Step 8: Commit**

```bash
git add lib/utils/comparables-ranker.ts __tests__/lib/utils/comp-selection.test.ts __tests__/lib/utils/comparables-ranker.test.ts
git commit -m "Rewrite comp selection: gates -> live-link -> two-tier pool -> weighted score"
```

---

## Task 5: `url-validator` — tri-state `url_validated`

**Files:**
- Modify: `lib/utils/url-validator.ts`
- Modify: `__tests__/lib/utils/url-validator.test.ts`

**Interfaces:**
- Produces: after `validateListingUrls`, each listing's `url_validated` is `true` (checked,
  passed), `false` (checked, failed), or `undefined` (never checked — below the early-stop
  point). Listings with no `vdp_url` remain `true` (valid data, just no link) — unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/utils/url-validator.test.ts` (match the file's existing `mockFetch` /
`makeListing` setup):

```ts
describe('url_validated tri-state', () => {
  it('leaves comps below the early-stop point as undefined, not false', async () => {
    // 25 listings; first 10 pass on the first batch of 20 -> listings 21..25 never checked
    const listings = Array.from({ length: 25 }, (_, i) =>
      makeListing({ vin: `V${i}`.padEnd(17, '0'), vdp_url: `https://dealer.com/inventory/${i}` })
    )
    mockFetch.mockImplementation(async (url: string) => ({
      status: 200,
      url,
    }))
    const { prediction } = await validateListingUrls({
      predictedPrice: 0, confidence: 'low', dataSource: 'marketcheck',
      requestParams: { vin: 'V', miles: 0, zip: '00000', dealer_type: 'both' },
      totalComparablesFound: 25,
      recentComparables: { num_found: 25, listings },
      generatedAt: new Date().toISOString(),
    })
    const out = prediction.recentComparables!.listings
    expect(out.slice(0, 10).every(l => l.url_validated === true)).toBe(true)
    expect(out.slice(20).every(l => l.url_validated === undefined)).toBe(true)
  })

  it('marks a checked-and-failed listing false', async () => {
    mockFetch.mockResolvedValue({ status: 404, url: 'https://dealer.com/inventory/x' })
    const { prediction } = await validateListingUrls({
      predictedPrice: 0, confidence: 'low', dataSource: 'marketcheck',
      requestParams: { vin: 'V', miles: 0, zip: '00000', dealer_type: 'both' },
      totalComparablesFound: 1,
      recentComparables: { num_found: 1, listings: [makeListing({ vdp_url: 'https://dealer.com/inventory/x' })] },
      generatedAt: new Date().toISOString(),
    })
    expect(prediction.recentComparables!.listings[0].url_validated).toBe(false)
  })

  it('keeps no-vdp_url listings valid', async () => {
    const { prediction } = await validateListingUrls({
      predictedPrice: 0, confidence: 'low', dataSource: 'marketcheck',
      requestParams: { vin: 'V', miles: 0, zip: '00000', dealer_type: 'both' },
      totalComparablesFound: 1,
      recentComparables: { num_found: 1, listings: [makeListing({ vdp_url: undefined })] },
      generatedAt: new Date().toISOString(),
    })
    expect(prediction.recentComparables!.listings[0].url_validated).toBe(true)
  })
})
```

- [ ] **Step 2: Run, confirm the first two fail** — Run: `npx jest __tests__/lib/utils/url-validator.test.ts -t "tri-state"` — today every unchecked/failed listing becomes `false`.

- [ ] **Step 3: Implement**

In `lib/utils/url-validator.ts`, `validateListingUrls`:

1. Add a `checkedSet` alongside `validListingSet`:

```ts
  const validListingSet = new Set<MarketCheckComparable>()
  const checkedSet = new Set<MarketCheckComparable>()
```

2. In the batch result loop, after resolving each result, record that the listing was checked
   **only when a URL was actually fetched**:

```ts
      if (result.status === 'fulfilled') {
        const { listing, valid, url } = result.value
        if (url !== null) {
          checkedSet.add(listing)
          stats.checkedCount++
          if (valid) stats.validatedUrls.push(url)
          else { stats.failedCount++; stats.failedUrls.push(url) }
        }
        if (valid) validListingSet.add(listing)
      }
```

3. Change the final annotation from a boolean to the tri-state:

```ts
  const validatedListings = allListings.map(listing => {
    if (validListingSet.has(listing)) return { ...listing, url_validated: true }
    if (checkedSet.has(listing)) return { ...listing, url_validated: false }
    if (!listing.vdp_url) return { ...listing, url_validated: true } // no link to check — data still valid
    const { url_validated: _drop, ...rest } = listing as MarketCheckComparable & { url_validated?: boolean }
    void _drop
    return rest as MarketCheckComparable // never checked -> leave undefined
  })
```

(The no-`vdp_url` branch must come after the `checkedSet` branch; the "auto-valid, don't count
as a URL check" path already skips `checkedSet`, so those listings fall through to here.)

- [ ] **Step 4: Run the url-validator tests, confirm all pass** — Run: `npx jest __tests__/lib/utils/url-validator.test.ts`

- [ ] **Step 5: Type-check + lint** — `npx tsc --noEmit -p tsconfig.json`; `npx eslint lib/utils/url-validator.ts __tests__/lib/utils/url-validator.test.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/utils/url-validator.ts __tests__/lib/utils/url-validator.test.ts
git commit -m "url-validator: leave never-checked comps url_validated undefined, not false"
```

---

## Task 6: `fetch-marketcheck` route — gate before validation, score-ordered check

**Files:**
- Modify: `app/api/reports/[id]/fetch-marketcheck/route.ts`

**Interfaces:**
- Consumes: `gateListings` (Task 3), `makeScoreSortFn` (Task 2).

- [ ] **Step 1: Read the current shape**

Run: `grep -n "validateListingUrls\|rankByBestMatch\|recentComparables\|subjectVehicle\|predictedPrice" app/api/reports/[id]/fetch-marketcheck/route.ts`
Identify the `validateListingUrls(...)` call and the object whose `recentComparables.listings`
it validates.

- [ ] **Step 2: Add imports**

```ts
import { gateListings } from '@/lib/utils/comp-gates'
import { makeScoreSortFn } from '@/lib/utils/comp-relevance-score'
```

Remove the `rankByBestMatch` import if it becomes unused.

- [ ] **Step 3: Gate the listings, then pass the score sortFn**

Immediately before the `validateListingUrls` call, replace the prediction's listings with the
gated set, and build the sort function from the same subject + predicted price:

```ts
const scoreSubject = {
  year: subjectVehicle.year,
  mileage,
  zip: zip_code,
  model: subjectVehicle.model,
  trim: subjectVehicle.trim,
}
const predictedPrice = marketcheckResult.data!.predictedPrice

const predictionForValidation = {
  ...marketcheckResult.data!,
  recentComparables: {
    ...marketcheckResult.data!.recentComparables!,
    listings: gateListings(
      marketcheckResult.data!.recentComparables?.listings ?? [],
      { model: subjectVehicle.model },
      predictedPrice
    ),
  },
}

const { prediction: validatedPrediction, stats: urlStats } = await validateListingUrls(
  predictionForValidation,
  { sortFn: makeScoreSortFn(scoreSubject, predictedPrice) }
)
```

Adjust the surrounding variable names to whatever the file already uses (it already destructures
`prediction` and `stats` from this call — keep those names). If the file previously passed
`{ sortFn: l => rankByBestMatch(l, {...}) }`, that whole option object is replaced by the
`makeScoreSortFn` form above.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint "app/api/reports/[id]/fetch-marketcheck/route.ts"`

- [ ] **Step 5: Regression run**

Run: `npx jest --silent 2>&1 | tail -5`
Expected: no new failures vs baseline.

- [ ] **Step 6: Commit**

```bash
git add "app/api/reports/[id]/fetch-marketcheck/route.ts"
git commit -m "fetch-marketcheck: gate comps before URL validation, order checks by score"
```

---

## Task 7: LemonSqueezy webhook — same change (revenue path)

**Files:**
- Modify: `app/api/lemonsqueezy/webhook/route.ts`

- [ ] **Step 1: Locate the `validateListingUrls` call**

Run: `grep -n "validateListingUrls\|rankByBestMatch\|supplementComparables\|supplementWithAlternateDealerType\|predictedPrice\|subjectVehicle" app/api/lemonsqueezy/webhook/route.ts`

- [ ] **Step 2: Add the same imports**

```ts
import { gateListings } from '@/lib/utils/comp-gates'
import { makeScoreSortFn } from '@/lib/utils/comp-relevance-score'
```

- [ ] **Step 3: Apply the identical gate-then-sort pattern from Task 6, Step 3**

Use the subject fields the webhook already has in scope (it decodes the VIN / reads
`subjectVehicle` and `marketcheckData.predictedPrice` — match those names). Gate
`recentComparables.listings` with `{ model: subjectVehicle.model }` and `predictedPrice`
before `validateListingUrls`; pass `{ sortFn: makeScoreSortFn(scoreSubject, predictedPrice) }`.

The webhook runs this inside its `after(...)` block — do not change the control flow, only the
listings passed in and the `sortFn`.

- [ ] **Step 4: Type-check + lint** — `npx tsc --noEmit -p tsconfig.json`; `npx eslint app/api/lemonsqueezy/webhook/route.ts`

- [ ] **Step 5: Regression run** — `npx jest --silent 2>&1 | tail -5` — no new failures.

- [ ] **Step 6: Commit**

```bash
git add app/api/lemonsqueezy/webhook/route.ts
git commit -m "webhook: gate comps before URL validation, order checks by score"
```

---

## Task 8: `create-free` admin route — same change

**Files:**
- Modify: `app/api/admin/reports/create-free/route.ts`

- [ ] **Step 1: Locate the `validateListingUrls` call** — `grep -n "validateListingUrls\|rankByBestMatch\|predictedPrice\|marketcheckValuation\|subjectVehicle" app/api/admin/reports/create-free/route.ts`

- [ ] **Step 2: Add imports** — same two as Task 7.

- [ ] **Step 3: Apply the gate-then-sort pattern from Task 6, Step 3**, using this route's
  subject variables and predicted price.

- [ ] **Step 4: Type-check + lint** — `npx tsc --noEmit -p tsconfig.json`; `npx eslint app/api/admin/reports/create-free/route.ts`

- [ ] **Step 5: Regression run** — no new failures.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/reports/create-free/route.ts
git commit -m "create-free: gate comps before URL validation, order checks by score"
```

---

## Task 9: Web view — pass model/trim, surface retrieval date

**Files:**
- Modify: `app/reports/[id]/view/page.tsx`

- [ ] **Step 1: Confirm the Supabase select includes the predicted price**

Search the file for where `report` is fetched (`.select(`). Ensure `marketcheck_predicted_price`
is in the column list (the branch already reads `report.marketcheck_valuation`, which contains
`predictedPrice`, so `selectDisplayComparables` gets it from there — but the branch's
`rankSubject` also passed `predictedPrice: report.marketcheck_predicted_price`; keep that
column selected if it's referenced). If `select('*')` is used, nothing to do.

- [ ] **Step 2: Pass `model` and `trim` into the selector**

Find the `selectDisplayComparables(marketCheck, { ... })` call. Change its subject object to:

```ts
  const displayedComparables = selectDisplayComparables(marketCheck, {
    year: Number(report.vehicle_data?.year),
    mileage: report.mileage ?? 0,
    zip: report.zip_code ?? null,
    model: report.vehicle_data?.model ?? report.vehicle_model ?? undefined,
    trim: report.vehicle_data?.trim ?? undefined,
  })
```

- [ ] **Step 3: Render the retrieval date**

Near the comps table heading (search for the "Based on {allListings.length}" copy), add, using
the existing Eastern-time formatter already imported in the file (from PR #135 —
`formatDateET` or similar; match the file's existing import):

```tsx
{marketCheck?.generatedAt && (
  <p className="text-sm text-gray-500">
    Comparable listings retrieved {formatDateET(marketCheck.generatedAt, { month: 'long', day: 'numeric', year: 'numeric' })}
  </p>
)}
```

- [ ] **Step 4: Confirm per-comp links already render**

The web view already renders `comp.vdp_url` as a link. Verify in the `displayedComparables.map(...)`
block; if a comp row shows the dealer/name without linking `vdp_url`, wrap it in an anchor
(`target="_blank" rel="noopener noreferrer"`). No behavioural change if it's already there.

- [ ] **Step 5: Type-check + lint + build**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint "app/reports/[id]/view/page.tsx"`
Run: `npx next build` is heavy — skip; rely on tsc. If the repo has a lighter
`npm run type-check`, use it.

- [ ] **Step 6: Commit**

```bash
git add "app/reports/[id]/view/page.tsx"
git commit -m "view: pass model/trim to selector, show comp retrieval date"
```

---

## Task 10: Print page — pass model/trim, retrieval date, per-comp links

**Files:**
- Modify: `app/reports/[id]/print/page.tsx`

- [ ] **Step 1: Pass `model` and `trim`**

Find `selectDisplayComparables(marketCheck, { ... })`. The print page reads the subject year
from `autodevData?.vehicle?.year`; use the matching source for model/trim:

```ts
  const displayedComparables = selectDisplayComparables(marketCheck, {
    year: Number(autodevData?.vehicle?.year),
    mileage: report.mileage ?? 0,
    zip: report.zip_code ?? null,
    model: autodevData?.vehicle?.model ?? report.vehicle_model ?? undefined,
    trim: autodevData?.vehicle?.trim ?? undefined,
  })
```

- [ ] **Step 2: Render the retrieval date** — same snippet as Task 9 Step 3, placed near the
  print page's "Comparable Vehicles (N shown)" heading, using the file's date formatter.

- [ ] **Step 3: Render per-comp links**

In the `displayedComparables.map(...)` row output, if `comp.vdp_url` is present, render the
vehicle description as a link:

```tsx
{comp.vdp_url ? (
  <a href={comp.vdp_url} target="_blank" rel="noopener noreferrer">
    {comp.year} {comp.make} {comp.model}
  </a>
) : (
  <>{comp.year} {comp.make} {comp.model}</>
)}
```

Match the surrounding JSX/table structure — this is a print stylesheet page, keep it plain.

- [ ] **Step 4: Type-check + lint** — `npx tsc --noEmit -p tsconfig.json`; `npx eslint "app/reports/[id]/print/page.tsx"`

- [ ] **Step 5: Commit**

```bash
git add "app/reports/[id]/print/page.tsx"
git commit -m "print: pass model/trim to selector, show retrieval date + comp links"
```

---

## Task 11: PDF template — pass model/trim, retrieval date, per-comp `<Link>`

**Files:**
- Modify: `lib/pdf/report-template.tsx`

**Interfaces:**
- Consumes: `@react-pdf/renderer`'s `Link` component.

- [ ] **Step 1: Pass `model` and `trim`**

Find `selectDisplayComparables(data.marketcheckValuation, { ... })`. The PDF reads the subject
year from `data.autodevVinData?.vehicle?.year`:

```ts
  const displayedComparables = selectDisplayComparables(data.marketcheckValuation, {
    year: Number(data.autodevVinData?.vehicle?.year),
    mileage: data.mileage ?? 0,
    zip: data.zipCode ?? null,
    model: data.autodevVinData?.vehicle?.model ?? data.autodevVinData?.model ?? undefined,
    trim: data.autodevVinData?.vehicle?.trim ?? undefined,
  })
```

If `autodevVinData` has no reliable trim key, pass `trim: undefined` — the score treats it as
neutral (documented assumption in the spec).

- [ ] **Step 2: Import `Link`**

At the top: `import { Link } from '@react-pdf/renderer'` (add to the existing import from that
package if one is present).

- [ ] **Step 3: Render the retrieval date**

Near the "Based on {allListings.length} live comparable listings" `<Text>`, add:

```tsx
{data.marketcheckValuation?.generatedAt && (
  <Text style={styles.metaNote}>
    Comparable listings retrieved {formatDateShort(data.marketcheckValuation.generatedAt)}
  </Text>
)}
```

Reuse the `formatDateShort` helper already defined in this file (it wraps `formatDateET`).
Add a `metaNote` style if none fits (`{ fontSize: 8, color: '#666', marginBottom: 4 }`).

- [ ] **Step 4: Render each comp's link**

In the `displayedComparables.map((comp, idx) => ...)` block, wrap the vehicle line in `<Link>`
when `comp.vdp_url` exists:

```tsx
{comp.vdp_url ? (
  <Link src={comp.vdp_url} style={styles.compLink}>
    {comp.year} {comp.make} {comp.model}
  </Link>
) : (
  <Text>{comp.year} {comp.make} {comp.model}</Text>
)}
```

Add a `compLink` style (`{ color: '#1a56db', textDecoration: 'none' }`) if there isn't a
suitable one.

- [ ] **Step 5: Type-check + lint** — `npx tsc --noEmit -p tsconfig.json`; `npx eslint lib/pdf/report-template.tsx`

- [ ] **Step 6: Smoke-render the PDF**

If the repo has a PDF render script or a route (`/api/reports/[id]/generate-pdf`), render one
locally against a known report id in dev and eyeball the comparable section. Otherwise defer
to Task 13's verification. Do not block the commit on this if no local path exists.

- [ ] **Step 7: Commit**

```bash
git add lib/pdf/report-template.tsx
git commit -m "pdf: pass model/trim to selector, show retrieval date + comp links"
```

---

## Task 12: Rewrite the process reference doc

**Files:**
- Modify (and this time **commit**): `docs/comp-selection-process-2026-08-26.md`

- [ ] **Step 1: Rewrite each stale section**

Read the doc top to bottom against the merged code from Tasks 1–11 and rewrite every part
that no longer matches:

- **Selection order:** replace whatever it says with: hard gates → live-link filter (with the
  no-validation-data fallback and the ≤2 comps ≥90 allowance) → two-tier pool (franchise +
  independent combined; nationwide fallback only when fewer than 10 live primary comps) →
  weighted relevance score → top 10.
- **The weighted score:** list the six factors and weights, the thresholds, and that all are
  first-guess constants in `lib/utils/comp-relevance-score.ts`.
- **URL validation:** note it runs at creation, after the hard gates, in score order, in
  batches of 20, stopping at 10 valid; `url_validated` is now tri-state.
- **"Recalculate it the same way" line:** correct it — all three render paths call
  `selectDisplayComparables`; there is no separate recalculation.
- **Variables-at-a-glance table:** distance is real (ZIP centroid or lat/long, never
  MarketCheck's field); add trim match and days-on-market rows; drop the same-state/bordering
  rows.
- Replace any remaining `User Question:` lines with a one-line "Resolved 2026-08-27 (this
  release)" note.

- [ ] **Step 2: Proofread against the actual code**

Re-open `comp-relevance-score.ts`, `comp-gates.ts`, `comparables-ranker.ts`,
`url-validator.ts` side by side with the doc and fix any mismatch.

- [ ] **Step 3: Commit** (this doc was previously kept uncommitted — that ends here, per the spec)

```bash
git add docs/comp-selection-process-2026-08-26.md
git commit -m "docs: rewrite comp-selection process doc to match the unified release"
```

---

## Task 13: Full regression gate, production verification, PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full test suite**

Run: `npx jest --silent 2>&1 | tail -8`
Expected: failure count **≤** the Task 0 baseline (53). New passing tests from Tasks 1–5
added; zero net-new failures. If any new failure exists, fix it before proceeding.

- [ ] **Step 2: Type-check + lint, whole touched set**

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint lib/utils/comp-relevance-score.ts lib/utils/comp-gates.ts lib/utils/comparables-ranker.ts lib/utils/url-validator.ts lib/api/marketcheck-client.ts lib/pdf/report-template.tsx "app/api/reports/[id]/fetch-marketcheck/route.ts" app/api/lemonsqueezy/webhook/route.ts app/api/admin/reports/create-free/route.ts "app/reports/[id]/view/page.tsx" "app/reports/[id]/print/page.tsx"
```

- [ ] **Step 3: Parity check — web view vs freshly generated PDF**

Pick ~10 recent paid report ids (from Supabase: `price_paid > 0` and a non-null
`marketcheck_valuation`, newest first). For each: load `/reports/<id>/view` in dev and
regenerate the PDF, and compare the comparable tables — same VINs, same order. Record
pass/fail per id. Any mismatch is a bug in this release, not an acceptable difference.

- [ ] **Step 4: KPI shift on real data**

Copy the analysis script into the worktree and point it at the new selector:

```bash
cp "../totallosstoolkit-workspace/docs/analysis/build-comp-selection-dataset.cjs" scripts/
# edit its selection reconstruction to import selectDisplayComparables from lib/utils/comparables-ranker,
# or add a --new flag; run it and capture the link-filtered ("floor") medians:
#   median |mileage diff %|, median est distance, % same-or-border state, median DOM, shown-count
node scripts/build-comp-selection-dataset.cjs
```

Record the before (current `main`) vs after (this branch) medians for the PR description. Do
**not** commit the script or its CSV output into this repo (`.gitignore` the CSVs if needed).

- [ ] **Step 5: Open the PR**

```bash
git push -u origin comp-selection-unified
gh pr create --base main --title "Unified comp selection: one link-aware, weighted-score path (web/print/PDF)" --body "$(cat <<'EOF'
## What

Brings the unmerged `comp-selection-refinements` line (incl. PR #137) to `main` and, on top of it:

- One selector (`selectDisplayComparables`) for web view, print page, and PDF — identical rows on all three.
- Replaces lexicographic tier ranking with a weighted 0–100 relevance score (mileage .35 / distance .25 / price .15 / trim .10 / days-on-market .10 / year .05 — all tunable constants).
- Live-link filter: only `url_validated === true` comps, except (a) reports with no validation data at all, (b) ≤2 comps that score ≥90 whose check failed (URL check has known false negatives).
- `source_tier` tag on every comp; two-tier pool — franchise+independent primary, nationwide fallback only on a <10 shortfall.
- Hard gates (model / price / mileage / ±40% band) run before URL validation, so disqualified comps are never HTTP-checked; `url_validated` is now tri-state (`true` / `false` / `undefined` = never checked).
- Retrieval date + per-comp links shown on all three paths.
- `docs/comp-selection-process-2026-08-26.md` rewritten and committed.

## Verification

- `npx jest`: <fill: X failed / Y passed> vs baseline 53 / 763 — zero net-new failures.
- Parity: <N>/10 recent paid reports — web view and regenerated PDF comp tables match.
- KPI shift (real data, link-filtered medians): mileage gap <before>→<after>, distance <before>→<after>, same-or-border state <before>→<after>, DOM <before>→<after>.

## Not in this release

Creation-pipeline distance math, live per-render link re-validation, persisting the frozen list, weight calibration, deeper MarketCheck pool.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Do not merge.** Hand the PR URL to Skip. He reviews the Vercel preview, checks
  web/PDF parity there, and merges.

---

## Self-review

**Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §Architecture — one selector, three callers | 4, 9, 10, 11 (call sites already unified on the branch) |
| §Architecture — creation-time source tagging | 1 |
| §Algorithm 1–6 (gates, link split, two-tier, score, assemble, ≥90 allowance) | 2, 3, 4 |
| §Creation-time pipeline (gate before validate, score sortFn, tri-state flag) | 5, 6, 7, 8 |
| §`withinValuationBand` / `getBestMatchListings` removed | 4 |
| §Report date + per-comp links | 9, 10, 11 |
| §Testing (TDD, specific cases) | every task; consolidated 13 |
| §Production verification | 13 |
| §Rollout (worktree, one PR, no merge) | 0, 13 |
| §Doc rewrite + commit | 12 |

No spec requirement is left without a task.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Route tasks 7–8 refer
to "the pattern from Task 6, Step 3" but restate the actual code shape and inputs; each still
lists its own imports, grep, and commit. Acceptable — the shared code is genuinely identical
and DRY forbids a third copy in the plan.

**Type consistency:**
- `ScoreSubject` (Task 2) = `{ year; mileage; zip; model?; trim? }`; `RankSubject` (Task 4)
  aliases it; `selectDisplayComparables`'s subject param is the same shape minus requiring
  `model`/`trim`. Consistent.
- `weightedRelevanceScore(comp, subject, predictedPrice?)` — same signature in Tasks 2, 4.
- `gateListings(listings, { model }, predictedPrice?)` / `passesHardGates` — same in Tasks 3,
  4, 6, 7, 8. Note the gate's subject only needs `model`; call sites pass `{ model: ... }`.
- `makeScoreSortFn(subject, predictedPrice?)` returns `(listings) => listings` — matches
  `validateListingUrls`'s existing `options.sortFn` type in Tasks 6–8.
- `url_validated: true | false | undefined` (Task 5) — consumed by Task 4's `anyHasFlag` /
  `live` / `failedCheck` split via `hasOwnProperty('url_validated')` and `=== true` / `=== false`.
  Consistent: Task 5 deletes the key on never-checked listings, so `hasOwnProperty` is the
  right probe.
- `source_tier` values `'franchise' | 'independent' | 'fallback_search'` (Task 1) — Task 4
  only branches on `!== 'fallback_search'`. Consistent; missing value → primary.

**One carried assumption (from the spec):** the PDF path may lack a reliable `trim`; Task 11
passes `undefined` and the score neutralises it. Flagged in the spec's Assumptions section.
