# Comp Supply + Link-Failed Back-fill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop reports showing too few (or zero) comparable vehicles — by removing a proven-idle
model gate, adding observability to the fallback comp search, fixing the model-name mismatch
that empties the fallback search, and back-filling the displayed table from the best-ranked
comps whose link check failed (preferring "probably a bot-block" over "page gone").

**Architecture:** Two independent halves. **Creation-time** (webhook / MarketCheck fetch /
supplementers): observability + model-name normalisation so the fallback search actually
returns listings. **Display-time** (`selectDisplayComparables` / `url-validator`): classify
_why_ each link check failed and back-fill the table from gate-passing failed-check comps when
the live set is short. They share nothing but the goal; either can ship first.

**Tech Stack:** Next.js App Router (TypeScript), Jest (`@jest-environment node` for lib tests),
Supabase, the `zipcodes` package. Same conventions as PR #140.

**Spec:** `docs/plans/2026-08-28-comp-supply-and-link-backfill.md` (read it — it carries the
rationale, the data behind each decision, and the review of the handoff doc).
**Also read:** `docs/marketcheck-empty-comps-handoff-2026-08-28.md` (Part B source — its
file/line refs are pre-#140 and STALE; re-locate every reference in current code).

## Global Constraints

- **Base:** `main` at or after `9bc0127` (PR #140 merged). Work in a git worktree, new branch
  `comp-supply-backfill`. Never branch off a dirty tree; never push to `main`.
- **The model gate drops nothing.** Verified 2026-08-28: 0 comps dropped across 80 paid reports
  / 4,863 stored comps. Removal is a simplification, not a behaviour change.
- **Hard gates that stay** (all proven load-bearing): `price > 0`, `miles != null`, price
  within `PRICE_GATE_FRACTION` (0.40) of `predictedPrice`.
- **Back-filled comps are never labelled** in the UI (Skip's call — a failed HEAD+GET is
  _uncertain_, not confirmed dead).
- **No delivery gate on comp count** (§3.5 decision) — a thin-market report still ships; it
  gets an explicit copy line and a manual-review flag instead.
- **No new MarketCheck primary calls.** B2/B3 change the _fallback search_ query, and only add
  up to 3 extra `/v2/search/car/active` retries (a thin `model+body_type` result, then a
  year-widened one) when the first attempt comes back short — capped at 4 attempts total.
- **TDD throughout.** Failing test first. Match the existing style (see
  `__tests__/lib/utils/comp-gates.test.ts`, `.../url-validator.test.ts`).
- **Regression gate:** `npx jest` shows zero net-new failures over the current baseline
  (record it in Task 0). `npx tsc --noEmit -p tsconfig.json` and `npx eslint <touched>` clean
  per task.
- **Verify against production data** after deploy (CLAUDE.md) — not just a green PR.
- **Claude never merges.** One PR (or two: creation `B*` / display `A*` — decide by diff size).

---

## File structure

**New:**

| File                                        | Responsibility                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/utils/vehicle-model.ts`                | `splitModelAndBodyType(model)` — split a trailing body-style token into a separate MarketCheck `body_type` value ("Civic Coupe" → `{ model: "Civic", bodyType: "Coupe" }`). Pure. |
| `__tests__/lib/utils/vehicle-model.test.ts` | its tests                                                                                                                                                                         |
| `__tests__/lib/utils/link-backfill.test.ts` | integration-style tests for the display back-fill (Task 6)                                                                                                                        |

**Modified:**

| File                                                                                                                                        | Change                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/utils/comp-gates.ts`                                                                                                                   | Remove the model gate, the safety valve, `skipModelGate`, the `norm` import. `passesHardGates` / `gateListings` drop the `subject` param.                                                                                       |
| `lib/utils/comparables-ranker.ts`                                                                                                           | `selectDisplayComparables`: remove the model-gate arg; replace the `deadBudget` / `DEAD_LINK_SCORE_FLOOR` back-fill with a fill-to-`limit` back-fill ordered by link-failure reason then score; log the live/back-filled split. |
| `lib/utils/comp-relevance-score.ts`                                                                                                         | `DEAD_LINK_SCORE_FLOOR` / `MAX_DEAD_LINK_COMPS` removed or repurposed; `norm` no longer imported by `comp-gates`.                                                                                                               |
| `lib/utils/url-validator.ts`                                                                                                                | `fetchOnce` → returns `{ ok, reason }`; `checkUrl` returns the reason; `validateListingUrls` annotates `url_check_result` on each listing (keeps `url_validated`).                                                              |
| `lib/api/marketcheck-client.ts`                                                                                                             | `fetchMarketCheckSearchFallback`: durable log per attempt; normalise `model` + retry once on `num_found: 0` with the stripped model; year widening.                                                                             |
| `lib/utils/comparables-supplementer.ts`                                                                                                     | structured exit-reason record (Task 2). The `:150` model self-correction needs **no** change — `fetchMarketCheckSearchFallback` now splits the model internally.                                                                |
| `lib/utils/dealer-type-supplementer.ts`                                                                                                     | structured exit-reason record.                                                                                                                                                                                                  |
| `app/api/reports/[id]/fetch-marketcheck/route.ts`, `app/api/lemonsqueezy/webhook/route.ts`, `app/api/admin/reports/create-free/route.ts`    | drop the `gateListings` `subject` arg; empty-comps flag + copy on the webhook path.                                                                                                                                             |
| `lib/pdf/report-template.tsx`, `app/reports/[id]/view/page.tsx`, `app/reports/[id]/print/page.tsx`                                          | render the "no local listings; valuation based on N statistical comparables" line when the displayed set is empty.                                                                                                              |
| `__tests__/lib/utils/comp-gates.test.ts`, `.../url-validator.test.ts`, `.../comparables-supplementer.test.ts`, `.../comp-selection.test.ts` | update for the above.                                                                                                                                                                                                           |
| `docs/comp-selection-process-2026-08-26.md`                                                                                                 | reflect the model-gate removal and the new back-fill rule.                                                                                                                                                                      |

---

## Task 0: Worktree + baseline

- [ ] **Step 1:** `cd "../Vehicle Comparison Site"; git fetch origin; git worktree add -b comp-supply-backfill ../vcs-comp-supply origin/main; cd ../vcs-comp-supply; npm ci`
- [ ] **Step 2:** Copy `.env.local` from the main working tree into the worktree (git worktrees don't copy gitignored files; the pre-push `next build` hook needs it):
      `cp "../Vehicle Comparison Site/.env.local" .env.local`
- [ ] **Step 3:** `npx jest --silent 2>&1 | tail -3` — record the baseline pass/fail counts here: `______ failed / ______ passed`. That is the "zero net-new failures" reference.
- [ ] **Step 4:** `cp "../totallosstoolkit-workspace/docs/plans/2026-08-28-comp-supply-and-link-backfill.md" docs/plans/ ; cp "../totallosstoolkit-workspace/docs/marketcheck-empty-comps-handoff-2026-08-28.md" docs/ ; git add docs/plans/2026-08-28-comp-supply-and-link-backfill.md docs/marketcheck-empty-comps-handoff-2026-08-28.md ; git commit -m "docs: spec + handoff for the comp-supply / link-backfill follow-up"`

---

## Task 1: Remove the model gate

**Files:**

- Modify: `lib/utils/comp-gates.ts`
- Modify: `lib/utils/comparables-ranker.ts`, `lib/utils/comparables-supplementer.ts`, `app/api/reports/[id]/fetch-marketcheck/route.ts`, `app/api/lemonsqueezy/webhook/route.ts`, `app/api/admin/reports/create-free/route.ts` (each drops one `gateListings` arg)
- Modify: `__tests__/lib/utils/comp-gates.test.ts`

**Interfaces:**

- Produces: `passesHardGates(comp, predictedPrice?): boolean` and `gateListings(listings, predictedPrice?): MarketCheckComparable[]` — the `subject` / `GateSubject` param is **gone**. `modelTokensOverlap` is deleted.

- [ ] **Step 1: Update the failing tests first**

In `__tests__/lib/utils/comp-gates.test.ts`: delete every test that exercises the model gate
or the safety valve (`modelTokensOverlap`, "c-max energi", "Highlander vs Camry", "model gate
emptied the pool", `console.warn` spy). Keep and adjust the price / mileage / ±40%-band tests
to the new 2-arg signature:

```ts
import { passesHardGates, gateListings } from '@/lib/utils/comp-gates'
// makeListing helper unchanged

describe('passesHardGates', () => {
  it('passes a clean comp', () => {
    expect(passesHardGates(makeListing(), 20000)).toBe(true)
  })
  it('drops zero / missing price', () => {
    expect(passesHardGates(makeListing({ price: 0 }), 20000)).toBe(false)
    expect(passesHardGates(makeListing({ price: undefined as unknown as number }), 20000)).toBe(
      false
    )
  })
  it('drops missing mileage', () => {
    expect(passesHardGates(makeListing({ miles: undefined as unknown as number }), 20000)).toBe(
      false
    )
  })
  it('drops a price more than 40% from the predicted price', () => {
    expect(passesHardGates(makeListing({ price: 29000 }), 20000)).toBe(false) // +45%
    expect(passesHardGates(makeListing({ price: 27000 }), 20000)).toBe(true) // +35%
  })
  it('skips the price band when predictedPrice is absent', () => {
    expect(passesHardGates(makeListing({ price: 99000 }), undefined)).toBe(true)
  })
  it('keeps a different-model comp — model is no longer gated', () => {
    expect(passesHardGates(makeListing({ model: 'Camry' }), 20000)).toBe(true)
  })
})

describe('gateListings', () => {
  it('returns only the passing comps, order preserved', () => {
    const listings = [
      makeListing({ vin: 'OK1' }),
      makeListing({ vin: 'BADPRICE', price: 100000 }),
      makeListing({ vin: 'OK2' }),
    ]
    expect(gateListings(listings, 20000).map(l => l.vin)).toEqual(['OK1', 'OK2'])
  })
})
```

- [ ] **Step 2: Run, confirm fail** — `npx jest __tests__/lib/utils/comp-gates.test.ts` → fails to compile (2-arg calls vs 3-arg impl).

- [ ] **Step 3: Rewrite `lib/utils/comp-gates.ts`**

```ts
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
```

- [ ] **Step 4: Fix the call sites** (drop the middle arg)

- `lib/utils/comparables-ranker.ts` — `gateListings(all, subject, predictedPrice)` → `gateListings(all, predictedPrice)`.
- `lib/utils/comparables-supplementer.ts:95` — `gateListings(cleaned, { model: subjectVehicle.model }, predictedPrice)` → `gateListings(cleaned, predictedPrice)`.
- `app/api/reports/[id]/fetch-marketcheck/route.ts`, `app/api/lemonsqueezy/webhook/route.ts`, `app/api/admin/reports/create-free/route.ts` — each has `gateListings(<listings>, { model: subjectVehicle?.model }, <predictedPrice>)` → `gateListings(<listings>, <predictedPrice>)`. Leave the surrounding `num_found` recompute etc. from #140 intact.

Run `git grep -n "gateListings\|passesHardGates\|modelTokensOverlap\|skipModelGate\|GateSubject" -- lib app __tests__` and confirm nothing else references the removed symbols. `modelTokensOverlap` and `GateSubject` should have **zero** hits after this task.

- [ ] **Step 5: `comp-relevance-score.ts`** — `norm` is still exported and still used by `tokenTrimMatch`; leave it exported. No change needed unless `git grep` shows `norm` now has only internal use — if so, un-export it (drop `export`), else leave it.

- [ ] **Step 6: Run tests, type-check, lint, full suite**

```
npx jest __tests__/lib/utils/comp-gates.test.ts __tests__/lib/utils/comp-selection.test.ts __tests__/lib/utils/comparables-supplementer.test.ts
npx tsc --noEmit -p tsconfig.json
npx eslint lib/utils/comp-gates.ts lib/utils/comparables-ranker.ts lib/utils/comparables-supplementer.ts "app/api/reports/[id]/fetch-marketcheck/route.ts" app/api/lemonsqueezy/webhook/route.ts app/api/admin/reports/create-free/route.ts __tests__/lib/utils/comp-gates.test.ts
npx jest --silent 2>&1 | tail -3
```

Expected: all green; zero net-new failures vs Task 0 baseline.

- [ ] **Step 7: Commit**

```bash
git add lib/utils/comp-gates.ts lib/utils/comparables-ranker.ts lib/utils/comparables-supplementer.ts \
  "app/api/reports/[id]/fetch-marketcheck/route.ts" app/api/lemonsqueezy/webhook/route.ts \
  app/api/admin/reports/create-free/route.ts __tests__/lib/utils/comp-gates.test.ts
git commit -m "Remove the model gate — 0/4863 comps filtered in production data"
```

---

## Task 2: Observability for the fallback comp search (handoff doc §3.1)

**Files:**

- Read first: `lib/api/api-call-logger.ts` and the `api_call_logs` columns (`docs/data-dictionary-reports.md` or a `select * limit 1`).
- Modify: `lib/api/marketcheck-client.ts` (`fetchMarketCheckSearchFallback`), `lib/utils/comparables-supplementer.ts` (`supplementComparables`), `lib/utils/dealer-type-supplementer.ts` (`supplementWithAlternateDealerType`)

**Interfaces:**

- Consumes: the existing `logApiCall` helper (name/signature: read `api-call-logger.ts`).
- Produces: an `api_call_logs` row per fallback-search attempt, and one structured exit-reason
  record per supplement invocation.

- [ ] **Step 1: Read the logging helper and note its exact call shape**

`grep -n "export" lib/api/api-call-logger.ts` and read the function. Note the required fields
(likely `provider`, `endpoint`, `success`, `durationMs`, `cost`, `requestData`, `responseData`,
`errorMessage`, `reportId`). Whether it needs a Supabase client passed in.

- [ ] **Step 2: Log every fallback-search attempt**

In `fetchMarketCheckSearchFallback` (`lib/api/marketcheck-client.ts`), after each
`/v2/search/car/active` fetch resolves (success **and** failure branches, and the
`listings.length === 0` guard), write an `api_call_logs` row:

```ts
await logApiCall({
  provider: 'marketcheck',
  endpoint: '/v2/search/car/active',
  success: /* true only when listings.length > 0 */,
  durationMs,
  requestData: { make, model, year, start, rows: 50 },
  responseData: { num_found: numFound ?? 0, returned: (listings || []).length },
  errorMessage: /* the error string on the !ok or empty-guard paths, else null */,
  reportId: /* thread it in — add an optional `reportId` param to fetchMarketCheckSearchFallback and its callers */,
})
```

`fetchMarketCheckSearchFallback` currently takes no `reportId`. Add `reportId?: string` as a
trailing optional param and thread it from `comparables-supplementer.ts` (which has it via the
webhook) — if it's not readily available there, pass `undefined` and log without it rather than
blocking.

- [ ] **Step 3: Structured exit-reason record from the supplementers**

In `supplementComparables` (`lib/utils/comparables-supplementer.ts`) add, at **every**
`return unchanged` / early return and at the successful return, a single call:

```ts
logSupplementOutcome({
  fn: 'supplementComparables',
  reportId,
  exitReason: 'validCount_ge_min' | 'subjectVehicle_missing' | 'mileage_or_zip_null'
    | 'apiKey_missing' | 'pass1_null' | 'post_gate_empty' | 'post_filter_empty' | 'supplemented',
  validCountIn: validCount,
  listingsOut: /* combinedListings.length or 0 */,
  supplemented: /* boolean */,
})
```

Do the same in `supplementWithAlternateDealerType` (`lib/utils/dealer-type-supplementer.ts`)
with `fn: 'supplementWithAlternateDealerType'` and its own reason set (`validatedCount_ge_min`,
`altSearch_failed`, `no_new_vins`, `post_gate_empty`, `supplemented`).

`logSupplementOutcome` = a thin new helper. Simplest durable option: write an `api_call_logs`
row with `provider: 'internal'`, `endpoint: 'supplement:outcome'`, `responseData` = the object
above. Put the helper in `lib/api/api-call-logger.ts` next to `logApiCall`. If `api_call_logs`
has a NOT NULL column that doesn't fit (`cost`?), default it to 0 / null per the column's rule.

- [ ] **Step 4: Tests**

- `__tests__/lib/api/marketcheck-client.test.ts`: mock `logApiCall`; assert
  `fetchMarketCheckSearchFallback` calls it once with `endpoint: '/v2/search/car/active'` on the
  success path and once on the `num_found: 0` path with `success: false`.
- `__tests__/lib/utils/comparables-supplementer.test.ts` / `dealer-type-supplementer.test.ts`:
  mock `logSupplementOutcome`; for two existing fixtures (one that supplements, one that
  early-returns) assert it's called with the right `exitReason`.

- [ ] **Step 5: type-check / lint / full suite / commit**

```bash
git commit -m "Log every fallback-search attempt and each supplement exit reason to api_call_logs"
```

---

## Task 3: Split model + body_type for the fallback search (handoff doc §3.2 + §3.4)

**Root cause is confirmed** (handoff §2, probe PR #141): same VIN/ZIP/miles, `model="Civic
Coupe"` → 0 supplemented, `model="Civic"` → 98. But probe 2's bare `model=Civic` search
returned a _sedan-dominated_ set (Si / Touring / EX-L). A 2017 Civic **Coupe** must be valued
against 2017 Civic **coupes** — different body styles, different resale value, weaker evidence
for the insurer if mixed. So the fix is **split the body-style word off `model` and re-send it
as `body_type`**, not just discard it. `/v2/search/car/active` supports a `body_type` filter
(comma-separated; confirmed values `SUV`, `Pickup`, `Sedan`, `Hatchback`, `Convertible`,
`Coupe` — MarketCheck Inventory Search docs).

**Cannot test against the live API** — `MARKETCHECK_API_KEY` returns 401 off-Vercel (IP
allowlist). All tests here mock `fetch`; live verification is a Preview deploy (Task 8).

**Files:**

- Create: `lib/utils/vehicle-model.ts`, `__tests__/lib/utils/vehicle-model.test.ts`
- Modify: `lib/api/marketcheck-client.ts` (`fetchMarketCheckSearchFallback`), and its test

**Interfaces:**

- Produces: `splitModelAndBodyType(model: string): { model: string; bodyType?: string }` —
  when the trailing token maps to a MarketCheck `body_type`, returns the base model + that
  value; otherwise returns the model unchanged with no `bodyType`. Never returns `model: ''`.

- [ ] **Step 1: Write `vehicle-model.test.ts`**

```ts
/** @jest-environment node */
import { splitModelAndBodyType } from '@/lib/utils/vehicle-model'

describe('splitModelAndBodyType', () => {
  it.each([
    ['Civic Coupe', { model: 'Civic', bodyType: 'Coupe' }],
    ['Civic Sedan', { model: 'Civic', bodyType: 'Sedan' }],
    ['Focus Hatchback', { model: 'Focus', bodyType: 'Hatchback' }],
    ['3 Series Convertible', { model: '3 Series', bodyType: 'Convertible' }],
    ['F-150 Crew Cab', { model: 'F-150', bodyType: 'Pickup' }],
  ])('%s -> %o', (input, expected) => {
    expect(splitModelAndBodyType(input)).toEqual(expected)
  })
  it('leaves a canonical model alone (no bodyType)', () => {
    for (const m of [
      'F-150',
      'Grand Highlander',
      'Santa Fe Sport',
      'Wrangler Unlimited',
      'Model S',
      'Prius c',
      'IONIQ 5',
    ]) {
      expect(splitModelAndBodyType(m)).toEqual({ model: m })
    }
  })
  it('does not strip a model that IS a body-style word', () => {
    expect(splitModelAndBodyType('Coupe')).toEqual({ model: 'Coupe' })
  })
})
```

- [ ] **Step 2: Run, confirm fail** (module not found).

- [ ] **Step 3: Implement `lib/utils/vehicle-model.ts`**

```ts
/**
 * MarketCheck's for-sale inventory indexes a vehicle by its canonical model
 * ("Civic") with the body style in a separate `body_type` filter. The auto.dev
 * VIN decoder returns "Civic Coupe" as one string, and the decoder's own body
 * field is too coarse ("Car"). Recover the body style from the trailing token
 * on `model` and hand it back separately.
 *
 * Do NOT first-word-truncate — that breaks "Grand Highlander", "Santa Fe
 * Sport", "Wrangler Unlimited", "Model S", "Prius c", "IONIQ 5".
 *
 * Verify the BODY_TYPE_MAP values against the current MarketCheck Inventory
 * Search docs when implementing — only tokens with a confirmed `body_type`
 * value are split; an unmapped trailing token is left on the model string.
 */
const BODY_TYPE_MAP: Record<string, string> = {
  coupe: 'Coupe',
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  convertible: 'Convertible',
  cabriolet: 'Convertible',
  'crew cab': 'Pickup',
  'extended cab': 'Pickup',
  'regular cab': 'Pickup',
  pickup: 'Pickup',
  suv: 'SUV',
  // 'wagon' / 'van' / 'minivan' — add only if the docs confirm a body_type value; else omit
}

export function splitModelAndBodyType(model: string): { model: string; bodyType?: string } {
  const trimmed = (model || '').trim()
  const lower = trimmed.toLowerCase()
  for (const [token, bodyType] of Object.entries(BODY_TYPE_MAP)) {
    if (lower.endsWith(' ' + token)) {
      return { model: trimmed.slice(0, trimmed.length - token.length - 1).trim(), bodyType }
    }
  }
  return { model: trimmed }
}
```

- [ ] **Step 4: Use it in `fetchMarketCheckSearchFallback`**

The split is done **inside** `fetchMarketCheckSearchFallback` (one authoritative place), so its
callers keep passing the raw `subjectVehicle.model` — `comparables-supplementer.ts:150`
(`originalListings[0]?.model ?? subjectVehicle.model`) needs **no change**; splitting `"Civic"`
is a no-op and splitting `"Civic Coupe"` now happens downstream.

Rework the query build + retry ladder (log every attempt — Task 2; cap total attempts at 4):

1. `const { model: baseModel, bodyType } = splitModelAndBodyType(model)`.
2. **Attempt 1:** `model=<baseModel>` + (`body_type=<bodyType>` if set) + `year=<year>`.
3. **Attempt 2** — only if `bodyType` was sent AND attempt 1's `num_found < 10`
   (`MIN_VALID`): re-run with `model=<baseModel>`, **no** `body_type`, same `year`. Keep the
   mixed result — downstream ranking sorts by best match; a relevant-where-possible set beats
   an empty table.
4. **Attempt 3** — only if the best result so far is still `num_found === 0`: re-run without
   the `year` param (post-fetch `applyYearFilter` still bounds the model-year window).
5. **Attempt 4** — only if still 0: `model=<baseModel>`, no `body_type`, no `year`.
6. Return the first non-empty result (its listings), else `{ success: false }` after all
   attempts. Preserve the existing return shape.

- [ ] **Step 5: Tests (`marketcheck-client.test.ts`, all `fetch` mocked)**

- `fetchMarketCheckSearchFallback('key', 2017, 'Honda', 'Civic Coupe', vin, 78000, '14450')`:
  mock attempt-1 (`model=Civic&body_type=Coupe`) → `{ num_found: 4, listings: [...4] }`; assert
  it makes attempt 2 with `model=Civic` and **no** `body_type` (4 < 10), and returns that
  wider set.
- Same call, attempt-1 → `{ num_found: 0 }`: assert attempt 2 (bare model) fires, then if that
  is also 0, attempt 3 drops `year`. Assert the request URLs via the `fetch` mock's call args.
- `fetchMarketCheckSearchFallback('key', 2020, 'Toyota', 'Grand Highlander', ...)`: assert
  attempt 1 sends `model=Grand%20Highlander` with **no** `body_type`, and there is exactly one
  attempt when it returns ≥ 10.
- `dealer-type-supplementer.test.ts` / `comparables-supplementer.test.ts` fixtures for
  "Wrangler Unlimited", "Model S", "F-150", "Odyssey" must still pass unchanged (no body_type
  sent, one attempt).

- [ ] **Step 6: type-check / lint / full suite / commit**

```bash
git commit -m "Fallback search: split model + body_type (Civic Coupe -> model=Civic&body_type=Coupe), widen on thin/zero"
```

---

## Task 4: url-validator — classify _why_ a link check failed

**Files:**

- Modify: `lib/utils/url-validator.ts`, `__tests__/lib/utils/url-validator.test.ts`
- Modify: `lib/api/marketcheck-client.ts` (the `MarketCheckComparable` type — add `url_check_result?`)

**Interfaces:**

- Produces: `MarketCheckComparable.url_check_result?: 'valid' | 'dead' | 'blocked' | 'transient' | 'redirected'`.
  Set on every **checked** listing (alongside the existing `url_validated` boolean; `valid`
  ⇔ `url_validated === true`). Never-checked listings still get neither key.

- [ ] **Step 1: Failing tests**

Add to `__tests__/lib/utils/url-validator.test.ts` (match its `mockFetch` setup):

```ts
describe('url_check_result classification', () => {
  const run = listing =>
    validateListingUrls({
      predictedPrice: 0,
      confidence: 'low',
      dataSource: 'marketcheck',
      requestParams: { vin: 'V', miles: 0, zip: '00000', dealer_type: 'both' },
      totalComparablesFound: 1,
      recentComparables: { num_found: 1, listings: [listing] },
      generatedAt: new Date().toISOString(),
    })
  it('200 same-host deep path -> valid', async () => {
    mockFetch.mockResolvedValue({ status: 200, url: 'https://d.com/inventory/123' })
    const { prediction } = await run(makeListing({ vdp_url: 'https://d.com/inventory/123' }))
    expect(prediction.recentComparables.listings[0].url_check_result).toBe('valid')
  })
  it('404 -> dead', async () => {
    mockFetch.mockResolvedValue({ status: 404, url: 'https://d.com/inventory/x' })
    const { prediction } = await run(makeListing({ vdp_url: 'https://d.com/inventory/x' }))
    expect(prediction.recentComparables.listings[0].url_check_result).toBe('dead')
    expect(prediction.recentComparables.listings[0].url_validated).toBe(false)
  })
  it('403 -> blocked', async () => {
    mockFetch.mockResolvedValue({ status: 403, url: 'https://d.com/inventory/y' })
    const { prediction } = await run(makeListing({ vdp_url: 'https://d.com/inventory/y' }))
    expect(prediction.recentComparables.listings[0].url_check_result).toBe('blocked')
  })
  it('timeout / network error -> transient', async () => {
    mockFetch.mockRejectedValue(new Error('aborted'))
    const { prediction } = await run(makeListing({ vdp_url: 'https://d.com/inventory/z' }))
    expect(prediction.recentComparables.listings[0].url_check_result).toBe('transient')
  })
  it('redirect to a different host / homepage -> redirected', async () => {
    mockFetch.mockResolvedValue({ status: 200, url: 'https://other.com/' })
    const { prediction } = await run(makeListing({ vdp_url: 'https://d.com/inventory/a' }))
    expect(prediction.recentComparables.listings[0].url_check_result).toBe('redirected')
  })
})
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Rework `fetchOnce` to return a classified result**

```ts
type CheckReason = 'valid' | 'dead' | 'blocked' | 'transient' | 'redirected'

async function fetchOnce(
  url: string,
  method: 'HEAD' | 'GET'
): Promise<{ ok: boolean; reason: CheckReason }> {
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

    if (response.status === 403 || response.status === 429) return { ok: false, reason: 'blocked' }
    if (response.status === 404 || response.status === 410) return { ok: false, reason: 'dead' }
    if (response.status >= 500) return { ok: false, reason: 'transient' }
    if (response.status !== 200 && response.status !== 405) return { ok: false, reason: 'dead' }

    const parsedOriginal = new URL(url)
    const parsedFinal = new URL(response.url)
    if (parsedOriginal.hostname !== parsedFinal.hostname) return { ok: false, reason: 'redirected' }
    const finalPath = parsedFinal.pathname
    const segs = finalPath.split('/').filter(Boolean)
    if (finalPath === '/' || finalPath === '' || segs.length < 2)
      return { ok: false, reason: 'redirected' }

    return { ok: true, reason: 'valid' }
  } catch {
    return { ok: false, reason: 'transient' }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function checkUrl(url: string): Promise<{ ok: boolean; reason: CheckReason }> {
  const head = await fetchOnce(url, 'HEAD')
  if (head.ok) return head
  const get = await fetchOnce(url, 'GET')
  // prefer the more informative reason: a GET 'dead' beats a HEAD 'blocked'
  return get.ok ? get : get.reason === 'transient' ? head : get
}
```

- [ ] **Step 4: Annotate `url_check_result` in `validateListingUrls`**

Where the batch loop records each result, keep a `Map<listing, CheckReason>`. In the final
`allListings.map(...)`: a checked listing gets `{ ...l, url_validated: reason === 'valid',
url_check_result: reason }`; a listing with no `vdp_url` gets `{ ...l, url_validated: true,
url_check_result: 'valid' }`; a never-checked listing is returned with **neither** key (the
existing key-strip logic — extend it to strip `url_check_result` too).

- [ ] **Step 5: Add the type field** in `lib/api/marketcheck-client.ts` `MarketCheckComparable`,
      next to `url_validated?: boolean`:

```ts
  url_check_result?: 'valid' | 'dead' | 'blocked' | 'transient' | 'redirected'
```

- [ ] **Step 6: test / type-check / lint / full suite / commit**

```bash
git commit -m "url-validator: classify link-check failures (dead / blocked / transient / redirected)"
```

---

## Task 5: Loosen the display back-fill in `selectDisplayComparables`

**Files:**

- Modify: `lib/utils/comparables-ranker.ts`
- Modify: `lib/utils/comp-relevance-score.ts` (retire `DEAD_LINK_SCORE_FLOOR` / `MAX_DEAD_LINK_COMPS`, add `DISPLAY_TARGET` if wanted)
- Create: `__tests__/lib/utils/link-backfill.test.ts`
- Modify: `__tests__/lib/utils/comp-selection.test.ts` (the ≥90 / cap-of-2 cases change)

**Interfaces:**

- `selectDisplayComparables` keeps its signature and return type. New internal ordering helper
  `linkFailurePreference(reason)`: `blocked`/`transient` → 0, `redirected` → 1, `dead` → 2,
  missing → 1.

- [ ] **Step 1: Failing tests** — `__tests__/lib/utils/link-backfill.test.ts`

```ts
/** @jest-environment node */
// build a valuation with N live comps + M failedCheck comps (each carrying url_check_result),
// all passing the hard gates, and assert:
//  - live pool >= limit         -> exactly `limit` live, no failedCheck
//  - live 3, failedCheck 20     -> returns 10 (3 live + 7 backfilled)
//  - backfill order: 'blocked'/'transient' before 'redirected' before 'dead', then by score
//  - a failedCheck comp that FAILS a hard gate (price 0 / >±40%) is never backfilled
//  - live 0, failedCheck all 'dead' -> still returns up to `limit` (dead is last resort, not excluded)
//    [decide: if you choose to EXCLUDE 'dead' entirely, assert [] here instead — pick one and pin it]
```

Also update `comp-selection.test.ts`: the "admits at most MAX_DEAD_LINK_COMPS", "does NOT
admit below the floor", and "cap vs gap" tests are now wrong — replace with the fill-to-`limit`
behaviour.

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Replace step 4/5 of `selectDisplayComparables`**

```ts
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
```

Delete the `deadBudget` / `deadAllowance` block and the `DEAD_LINK_SCORE_FLOOR` /
`MAX_DEAD_LINK_COMPS` imports. Keep the two `console.warn`s for the genuinely-empty cases.
Update the file's top-of-file doc comment.

- [ ] **Step 4: `comp-relevance-score.ts`** — remove `DEAD_LINK_SCORE_FLOOR` and
      `MAX_DEAD_LINK_COMPS` and their tests in `comp-relevance-score.test.ts` (`git grep` first;
      no other importers expected after Step 3).

- [ ] **Step 5: test / type-check / lint / full suite / commit**

```bash
git commit -m "Back-fill the comps table from gate-passing failed-link comps, best failure-reason first"
```

---

## Task 6: Log the live / back-filled split per report (spec A3)

**Files:** Modify: `lib/utils/comparables-ranker.ts` (or the three render call sites — pick the
one place all three already share: the selector).

- [ ] **Step 1:** In `selectDisplayComparables`, just before `return assembled`, emit one
      structured line (only when a back-fill happened, to keep the happy path quiet):

```ts
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
```

- [ ] **Step 2:** No new unit test (log line) — confirm the existing selector tests still pass
      and the log doesn't fire on full-live-slate fixtures. Commit with Task 5 or standalone:

```bash
git commit -m "Log the live vs back-filled split when the comps table is back-filled"
```

---

## Task 7: Customer-facing behaviour when the comps table is genuinely empty (handoff doc §3.5)

**Files:**

- Modify: `app/api/lemonsqueezy/webhook/route.ts` (set a flag when the stored
  `recentComparables.listings` ends up empty after all supplements)
- Modify: `lib/pdf/report-template.tsx`, `app/reports/[id]/view/page.tsx`,
  `app/reports/[id]/print/page.tsx` (render the copy line when the displayed set is empty)
- Persistence: reuse `comparablesStats.count` (already stored) for "N statistical comparables";
  add a boolean the webhook sets — simplest is a `marketcheck_valuation.compsEmpty = true` key
  on the stored blob (no migration), plus stamp `GL Notes` with a manual-review marker (that
  column + workflow already exist).

- [ ] **Step 1:** In the webhook, after supplements, if
      `finalPrediction.recentComparables?.listings?.length ?? 0) === 0`: set
      `finalPrediction.compsEmpty = true` before storing, and append to `GL Notes` something like
      `"[auto] Empty comparables table — manual review; valuation from N=<comparablesStats.count> statistical comps, <date>"`.

- [ ] **Step 2:** In each of the three render surfaces, where the code currently shows the
      empty state ("No comparable listings available…"), replace the bare text with:
      `No active local listings were found for this vehicle. This valuation is based on
{marketcheckValuation.comparablesStats?.count ?? marketcheckValuation.totalComparablesFound}
statistical comparable vehicles from recent market data.`
      Keep it visually consistent with each surface (Tailwind on view/print; `<Text>` on PDF).

- [ ] **Step 3:** Tests: a render-path check is hard (server components) — verify via `tsc` +
      a webhook-route unit test that `compsEmpty` + the `GL Notes` marker are written when the
      supplemented listing set is empty. Commit:

```bash
git commit -m "Empty comps table: explicit copy line + manual-review flag, no delivery gate"
```

---

## Task 8: Doc + verification + PR

- [ ] **Step 1:** Update `docs/comp-selection-process-2026-08-26.md`: remove the model-gate
      step; describe the new back-fill (fill to 10 from gate-passing failed-link comps, ordered
      `blocked`/`transient` → `redirected` → `dead` then score); note `url_check_result` and the
      fallback-search model normalisation + observability. Commit it.
- [ ] **Step 2:** Full gate: `npx jest --silent` (zero net-new vs Task 0 baseline),
      `npx tsc --noEmit`, `npx eslint` over every touched file.
- [ ] **Step 3:** Re-run the PR #140 Playwright QA against this branch's preview once it's up —
      same 10 reports (`docs/qa/` in the workspace has the report IDs and the approach). Expected:
      Altima 1→~10, F-150 2→~10, Sienna 7→10, Highlander 9→10; the 6 already at 10 unchanged; every
      added comp still within ±40%; capture the `[selectDisplayComparables] backfilled` log lines.
- [ ] **Step 4:** Part B live check. The MarketCheck key 401s off-Vercel, so this must run
      from Vercel infra — either a paid test report (LemonSqueezy test mode) for a discontinued
      body-style variant (Civic Coupe, VIN `2HGFC3B33HH351102`, ZIP `14450`, ~78k mi), or a
      temporary `GET /api/debug/marketcheck` route deployed to Preview and **deleted after** (the
      PR #141 probe pattern). Confirm:
  - `comparables_supplemented = true` and a non-empty `recentComparables.listings`;
  - the recovered listings are actually **coupes** — the `body_type=Coupe` filter took effect,
    not a sedan-dominated set (handoff §4 step 3);
  - the new `api_call_logs` rows show the search-attempt ladder (`model=Civic&body_type=Coupe`
    first, then the widening steps only if short);
  - **whether supplemented listings come back `url_validated`** (probe 2 saw all 98 as
    `false`). If they systematically fail: it's either a `checkUrl` weakness or genuinely dead
    supplemented links — either way it lands in Task 5's back-fill as `failedCheck` comps, so
    confirm Task 5 then fills the table rather than showing 0. Note the finding in the PR body.
- [ ] **Step 5:** `git push -u origin comp-supply-backfill` (the pre-push hook runs `next build`
      — needs the `.env.local` from Task 0). `gh pr create --base main` with a body covering: model
      gate removed (0/4863 data), the fallback-search fix + observability, the display back-fill +
      failure classification, the empty-comps copy line, and the QA / live-check results. **Do not
      merge.**

---

## Self-review

**Spec coverage:**

| Spec item                                                                  | Task                                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Merge #140 first (recommendation)                                          | Task 0 base = `origin/main` post-#140                                                                                               |
| Part A.A1 — loosen back-fill                                               | Task 5                                                                                                                              |
| Part A.A2 — failure-reason classification                                  | Task 4                                                                                                                              |
| Part A.A3 — log live/back-filled split                                     | Task 6                                                                                                                              |
| Part B.B1 — observability                                                  | Task 2                                                                                                                              |
| Part B.B2 — model / body_type split (handoff §3.2, upgraded)               | Task 3                                                                                                                              |
| Part B.B3 — year widening                                                  | Task 3 (Step 4, attempts 3–4)                                                                                                       |
| Handoff §2 — probe-2 "all 98 supplemented listings `url_validated: false`" | Task 8 Step 4 (confirm); Task 5 handles the outcome (they become `failedCheck`, get back-filled)                                    |
| Part B.B4 — empty-comps copy + flag                                        | Task 7                                                                                                                              |
| Part B.B5 — geo-aware fallback                                             | **Deferred** — spec marks it a decision overlapping `docs/live-comp-distance-ranking-design`; not a task here. Flag in the PR body. |
| Model gate: is it needed?                                                  | Task 1 — removed, with the 0/4863 evidence                                                                                          |

**Placeholder scan:** one deliberate open decision in Task 5 Step 1 ("EXCLUDE 'dead' entirely
vs keep as last resort — pick one and pin it") — the implementer decides from the Task 3 /
Task 4 behaviour and the QA in Task 8; both options are spelled out. No `TBD`s elsewhere.

**Type consistency:** `passesHardGates(comp, predictedPrice?)` / `gateListings(listings,
predictedPrice?)` — 2-arg everywhere after Task 1. `url_check_result` union is identical in
Task 4 Step 3, Step 5, and Task 5's `linkFailurePreference`. `splitModelAndBodyType(string):
{ model: string; bodyType?: string }` — same in Task 3 Steps 1, 3, 4, 5; the `body_type` string
values (`Coupe`/`Sedan`/`Hatchback`/`Convertible`/`Pickup`/`SUV`) must match what MarketCheck's
Inventory Search docs accept (verify in Task 3 Step 3).

**Cross-task ordering:** Task 4 (`url_check_result`) must land before Task 5 (which reads it) —
enforced by task number. Task 3's model/body_type split and Task 1's gate removal are
independent. Task 2 (observability) has no dependants but is sequenced first among Part B so
Task 8's live check can read its logs. **Task 3 and Task 5 compose:** if supplemented listings
keep coming back `url_validated: false` (probe-2 observation), Task 3 supplies the candidates
and Task 5's back-fill is what actually gets them onto the report — verify both together in
Task 8.
