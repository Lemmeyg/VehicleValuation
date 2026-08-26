# Comp Selection Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six specific changes Skip requested in his review of `docs/comp-selection-process-2026-08-26.md`: broaden the primary MarketCheck lookup to include independent dealers, localize the fallback-path price estimate, tighten the dealer/year cleanup limits, replace the crude same-state ranking tier with real distance tiers plus a new price-proximity tier, harden the dead-link check against false negatives, and update the reference doc to match.

**Architecture:** A new shared, offline distance-calculation utility (`lib/utils/geo-distance.ts`, built on the `zipcodes` package already added in PR #137) becomes the single source of real distance for two currently-separate places that need it: the fallback path's price synthesis, and the final comp ranking. Everything else is a targeted, independent change to one existing file.

**Tech Stack:** Next.js App Router API routes, TypeScript, Jest, the `zipcodes` npm package (offline ZIP-centroid distance, already installed on branch `fix/report-comps-within-radius`).

**Spec:** `docs/comp-selection-process-2026-08-26.md` (the six "User Question" annotations Skip added, resolved task-by-task below).

## Global Constraints

- **Base branch:** This plan assumes `zipcodes` and `@types/zipcodes` are already installed — they are, on `fix/report-comps-within-radius` (PR #137). Branch this work off that branch (or off `main` after #137 merges) — not off a plain `main` that predates #137. Confirm which before Task 3.
- **No new MarketCheck API calls.** Every change here works with data the app already fetches — none of these six requests need an extra network round-trip.
- **Every numeric threshold introduced (10% price band, 250/500/750mi tiers, 750mi "local" price radius) is a first guess, not a measured optimum** — flagged inline wherever it appears, so it's easy to find and tune later against real data.
- **TDD throughout:** every task writes the failing test before the implementation, per this codebase's existing convention (see `__tests__/lib/utils/comparables-cleaner.test.ts` for the established style to match).

---

## Task 1: Tighten the cleanup limits (dealer cap 3→2, year band −5/+2 → −3/+1)

**Files:**

- Modify: `lib/utils/comparables-cleaner.ts`
- Modify (update existing assertions to match): `__tests__/lib/utils/comparables-cleaner.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `cleanAndFilterComparables()` unchanged signature, new constant values only.

- [ ] **Step 1: Update the failing tests first**

Replace the `year range filter` and `dealer cap` describe blocks in `__tests__/lib/utils/comparables-cleaner.test.ts` with:

```ts
describe('year range filter', () => {
  it('drops listings newer than subjectYear + 1', () => {
    const listings = [
      makeListing({ year: 2022 }), // 2020 + 1 = 2021, so 2022 is out
      makeListing({ year: 2021 }), // exactly at ceiling — kept
      makeListing({ year: 2020 }),
    ]
    const result = cleanAndFilterComparables(listings, 2020)
    expect(result).toHaveLength(2)
    expect(result.map(l => l.year)).toEqual(expect.not.arrayContaining([2022]))
  })

  it('drops listings older than subjectYear - 3', () => {
    const listings = [
      makeListing({ year: 2016 }), // 2020 - 3 = 2017, so 2016 is out
      makeListing({ year: 2017 }), // exactly at floor — kept
      makeListing({ year: 2020 }),
    ]
    const result = cleanAndFilterComparables(listings, 2020)
    expect(result).toHaveLength(2)
    expect(result.map(l => l.year)).toEqual(expect.not.arrayContaining([2016]))
  })

  it('skips year filtering when subjectYear is not provided', () => {
    const listings = [
      makeListing({ year: 2026 }),
      makeListing({ year: 2010 }),
      makeListing({ year: 2020 }),
    ]
    const result = cleanAndFilterComparables(listings)
    expect(result).toHaveLength(3)
  })

  it('replicates the bug scenario: 2026 new cars dropped for 2020 subject', () => {
    const listings = Array.from({ length: 10 }, () =>
      makeListing({ year: 2026, miles: 0, price: 42000 })
    )
    const result = cleanAndFilterComparables(listings, 2020)
    expect(result).toHaveLength(0)
  })
})

describe('dealer cap', () => {
  it('allows at most 2 listings from the same dealer', () => {
    const listings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ dealer_name: 'Heritage Mazda Towson', price: 18000 + i * 100 })
    )
    const result = cleanAndFilterComparables(listings)
    expect(result).toHaveLength(2)
  })

  it('applies cap per dealer independently', () => {
    const dealerA = Array.from({ length: 4 }, () => makeListing({ dealer_name: 'Dealer A' }))
    const dealerB = Array.from({ length: 4 }, () => makeListing({ dealer_name: 'Dealer B' }))
    const result = cleanAndFilterComparables([...dealerA, ...dealerB])
    expect(result).toHaveLength(4) // 2 from A + 2 from B
  })

  it('keeps listings with no dealer info regardless of count', () => {
    const listings = Array.from({ length: 5 }, () =>
      makeListing({ dealer_name: undefined, dealer_id: undefined })
    )
    const result = cleanAndFilterComparables(listings)
    expect(result).toHaveLength(5)
  })

  it('caps listings identified only by dealer_id when dealer_name is absent', () => {
    const listings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ dealer_name: undefined, dealer_id: 42, price: 18000 + i * 100 })
    )
    const result = cleanAndFilterComparables(listings)
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail against the current constants**

Run: `npx jest __tests__/lib/utils/comparables-cleaner.test.ts`
Expected: FAIL — 4 failures (year-band and dealer-cap assertions now expect the new, tighter numbers).

- [ ] **Step 3: Update the constants**

In `lib/utils/comparables-cleaner.ts`, change:

```ts
export const MAX_DEALER_LISTINGS = 3
const MAX_YEAR_ABOVE_SUBJECT = 2
const MIN_YEAR_BELOW_SUBJECT = 5
```

to:

```ts
export const MAX_DEALER_LISTINGS = 2
const MAX_YEAR_ABOVE_SUBJECT = 1
const MIN_YEAR_BELOW_SUBJECT = 3
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest __tests__/lib/utils/comparables-cleaner.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/comparables-cleaner.ts __tests__/lib/utils/comparables-cleaner.test.ts
git commit -m "Tighten comp cleanup limits: dealer cap 3->2, year band -5/+2 -> -3/+1"
```

---

## Task 2: Include independent dealers in the primary (VIN-based) MarketCheck lookup

**Files:**

- Modify: `lib/api/marketcheck-client.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `MarketCheckPrediction.requestParams.dealer_type` type widens from `'franchise' | 'independent'` to `'franchise' | 'independent' | 'both'` — later tasks that construct a `requestParams` object must use a value from this widened type.

- [ ] **Step 1: Widen the type**

In `lib/api/marketcheck-client.ts`, find the `MarketCheckPrediction` interface's `requestParams` field:

```ts
requestParams: {
  vin: string
  miles: number
  zip: string
  dealer_type: 'franchise' | 'independent'
}
```

Change the last line to:

```ts
dealer_type: 'franchise' | 'independent' | 'both'
```

- [ ] **Step 2: Stop asking MarketCheck to filter by dealer type, and fix the two hardcoded values**

In `fetchMarketCheckData()`, find:

```ts
url.searchParams.append('zip', zipCode)
url.searchParams.append('dealer_type', 'franchise')
url.searchParams.append('is_certified', isCertified ? 'true' : 'false')
```

Delete the `dealer_type` line entirely:

```ts
url.searchParams.append('zip', zipCode)
url.searchParams.append('is_certified', isCertified ? 'true' : 'false')
```

Then find the two places later in the same function that hardcode `dealer_type: 'franchise'` — the debug `console.log` right after the request is built, and the `requestParams` field inside the constructed `MarketCheckPrediction` (look for the comment `// HARDCODED: franchise per user requirement`). Change both to `'both'` and delete the now-inaccurate comment:

```ts
        requestParams: {
          vin,
          miles,
          zip: zipCode,
          dealer_type: 'both',
        },
```

- [ ] **Step 3: Fix the matching log line in the route that calls this**

In `app/api/reports/[id]/fetch-marketcheck/route.ts`, find the `logApiCall` call after the MarketCheck request and change its `requestData`:

```ts
        requestData: { vin, mileage, zip_code, dealer_type: 'franchise' },
```

to:

```ts
        requestData: { vin, mileage, zip_code, dealer_type: 'both' },
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (the `MarketCheckComparable.dealer_type` field on individual listings is untouched — only the request-level field changed).

Run: `npx eslint lib/api/marketcheck-client.ts app/api/reports/[id]/fetch-marketcheck/route.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/api/marketcheck-client.ts "app/api/reports/[id]/fetch-marketcheck/route.ts"
git commit -m "Include independent dealers in the primary VIN-based MarketCheck lookup"
```

_Note for the person reviewing this task's result once deployed: this can only be confirmed by generating a real report where the VIN lookup succeeds and checking whether any `dealer_type: independent` listings appear — there's no way to verify it from a unit test, since it depends on what MarketCheck's live inventory actually returns._

---

## Task 3: Shared offline distance-calculation utility

**Files:**

- Create: `lib/utils/geo-distance.ts`
- Test: `__tests__/lib/utils/geo-distance.test.ts`

**Interfaces:**

- Consumes: `MarketCheckComparable` type from `lib/api/marketcheck-client.ts`.
- Produces:
  - `computeDistanceMiles(subjectZip: string, listing: MarketCheckComparable): number | null`
  - `DISTANCE_TIER_MILES: readonly [number, number, number]` (the `[250, 500, 750]` tier boundaries Task 4 and Task 5 both use — defined once, here, so the two tasks can't drift out of sync).

- [ ] **Step 1: Write the failing tests**

```ts
/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { computeDistanceMiles, DISTANCE_TIER_MILES } from '@/lib/utils/geo-distance'

function makeListing(overrides: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 50000,
    price: 18000,
    source: 'marketcheck',
    ...overrides,
  }
}

describe('computeDistanceMiles', () => {
  it('computes real distance from a listing ZIP (Reno, NV -> Sacramento, CA)', () => {
    const listing = makeListing({ location: { zip: '95814' } })
    const dist = computeDistanceMiles('89503', listing)
    expect(dist).not.toBeNull()
    expect(dist!).toBeGreaterThan(100)
    expect(dist!).toBeLessThan(125)
  })

  it('falls back to raw latitude/longitude when no ZIP is present', () => {
    // Sacramento, CA coordinates, no location.zip at all
    const listing = makeListing({ latitude: '38.5816', longitude: '-121.4944' })
    const dist = computeDistanceMiles('89503', listing)
    expect(dist).not.toBeNull()
    expect(dist!).toBeGreaterThan(100)
    expect(dist!).toBeLessThan(125)
  })

  it('returns null when the listing has neither a ZIP nor coordinates', () => {
    const listing = makeListing()
    expect(computeDistanceMiles('89503', listing)).toBeNull()
  })

  it('returns null when the listing ZIP is not a real US ZIP', () => {
    const listing = makeListing({ location: { zip: '00000' } })
    expect(computeDistanceMiles('89503', listing)).toBeNull()
  })
})

describe('DISTANCE_TIER_MILES', () => {
  it('is the agreed 250/500/750 tier boundaries', () => {
    expect(DISTANCE_TIER_MILES).toEqual([250, 500, 750])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/geo-distance.test.ts`
Expected: FAIL with "Cannot find module '@/lib/utils/geo-distance'".

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/utils/geo-distance.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (If `zipcodes` types aren't found, confirm `@types/zipcodes` is installed — see Global Constraints.)

- [ ] **Step 6: Commit**

```bash
git add lib/utils/geo-distance.ts __tests__/lib/utils/geo-distance.test.ts
git commit -m "Add shared offline distance-calculation utility (ZIP or raw lat/long)"
```

---

## Task 4: Localize the fallback-path price estimate

**Files:**

- Modify: `lib/api/marketcheck-client.ts` (`fetchMarketCheckSearchFallback`)
- Test: `__tests__/lib/api/marketcheck-client.test.ts`

**Interfaces:**

- Consumes: `computeDistanceMiles`, `DISTANCE_TIER_MILES` from `lib/utils/geo-distance.ts` (Task 3); `cleanAndFilterComparables` from `lib/utils/comparables-cleaner.ts`.
- Produces: no signature change to `fetchMarketCheckSearchFallback` — same params, same return shape. Behavior only.

Today, `fetchMarketCheckSearchFallback()`'s placeholder price is the mean of every raw listing it got back — nationwide, uncleaned, unfiltered. This task makes it clean the listings first (drop 0-mile/0-price junk, dedupe, apply the year band, cap per dealer — the same rules every other comp goes through) and then, when the subject ZIP is known, average only the listings within `DISTANCE_TIER_MILES[2]` (750 miles) of it — falling back to the full cleaned set if literally none are that close, so the number is never computed from zero data.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/api/marketcheck-client.test.ts`, inside (or near) the existing `fetchMarketCheckSearchFallback — API params` describe block:

```ts
describe('fetchMarketCheckSearchFallback — price synthesis', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('excludes far-away listings from the price average when nearby ones exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 2,
        listings: [
          {
            id: 'near',
            vin: 'NEARVIN000000001',
            price: 10000,
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Sacramento', state: 'CA', zip: '95814' }, // ~110mi from 89503
            vdp_url: 'https://dealer.com/inventory/near',
            first_seen_at_date: '2025-01-01',
          },
          {
            id: 'far',
            vin: 'FARVIN0000000001',
            price: 100000, // wildly different price — should NOT pull the average toward it
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Miami', state: 'FL', zip: '33101' }, // ~2500mi from 89503
            vdp_url: 'https://dealer.com/inventory/far',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '89503' // subject ZIP — Reno, NV
    )

    expect(result.success).toBe(true)
    expect(result.data!.predictedPrice).toBe(10000) // only the near listing counted
  })

  it('falls back to the full cleaned set when nothing is within 750mi', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        num_found: 1,
        listings: [
          {
            id: 'far',
            vin: 'FARVIN0000000002',
            price: 20000,
            miles: 50000,
            seller_type: 'franchise',
            build: { year: 2020, make: 'Honda', model: 'Civic' },
            dealer_address: { city: 'Miami', state: 'FL', zip: '33101' },
            vdp_url: 'https://dealer.com/inventory/far2',
            first_seen_at_date: '2025-01-01',
          },
        ],
      }),
    })

    const result = await fetchMarketCheckSearchFallback(
      'key',
      2020,
      'Honda',
      'Civic',
      'VIN0',
      50000,
      '89503'
    )

    expect(result.success).toBe(true)
    expect(result.data!.predictedPrice).toBe(20000) // no nearby listings — falls back to using it anyway
  })
})
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `npx jest __tests__/lib/api/marketcheck-client.test.ts -t "price synthesis"`
Expected: the first test FAILS (today's code averages both listings: `(10000 + 100000) / 2 = 55000`, not `10000`). The second test already passes by coincidence (only one listing exists either way) — that's fine, it's there to guard the fallback behavior going forward.

- [ ] **Step 3: Implement — clean, then localize, then average**

In `lib/api/marketcheck-client.ts`, add the imports near the top:

```ts
import { cleanAndFilterComparables } from '@/lib/utils/comparables-cleaner'
import { computeDistanceMiles, DISTANCE_TIER_MILES } from '@/lib/utils/geo-distance'
```

(`cleanAndFilterComparables` is likely already imported at the top of this file for the primary-endpoint path — check first and don't duplicate the import.)

Inside `fetchMarketCheckSearchFallback()`, find where `comparables` is built and sorted:

```ts
const comparables: MarketCheckComparable[] = listings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .map((l: any) => ({
    // ... existing mapping ...
  }))
  .sort((a, b) => b.price - a.price)

const prices = comparables.map(l => l.price).filter(p => p > 0)
const predictedPrice =
  prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
const sorted = [...prices].sort((a, b) => a - b)
const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? sorted[0] ?? 0
const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1] ?? 0
const confidence: 'low' | 'medium' | 'high' =
  comparables.length >= 20 ? 'high' : comparables.length >= 5 ? 'medium' : 'low'
```

Replace it with:

```ts
const comparables: MarketCheckComparable[] = listings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .map((l: any) => ({
    // ... existing mapping — unchanged ...
  }))
  .sort((a, b) => b.price - a.price)

// Clean before pricing off of anything — same rules every other comp
// goes through (0-mile/0-price junk, dupes, year band, dealer cap).
const cleaned = cleanAndFilterComparables(comparables, year)

// Prefer pricing off genuinely local comps when we know the subject ZIP
// — falls back to the full cleaned set if nothing is within the widest
// distance tier, so the price is never computed from zero data.
const localRadius = DISTANCE_TIER_MILES[DISTANCE_TIER_MILES.length - 1]
const nearby = zip
  ? cleaned.filter(l => {
      const dist = computeDistanceMiles(zip, l)
      return dist !== null && dist <= localRadius
    })
  : []
const pricingPool = nearby.length > 0 ? nearby : cleaned

const prices = pricingPool.map(l => l.price).filter(p => p > 0)
const predictedPrice =
  prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
const sorted = [...prices].sort((a, b) => a - b)
const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? sorted[0] ?? 0
const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1] ?? 0
const confidence: 'low' | 'medium' | 'high' =
  pricingPool.length >= 20 ? 'high' : pricingPool.length >= 5 ? 'medium' : 'low'
```

Leave the `recentComparables.listings` field set to `comparables` (the full, uncleaned set) as it is today — cleaning still happens later, by every existing caller, exactly as documented in Step 3 of `docs/comp-selection-process-2026-08-26.md`. This task only changes what feeds the _price number_, not which listings get returned.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/api/marketcheck-client.test.ts`
Expected: PASS — all tests in the file, including the two new ones and the 14 pre-existing ones.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint lib/api/marketcheck-client.ts`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add lib/api/marketcheck-client.ts __tests__/lib/api/marketcheck-client.test.ts
git commit -m "Localize the fallback-path price estimate to comps within 750mi"
```

---

## Task 5: Real distance tiers + price-proximity in the final ranking (replaces the same-state heuristic)

**Files:**

- Modify: `lib/utils/comparables-ranker.ts`
- Modify: `lib/utils/comparables-supplementer.ts` (thread `predictedPrice` through to its ranking sortFn)
- Modify: `app/api/reports/[id]/fetch-marketcheck/route.ts` (thread `predictedPrice` through to its ranking sortFn)
- Modify: `lib/pdf/report-template.tsx` (pass `predictedPrice` in `rankSubject`)
- Modify: `app/reports/[id]/view/page.tsx` (pass `predictedPrice` in `rankSubject`)
- Modify: `__tests__/lib/utils/comparables-ranker.test.ts`

**Interfaces:**

- Consumes: `computeDistanceMiles`, `DISTANCE_TIER_MILES` from `lib/utils/geo-distance.ts` (Task 3).
- Produces: `RankSubject` gains an optional `predictedPrice?: number` field. `rankByBestMatch()` and `getBestMatchListings()` keep their existing names and call shape — only `RankSubject`'s shape and the internal sort order change.

New ranking order, replacing today's year → same-state/bordering-state → mileage:

1. **Year closeness** (unchanged — still first).
2. **Distance tier** — real miles via `computeDistanceMiles`, bucketed at the shared `DISTANCE_TIER_MILES` boundaries (≤250mi, ≤500mi, ≤750mi, else worst tier). Replaces the same-state/bordering-state approximation entirely.
3. **Price proximity** — within 10% of the report's own predicted price ranks ahead of everything outside it. Skipped (treated as a tie) when `predictedPrice` isn't provided, so callers that don't pass it don't break.
4. **Mileage closeness** — moved from #3 to #4, same comparator as before.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `__tests__/lib/utils/comparables-ranker.test.ts` with:

```ts
/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import {
  rankByBestMatch,
  getBestMatchListings,
  type RankSubject,
} from '@/lib/utils/comparables-ranker'

function makeListing(overrides: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 100000,
    price: 15000,
    source: 'marketcheck',
    ...overrides,
  }
}

const subject: RankSubject = { year: 2020, mileage: 100000, zip: '89503' } // Reno, NV

describe('rankByBestMatch', () => {
  it('ranks closer model years first, above everything else', () => {
    const listings = [
      makeListing({ vin: 'A', year: 2015, location: { zip: '89503' } }), // same ZIP, far year
      makeListing({ vin: 'B', year: 2019, location: { zip: '33101' } }), // Miami, close year
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('B')
  })

  it('ranks real distance tiers ahead of the old same-state heuristic', () => {
    // Both listings are the same model year as the subject, so this
    // isolates the distance-tier factor. "same-state" (NV) is now
    // irrelevant — a same-state listing 400+ miles away must rank BEHIND
    // a different-state listing that's genuinely closer.
    const listings = [
      makeListing({ vin: 'FAR_SAME_STATE', location: { zip: '89101' } }), // Las Vegas, NV — ~440mi from Reno
      makeListing({ vin: 'NEAR_OTHER_STATE', location: { zip: '95814' } }), // Sacramento, CA — ~110mi from Reno
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('NEAR_OTHER_STATE')
  })

  it('within the same distance tier, prefers price within 10% of the subject valuation', () => {
    const subjectWithPrice: RankSubject = { ...subject, predictedPrice: 15000 }
    const listings = [
      makeListing({ vin: 'FAR_PRICE', price: 25000, location: { zip: '95814' } }), // +66%
      makeListing({ vin: 'CLOSE_PRICE', price: 15500, location: { zip: '95814' } }), // +3.3%
    ]
    const result = rankByBestMatch(listings, subjectWithPrice)
    expect(result[0].vin).toBe('CLOSE_PRICE')
  })

  it('skips the price tier entirely when predictedPrice is not provided', () => {
    const listings = [
      makeListing({ vin: 'A', price: 999999, miles: 150000, location: { zip: '95814' } }),
      makeListing({ vin: 'B', price: 1, miles: 100000, location: { zip: '95814' } }),
    ]
    // No predictedPrice on `subject` — falls through to mileage, so the
    // closer-mileage listing (B) wins despite its absurd price.
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('B')
  })

  it('falls back to mileage closeness as the final tiebreaker', () => {
    const listings = [
      makeListing({ vin: 'A', miles: 140000, location: { zip: '95814' } }),
      makeListing({ vin: 'B', miles: 105000, location: { zip: '95814' } }),
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('B')
  })

  it('treats a listing with no usable location as the worst distance tier, not a crash', () => {
    const listings = [
      makeListing({ vin: 'NO_LOCATION' }),
      makeListing({ vin: 'HAS_LOCATION', location: { zip: '95814' } }),
    ]
    const result = rankByBestMatch(listings, subject)
    expect(result[0].vin).toBe('HAS_LOCATION')
  })
})

describe('getBestMatchListings', () => {
  it('returns at most `limit` listings, best-ranked first', () => {
    const listings = Array.from({ length: 15 }, (_, i) =>
      makeListing({ vin: `V${i}`, miles: 100000 + i * 1000, location: { zip: '89503' } })
    )
    const result = getBestMatchListings(listings, subject, 10)
    expect(result).toHaveLength(10)
    expect(result[0].vin).toBe('V0') // exact mileage match
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/comparables-ranker.test.ts`
Expected: FAIL — the file won't even compile yet against the old `comparables-ranker.ts` (missing `predictedPrice` on `RankSubject`, old same-state logic gives the wrong winner in the distance-tier test).

- [ ] **Step 3: Rewrite `comparables-ranker.ts`**

Replace the entire file with:

```ts
/**
 * Ranks comparable vehicle listings against a subject vehicle by best match, in
 * priority order: model-year closeness, then real distance (computed offline,
 * never trusted from MarketCheck's own field — see lib/utils/geo-distance.ts),
 * then price proximity to the subject's own predicted valuation, then mileage
 * closeness. Used both to decide which order listings get their links checked
 * in (url-validator.ts) and to pick which validated listings a report displays.
 *
 * Replaces an earlier same-state/bordering-state approximation, which ranked
 * a listing 800 miles away in a large state as "close" while ranking one just
 * over a state line as "far" — the root cause of a real customer complaint
 * (see docs/comp-selection-process-2026-08-26.md).
 */

import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { computeDistanceMiles, DISTANCE_TIER_MILES } from '@/lib/utils/geo-distance'

export interface RankSubject {
  year: number
  mileage: number
  zip: string | null
  /** The report's own predicted price, if known. Optional — when absent,
   * the price-proximity tier is skipped (treated as a tie) so existing
   * callers that don't pass it keep working unchanged. */
  predictedPrice?: number
}

const PRICE_PROXIMITY_FRACTION = 0.1 // "within 10% of valuation" — a first guess, not a measured optimum

/**
 * 0 = within DISTANCE_TIER_MILES[0] (250mi today)
 * 1 = within DISTANCE_TIER_MILES[1] (500mi today)
 * 2 = within DISTANCE_TIER_MILES[2] (750mi today)
 * 3 = farther than that, or distance couldn't be determined at all
 */
function distanceTierFor(listing: MarketCheckComparable, subjectZip: string | null): 0 | 1 | 2 | 3 {
  if (!subjectZip) return 3
  const dist = computeDistanceMiles(subjectZip, listing)
  if (dist === null) return 3
  for (let i = 0; i < DISTANCE_TIER_MILES.length; i++) {
    if (dist <= DISTANCE_TIER_MILES[i]) return i as 0 | 1 | 2
  }
  return 3
}

/** 0 = within 10% of the subject's predicted price (or price unknown — neutral), 1 = outside it. */
function priceProximityTierFor(
  listing: MarketCheckComparable,
  predictedPrice: number | undefined
): 0 | 1 {
  if (predictedPrice === undefined || predictedPrice <= 0) return 0
  const diff = Math.abs(listing.price - predictedPrice) / predictedPrice
  return diff <= PRICE_PROXIMITY_FRACTION ? 0 : 1
}

/**
 * Sorts listings by best match to the subject vehicle. Does not mutate the
 * input array or limit the result — callers slice to however many they need.
 */
export function rankByBestMatch(
  listings: MarketCheckComparable[],
  subject: RankSubject
): MarketCheckComparable[] {
  return [...listings].sort((a, b) => {
    const yearDiffA = Math.abs(a.year - subject.year)
    const yearDiffB = Math.abs(b.year - subject.year)
    if (yearDiffA !== yearDiffB) return yearDiffA - yearDiffB

    const distTierA = distanceTierFor(a, subject.zip)
    const distTierB = distanceTierFor(b, subject.zip)
    if (distTierA !== distTierB) return distTierA - distTierB

    const priceTierA = priceProximityTierFor(a, subject.predictedPrice)
    const priceTierB = priceProximityTierFor(b, subject.predictedPrice)
    if (priceTierA !== priceTierB) return priceTierA - priceTierB

    const mileageDiffA = Math.abs(a.miles - subject.mileage)
    const mileageDiffB = Math.abs(b.miles - subject.mileage)
    return mileageDiffA - mileageDiffB
  })
}

/**
 * The best `limit` matching listings for the subject vehicle, ranked by
 * `rankByBestMatch`. Used at display time to pick which validated listings a
 * report shows.
 */
export function getBestMatchListings(
  listings: MarketCheckComparable[],
  subject: RankSubject,
  limit: number = 10
): MarketCheckComparable[] {
  return rankByBestMatch(listings, subject).slice(0, limit)
}
```

- [ ] **Step 4: Run the ranker tests to verify they pass**

Run: `npx jest __tests__/lib/utils/comparables-ranker.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Thread `predictedPrice` through every caller**

In `app/api/reports/[id]/fetch-marketcheck/route.ts`, find the `validateListingUrls` call that builds a `sortFn` from `rankByBestMatch` (search for `rankByBestMatch(l,`):

```ts
              sortFn: l =>
                rankByBestMatch(l, { year: subjectVehicle.year, mileage, zip: zip_code }),
```

Change to:

```ts
              sortFn: l =>
                rankByBestMatch(l, {
                  year: subjectVehicle.year,
                  mileage,
                  zip: zip_code,
                  predictedPrice: marketcheckResult.data!.predictedPrice,
                }),
```

In `lib/utils/comparables-supplementer.ts`, `supplementComparables()`'s signature and its internal `fetchAndValidatePage` calls both need the price threaded through. Add a `predictedPrice: number` parameter to `supplementComparables`:

```ts
export async function supplementComparables(
  prediction: MarketCheckPrediction,
  validCount: number,
  subjectVehicle: { year: number; make: string; model: string; trim?: string } | undefined,
  vin: string,
  mileage: number | null,
  zip: string | null,
  predictedPrice: number
): Promise<{ prediction: MarketCheckPrediction; supplemented: boolean }> {
```

and pass it into both `fetchAndValidatePage` calls inside the same function (the two `await fetchAndValidatePage(apiKey, searchVehicle, vin, mileage, zip, 0)` / `...50)` calls) by adding a matching parameter to `fetchAndValidatePage` itself and its own `rankByBestMatch(l, { year: subjectVehicle.year, mileage, zip })` sortFn call — same pattern as the route change above: add `predictedPrice: predictedPrice` to that object literal, and add `predictedPrice: number` to `fetchAndValidatePage`'s own parameter list, passed through from its caller.

Then update the one call site of `supplementComparables` in `app/api/reports/[id]/fetch-marketcheck/route.ts` to pass the new argument:

```ts
const supplementResult = await supplementComparables(
  validatedPrediction,
  urlStats.validatedUrls.length,
  subjectVehicle,
  vin,
  mileage,
  zip_code,
  marketcheckResult.data!.predictedPrice
)
```

In `lib/pdf/report-template.tsx`, find:

```ts
const rankSubject = {
  year: Number(data.autodevVinData?.vehicle?.year),
  mileage: data.mileage ?? 0,
  zip: data.zipCode ?? null,
}
```

Change to:

```ts
const rankSubject = {
  year: Number(data.autodevVinData?.vehicle?.year),
  mileage: data.mileage ?? 0,
  zip: data.zipCode ?? null,
  predictedPrice: data.marketcheckValuation?.predictedPrice,
}
```

In `app/reports/[id]/view/page.tsx`, find:

```ts
const rankSubject = {
  year: Number(report.vehicle_data?.year),
  mileage: report.mileage ?? 0,
  zip: report.zip_code ?? null,
}
```

Change to:

```ts
const rankSubject = {
  year: Number(report.vehicle_data?.year),
  mileage: report.mileage ?? 0,
  zip: report.zip_code ?? null,
  predictedPrice: report.marketcheck_predicted_price ?? undefined,
}
```

_(Before this last edit, confirm `report.marketcheck_predicted_price` is actually present on the `report` object at that point in the file — it's fetched via a Supabase query earlier in the same page; if that query doesn't already `select('_')`or explicitly include this column, add it to the select list. Search the file for where`report` is first fetched to check.)\*

- [ ] **Step 6: Type-check and lint everything touched**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean. Pay attention to `comparables-supplementer.ts` — the new required parameter on `fetchAndValidatePage` and `supplementComparables` must match at every call site or this will fail.

Run: `npx eslint lib/utils/comparables-ranker.ts lib/utils/comparables-supplementer.ts "app/api/reports/[id]/fetch-marketcheck/route.ts" lib/pdf/report-template.tsx "app/reports/[id]/view/page.tsx"`
Expected: clean.

- [ ] **Step 7: Run the full test suite once to check for knock-on breakage**

Run: `npx jest --silent`
Expected: same pass/fail counts as the documented pre-existing baseline (53 failed / 763 passed as of this plan's writing — see `CLAUDE.md`), plus whatever this task's own new tests added. No _new_ failures beyond that baseline.

- [ ] **Step 8: Commit**

```bash
git add lib/utils/comparables-ranker.ts lib/utils/comparables-supplementer.ts \
  "app/api/reports/[id]/fetch-marketcheck/route.ts" lib/pdf/report-template.tsx \
  "app/reports/[id]/view/page.tsx" __tests__/lib/utils/comparables-ranker.test.ts
git commit -m "Rank comps by real distance tiers + price proximity, not same-state heuristic"
```

---

## Task 6: Reduce false "dead link" results

**Files:**

- Modify: `lib/utils/url-validator.ts`
- Modify: `__tests__/lib/utils/url-validator.test.ts` (find the existing test file — search `__tests__/lib/utils/` if the exact name differs)

**Interfaces:**

- Consumes: nothing new.
- Produces: `checkUrl()` (internal) and `validateListingUrls()` keep their existing signatures — behavior-only change.

Two changes, both aimed at the specific failure mode Skip observed (a link he can open fine gets marked dead): some dealer sites block or mishandle `HEAD` requests specifically while serving `GET` normally, and the current 4-second timeout may be too short for slower or bot-protection-fronted pages.

- [ ] **Step 1: Write the failing tests**

Find the existing test file for `url-validator.ts` and add:

```ts
describe('checkUrl — GET retry on HEAD failure', () => {
  it('retries with GET when HEAD returns a non-200/405 status, and counts a passing GET as valid', async () => {
    const headResponse = { status: 403, url: 'https://dealer.com/inventory/123' }
    const getResponse = {
      status: 200,
      url: 'https://dealer.com/inventory/123',
    }
    mockFetch
      .mockResolvedValueOnce(headResponse) // HEAD fails
      .mockResolvedValueOnce(getResponse) // GET retry succeeds

    const result = await validateListingUrls({
      predictedPrice: 0,
      confidence: 'low',
      dataSource: 'marketcheck',
      requestParams: { vin: 'V', miles: 0, zip: '00000', dealer_type: 'both' },
      totalComparablesFound: 1,
      recentComparables: {
        num_found: 1,
        listings: [makeListing({ vdp_url: 'https://dealer.com/inventory/123' })],
      },
      generatedAt: new Date().toISOString(),
    })

    expect(result.prediction.recentComparables!.listings[0].url_validated).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[0][1]?.method).toBe('HEAD')
    expect(mockFetch.mock.calls[1][1]?.method).toBe('GET')
  })

  it('marks a listing invalid only when both HEAD and the GET retry fail', async () => {
    mockFetch
      .mockResolvedValueOnce({ status: 403, url: 'https://dealer.com/inventory/456' })
      .mockResolvedValueOnce({ status: 404, url: 'https://dealer.com/inventory/456' })

    const result = await validateListingUrls({
      predictedPrice: 0,
      confidence: 'low',
      dataSource: 'marketcheck',
      requestParams: { vin: 'V', miles: 0, zip: '00000', dealer_type: 'both' },
      totalComparablesFound: 1,
      recentComparables: {
        num_found: 1,
        listings: [makeListing({ vdp_url: 'https://dealer.com/inventory/456' })],
      },
      generatedAt: new Date().toISOString(),
    })

    expect(result.prediction.recentComparables!.listings[0].url_validated).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
```

Check the top of the existing test file for how `mockFetch` and a `makeListing()` helper are already set up, and match that exact pattern rather than redefining them — this codebase's existing `marketcheck-client.test.ts` and `comparables-cleaner.test.ts` both follow this convention.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/url-validator.test.ts -t "GET retry"`
Expected: FAIL — today's `checkUrl` never retries with GET at all.

- [ ] **Step 3: Implement the GET retry and the longer timeout**

In `lib/utils/url-validator.ts`, change:

```ts
const VALIDATION_TIMEOUT_MS = 4000
```

to:

```ts
const VALIDATION_TIMEOUT_MS = 8000
```

Then find `checkUrl()` and replace it with a version that tries HEAD first, and retries once with GET if HEAD didn't pass:

```ts
async function fetchOnce(url: string, method: 'HEAD' | 'GET'): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (response.status !== 200 && response.status !== 405) return false

    const parsedOriginal = new URL(url)
    const parsedFinal = new URL(response.url)
    if (parsedOriginal.hostname !== parsedFinal.hostname) return false

    const finalPath = parsedFinal.pathname
    if (finalPath === '/' || finalPath === '') return false
    const pathSegments = finalPath.split('/').filter(s => s.length > 0)
    if (pathSegments.length < 2) return false

    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Check a single URL. Tries a HEAD request first (cheap); if that doesn't
 * pass, retries once with GET before giving up — some dealer sites block or
 * mishandle HEAD specifically while serving GET normally, which was
 * confirmed to be producing false "dead link" results (a link that opens
 * fine in a real browser but fails this check) — see
 * docs/comp-selection-process-2026-08-26.md, Step 4.
 */
async function checkUrl(url: string): Promise<boolean> {
  if (await fetchOnce(url, 'HEAD')) return true
  return fetchOnce(url, 'GET')
}
```

- [ ] **Step 4: Run the url-validator tests to verify they pass**

Run: `npx jest __tests__/lib/utils/url-validator.test.ts`
Expected: PASS — the two new tests, and every pre-existing test in the file (the pre-existing ones exercise the HEAD-succeeds path, which is unchanged).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx eslint lib/utils/url-validator.ts`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/url-validator.ts __tests__/lib/utils/url-validator.test.ts
git commit -m "Retry with GET when HEAD fails, and lengthen the check timeout to 8s"
```

_Note: this reduces false negatives but can't eliminate them — a dealer site that blocks both HEAD and GET from an automated client would need a real browser (e.g. Playwright) to check reliably. That's a much heavier change (slower, and expensive to run per-listing in a serverless function) — flagged here as a possible future step, not part of this plan._

---

## Task 7: Update the reference doc to match

**Files:**

- Modify: `docs/comp-selection-process-2026-08-26.md`

- [ ] **Step 1: Rewrite each changed section**

For every step description that changed (dealer-type filter in Step 1, price synthesis in Step 2B, the dealer/year numbers in Step 3, the ranking order in Step 6, the link-check behavior in Step 4), update the prose to describe the new behavior instead of the old one, and delete each `User Question:` line now that it's been answered — replace it with a one-line note of what changed, e.g.:

> _Updated 2026-08-26: now includes independent dealers too (see PR #[N])._

Update the "variables at a glance" table (Distance from subject ZIP, Dealer type, Vehicle mileage rows especially) to reflect that distance is now real and ranks second, and price proximity is a new ranking factor.

- [ ] **Step 2: Proofread against the actual merged code**

Re-read each changed file (`comparables-cleaner.ts`, `marketcheck-client.ts`, `comparables-ranker.ts`, `url-validator.ts`) side-by-side with the doc's new wording, and correct any mismatch — the whole point of this doc is that it stays accurate.

- [ ] **Step 3: Leave it uncommitted, matching the original doc's own instruction**

Do not `git add` or commit this file. It was explicitly created as a local, uncommitted reference doc — keep it that way.

---

## Self-review notes (per the writing-plans skill's own checklist)

- **Spec coverage:** all six `User Question` annotations map to a task — Q1→Task 2, Q2→Task 4, Q3→Task 1, Q4→Task 6, Q5→Task 5, Q6→Task 7.
- **Placeholder scan:** none found — every step has runnable code, not a description of code.
- **Type consistency:** `RankSubject.predictedPrice`, `DISTANCE_TIER_MILES`, and `computeDistanceMiles` are named identically everywhere they're introduced (Task 3) and consumed (Tasks 4 and 5).
