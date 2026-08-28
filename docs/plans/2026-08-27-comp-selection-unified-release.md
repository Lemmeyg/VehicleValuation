# Comp Selection — Unified Release (design spec)

## Status

- **Status:** Design spec — awaiting Skip's review. Not yet an implementation plan.
- **Next action:** Skip reviews this file; on approval it becomes a task-by-task TDD
  implementation plan (`writing-plans`) and is executed as one PR against the website repo.
- **Checkpoint:** none (outside the three Q4 workstreams — this is enabling work for
  Workstream 3, "site conversion", which is gated on the report/preview step being measurable).
- **Repos:** design lives here (workspace). Code changes land in `../Vehicle Comparison Site`.
- **Base branch:** `comp-selection-refinements` (carries PR #137). New working branch:
  `comp-selection-unified`. One PR, never merged by Claude.

---

## Plain-language summary (for Skip)

Right now a report's list of comparable cars is built three different ways depending on where
you look — the web report, the print page, and the downloadable PDF each had their own copy of
the logic, and they disagreed. A branch that's already written (`comp-selection-refinements`,
not yet merged) fixes that: all three now call **one** function. But that branch has two gaps
we need to close before it ships:

1. **It can show dead links.** When the three paths were merged, the merge kept the PDF's old
   behaviour (show the top listings regardless of whether their link still works) and dropped
   the web report's behaviour (only show listings whose link was confirmed live). We want the
   opposite — every path should only show confirmed-live listings.
2. **It ranks by simple rules, not the scoring method we designed.** The methodology memo
   proposed a points-based score (mostly mileage and distance, plus price sanity, trim match,
   and how long the listing has been sitting). This release swaps the branch's rule-of-thumb
   ordering for that score.

It also adds two small things you asked for: tag each comp with where it came from (franchise
dealer / independent dealer / nationwide fallback search) so selection can prefer real dealer
data, and show the date the comps were pulled plus a working link for each one, on all three
paths.

No new MarketCheck API calls. No database migration. One PR. Test-first throughout.

---

## Context — what exists and what's missing

### Already done on `comp-selection-refinements` (22 commits, unmerged)

- **Unified render path:** `selectDisplayComparables()` in `lib/utils/comparables-ranker.ts`;
  `app/reports/[id]/view/page.tsx`, `app/reports/[id]/print/page.tsx`, and
  `lib/pdf/report-template.tsx` all call it. (`32d4933`)
- **Real distance:** `lib/utils/geo-distance.ts` (`computeDistanceMiles`, `DISTANCE_TIER_MILES`)
  using the offline `zipcodes` package — listing ZIP first, raw lat/long fallback. (`6c51096`)
- **Distance-tier + price-proximity ranking** replacing the same-state heuristic. (`ba120ab`)
- **Valuation price band** on the displayed set (`withinValuationBand`, progressive
  10%→15%→…→∞). (`46e093f`)
- **Zero-price guard** in `getBestMatchListings`. (`7119eab`)
- **Tighter cleanup:** dealer cap 3→2, year band −5/+2 → −3/+1. (`c6002a4`)
- **Creation-time dealer-type waterfall:** primary MarketCheck call is `franchise`;
  `supplementWithAlternateDealerType()` fires a second `independent` call only if <10
  validated; then the existing nationwide YMM `supplementComparables()` runs if still short.
  Wired into all three primary-endpoint callers. (`362953d`, `dealer-type-supplementer.ts`)
- **Hardened dead-link check:** GET retry after HEAD failure, 8s timeout. (`d909632`)
- Doc task for `docs/comp-selection-process-2026-08-26.md` (left uncommitted by that plan).

### Gaps this release closes

| #   | Gap                                                                                                              | Fix                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | `selectDisplayComparables()` does **not** filter to live links — the unify kept the PDF's non-filtered behaviour | Add a `url_validated === true` filter with a zero-validated fallback                 |
| 2   | Ranking is lexicographic tiers, ignores trim and days-on-market                                                  | Replace with the weighted 0–100 relevance score                                      |
| 3   | No way at display time to prefer real dealer data over nationwide-fallback comps                                 | Tag each stored comp with `source_tier`; select in two tiers                         |
| 4   | Report generation date and per-comp links not consistently surfaced                                              | Show `valuation.generatedAt` + render each shown comp's `vdp_url` on all three paths |
| 5   | `withinValuationBand` double-counts price once the score + 40% gate exist                                        | Remove it                                                                            |
| 6   | `docs/comp-selection-process-2026-08-26.md` describes the old behaviour                                          | Rewrite it to match, and **commit** it this time                                     |

### Nothing is on `main`

`main`'s newest comp logic is PR #133 (year → same-state → mileage). PR #137 and the whole
`comp-selection-refinements` branch are unmerged. This release brings all of it to `main` in
one PR.

---

## Goal & success criteria

**Goal:** one PR that makes comp selection a single link-aware, weighted-score path shared by
the web report, print page, and PDF, built on `comp-selection-refinements`, with tests and
production verification.

**Done when:**

1. All three render paths call the same selector and, for the same stored report, produce the
   **identical** comp list (verified: regenerate the PDF for ~10 recent paid reports, diff
   against the live web view — must match exactly).
2. The selector returns only comps with `url_validated === true`, with two bounded exceptions:
   a report with **no** link-validation data at all falls back to the gated set; and up to
   `MAX_DEAD_LINK_COMPS` (2) comps whose check failed may appear if they score
   ≥ `DEAD_LINK_SCORE_FLOOR` (90), rendered with no distinguishing label.
3. Selection prefers primary (franchise + independent) comps; nationwide-fallback comps are
   used only to reach 10 when primary can't. A comp is never URL-checked if it fails a hard
   gate.
4. Comps are ordered by the weighted relevance score defined below.
5. Web view, print page and PDF each show the retrieval date and a working link per comp.
6. `npx jest` shows **zero** net-new failures over the documented 53-failing baseline; every
   new behaviour has a test written before its implementation.
7. `docs/comp-selection-process-2026-08-26.md` matches the merged code and is committed.
8. The `build-comp-selection-dataset.cjs` analysis re-run shows the link-filtered ("floor")
   KPIs for the new path, recorded in the PR description.

---

## Scope

### In

- New shared selection module logic (gates → link split → two-tier pool → weighted score →
  final assembly with the ≤2 ≥90 failed-check allowance).
- Weighted-score function (new, pure, unit-tested in isolation).
- `source_tier` tag on each stored comp, set at creation time in the three acquisition paths.
- Threading `subject.model` / `subject.trim` / `predictedPrice` into the selector at the three
  call sites.
- Retire `withinValuationBand` and `getBestMatchListings`.
- Creation-time: run the hard gates **before** `validateListingUrls`; point its check-ordering
  `sortFn` at the weighted score; have it leave never-checked comps `url_validated: undefined`
  rather than `false`.
- Retrieval-date + per-comp link rendering on all three paths.
- Rewrite + commit `docs/comp-selection-process-2026-08-26.md`.
- Tests for all of the above; production verification.

### Out (explicit — do not build here)

- Moving distance math into the report-**creation** pipeline
  (`docs/live-comp-distance-ranking-design` — its own release).
- Live per-render re-validation of listing links (heavier; note as follow-up).
- Persisting the final chosen comp list at creation ("frozen" copy). PDF stays a
  generation-time snapshot; web recomputes; identical logic keeps them matching.
- Calibrating the score weights against outcome data.
- Increasing MarketCheck page depth beyond ~50.
- Any database migration.

---

## Architecture

### One selector, three callers

```
        marketcheck_valuation (stored JSON, unchanged shape + new per-comp source_tier)
                                   │
                    selectDisplayComparables(valuation, subject, limit)
                                   │
                 ┌─────────────────┼─────────────────┐
        view/page.tsx        print/page.tsx     pdf/report-template.tsx
        (live recompute)     (live recompute)   (snapshot at generation)
```

`selectDisplayComparables` stays the **only** entry point. It keeps returning
`MarketCheckComparable[]` (a bare array) so the three call sites don't change shape; tier/
link-fallback diagnostics are logged server-side, not returned. Its `subject` argument widens
from `{ year, mileage, zip }` to `{ year, mileage, zip, model, trim }`; `predictedPrice` is
still read from the `valuation` argument internally.

### Creation-time source tagging

Each `MarketCheckComparable` gains `source_tier?: 'franchise' | 'independent' | 'fallback_search'`,
written where the listing enters the pipeline:

| Path                                                        | Sets `source_tier` to |
| ----------------------------------------------------------- | --------------------- |
| Primary VIN lookup (`fetchMarketCheckData`, franchise call) | `'franchise'`         |
| `supplementWithAlternateDealerType` (independent call)      | `'independent'`       |
| `supplementComparables` (nationwide YMM search)             | `'fallback_search'`   |

Written once, at map time, before the listing is merged into `recentComparables.listings`.
Reports created before this ships have no tag → the selector treats missing as **primary**
(equivalent to `'franchise'`), so the two-tier logic still resolves.

---

## The selection algorithm

`selectDisplayComparables(valuation, subject, limit = 10)`:

### 1. Source the pool

`all = valuation.recentComparables?.listings ?? []`

### 2. Hard gates — disqualify a comp entirely if any is true → `gated`

- `subject.model` and `comp.model` both present and not case-insensitively equal
- `comp.price` missing or ≤ 0
- `comp.miles` missing
- `predictedPrice` present and `|comp.price − predictedPrice| / predictedPrice > 0.40`

The gates are cheap (field comparisons). They run **before** the link filter so a disqualified
comp is never URL-checked at creation time — see _Creation-time pipeline_ below.

### 3. Link split

Read the stored per-comp `url_validated` flag (three states after this release — see
_Creation-time pipeline_):

- `live = gated.filter(c => c.url_validated === true)`
- `failedCheck = gated.filter(c => c.url_validated === false)` — checked and did not pass
- comps with `url_validated === undefined` (never checked) are set aside — neither `live` nor
  `failedCheck`

If `live` is empty **and** no comp in `gated` carries a `url_validated` field at all → the
report predates link validation entirely; set `live = gated`, `failedCheck = []`, and log
`linkDataUnavailable`.

### 4. Two-tier pool (on `live`)

- `livePrimary = live.filter(c => c.source_tier !== 'fallback_search')`
- If `livePrimary.length >= limit` → **poolForScoring = livePrimary**, tier = `primary`.
- Else → **poolForScoring = live** (primary + fallback_search together), tier =
  `primary+fallback`. No pinning: once fallback is in, the whole set competes on score.

### 5. Weighted relevance score (0–100, higher = better)

Each sub-score is 0–1. Any factor whose **subject-side** input is missing or zero
(`subject.mileage`, `subject.year`, `predictedPrice`, `subject.trim`, `subject.zip`) yields the
neutral value 0.5 for every comp, so it neither divides by zero nor distorts the ranking. A
missing **comp-side** input is handled per-factor in the table (distance `null` → 0.15, `dom`
`null` → 0.5, etc.).

| Factor             | Sub-score                                                                                                        | Weight                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- | ---- |
| Mileage closeness  | `1 − min(                                                                                                        | comp.miles − subject.mileage | ÷ subject.mileage, 1)`                 | 0.35 |
| Distance closeness | `computeDistanceMiles(subject.zip, comp)` → `d`; `d == null ? 0.15 : 1 − min(d ÷ 500, 1)`                        | 0.25                         |
| Price plausibility | `predictedPrice` known: `1 − min(                                                                                | comp.price − predictedPrice  | ÷ predictedPrice ÷ 0.40, 1)`; else 0.5 | 0.15 |
| Trim match         | `tokenTrimMatch(subject.trim, comp.trim)` → exact 1.0 / partial 0.5 / none 0.15 / unknown 0.5                    | 0.10                         |
| Listing freshness  | `dom = comp.dos_active ?? comp.dom`; `dom == null ? 0.5 : dom ≤ 45 ? 1.0 : dom ≥ 180 ? 0 : 1 − (dom − 45) ÷ 135` | 0.10                         |
| Year closeness     | `1 − min(                                                                                                        | comp.year − subject.year     | ÷ 3, 1)`                               | 0.05 |

`score = 100 × Σ(weightᵢ × sub_scoreᵢ)`

### 6. Assemble the final set

1. Score every comp in `poolForScoring`.
2. **If `poolForScoring.length >= limit`** (the live pool already fills the report) → no
   failed-check comps are admitted; skip to step 4.
3. Otherwise score every comp in `failedCheck`; take those with `score ≥ DEAD_LINK_SCORE_FLOOR`
   (90), highest first, at most `MAX_DEAD_LINK_COMPS` (2). `candidates = poolForScoring ∪ those`.
4. Sort `candidates` by `score` descending; return `.slice(0, limit)`.

A failed-check comp is rendered identically to any other — **no "inactive" label** — because
the URL check has known false negatives (the reason the GET-retry hardening exists). The cap
of 2 is enforced by only ever adding 2 to `candidates`; a `live` comp scoring 91 still
outranks a failed-check comp scoring 90. If `poolForScoring` and the ≤2 allowance together
yield fewer than `limit`, return fewer — never pad with disqualified or sub-90 dead-link comps.
This replaces any notion of returning `[]` when all links are dead: such a report shows its
0–2 ≥90 comps if it has any, otherwise nothing.

**All six weights, the four score thresholds (0.40 price band, 500mi distance denominator,
45/180-day freshness knees, ±3yr), and `DEAD_LINK_SCORE_FLOOR` / `MAX_DEAD_LINK_COMPS` are
first guesses, defined as named constants in one place** — not measured optima.

### Creation-time pipeline (where the resource cost actually is)

URL validation makes real HTTP requests and happens once, at report creation, in
`fetch-marketcheck` / the LemonSqueezy webhook / `create-free` / the two supplementers. The
display selector above only _reads_ the stored flag. Order at creation:

```
clean (cleanAndFilterComparables — existing)
  → hard gates (§2: model, ±40% price; zero-price/zero-mileage already dropped by clean)
  → rank the survivors by weightedRelevanceScore
  → validateListingUrls in score order, batches of 20, in parallel within a batch,
     stop as soon as 10 pass (next batch only fetched if short — already implemented)
  → final selection reads the flags
```

Consequences:

- A comp that fails a hard gate is **never** URL-checked.
- `validateListingUrls` sets `url_validated: true | false` only on comps it actually checked;
  comps never reached (below the early-stop point) are left `undefined`, not `false`. This is
  what makes the §3 `failedCheck` set mean "checked and failed" rather than "unknown". In
  practice a ≥90 comp ranks into the first batch and is always checked — the flag change makes
  that correct rather than incidental.
- `validateListingUrls`'s `sortFn` is `weightedRelevanceScore` desc (today it defaults to
  `dos_active` ascending), so the comps most likely to be shown are validated first.

### `withinValuationBand` is removed

The 0.40 hard gate plus the price-plausibility sub-score now govern price. Keeping the
progressive band as well would filter on price twice with different cut-offs.

### `rankByBestMatch` (URL-validation ordering)

There is exactly **one** ranking function after this release: a pure
`weightedRelevanceScore(comp, subject, predictedPrice)` plus a thin sort wrapper.

- `selectDisplayComparables` uses it for the displayed set.
- `url-validator`'s check-order `sortFn` uses it too, so the comps most likely to be displayed
  get their links checked first. The subject fields it needs (`model`, `trim`, `predictedPrice`)
  are already in scope at that call site (`subjectVehicle` + `marketcheckResult.data`).
- `rankByBestMatch` keeps its exported name and call shape for compatibility; its body becomes
  "sort by `weightedRelevanceScore` desc". `RankSubject` widens to include optional `model`
  and `trim`. `getBestMatchListings` and `withinValuationBand` are removed — their callers move
  to `selectDisplayComparables`.

---

## Report date + per-comp links

Read-only surfacing; no schema change.

- **Retrieval date:** render `valuation.generatedAt` (already stored) as
  "Comparable listings retrieved &lt;Month D, YYYY&gt;" near the comps table on the web view,
  the print page, and the PDF. Use the existing Eastern-time date formatter (PR #135).
- **Per-comp link:** each displayed comp shows its `vdp_url` as a link. The web view already
  does; confirm and add for the print page and the PDF (`@react-pdf/renderer` `<Link>`).
  A comp with no `vdp_url` at all shows plain text (only reachable on the `linkDataUnavailable`
  fallback path). A ≥90 failed-check comp keeps its link rendered normally — the check has
  false negatives and the link may well work.

---

## Testing (TDD — failing test first, every step)

### New — `weightedRelevanceScore(comp, subject, predictedPrice)`

- each factor in isolation drives ordering when others are held equal
- each **subject-side** missing/zero input (`subject.mileage`, `subject.year`,
  `predictedPrice`, `subject.trim`, `subject.zip`) → that factor is 0.5 for all comps, no NaN
- **comp-side** missing: distance `null` → 0.15; `dom` `null` → 0.5; `trim` unknown → 0.5
- score stays within 0–100 for extreme inputs
- a comp near-identical to the subject on every factor scores ≥ 90; a merely "good" comp
  (close mileage, mediocre on the rest) stays well below 90 — guards the `DEAD_LINK_SCORE_FLOOR`

### New — `selectDisplayComparables`

- drops model-mismatch, zero/negative price, missing mileage, price >40% off
- returns only `url_validated === true` comps in the normal case
- `url_validated === undefined` (never checked) comps are excluded — neither `live` nor
  `failedCheck`
- report with **no** `url_validated` field on any comp → returns the gated set, ordered by score
- primary ≥ `limit` live → fallback_search comps never appear
- primary < `limit` live → fallback_search comps are scored in and can appear
- missing `source_tier` treated as primary
- **≥90 failed-check allowance:** two failed-check comps scoring ≥ 90 are included and rendered
  with no distinguishing marker; a third is not (cap); a failed-check comp scoring 89 is not;
  a `live` comp scoring 91 outranks a failed-check comp scoring 90
- all links failed but ≥1 comp scores ≥ 90 → returns those (≤2), not `[]`
- all links failed and none ≥ 90 → returns `[]`
- fewer than `limit` eligible → returns fewer; never pads with disqualified or sub-90 dead comps
- empty `listings` / missing `valuation` → returns `[]`
- ordering matches `weightedRelevanceScore` desc

### Updated

- `__tests__/lib/utils/comparables-ranker.test.ts` — retune from tier assertions to score
  assertions; drop `withinValuationBand` and `getBestMatchListings` cases
- `__tests__/lib/utils/url-validator.test.ts` — never-checked comps end up `url_validated:
undefined`, not `false`; check order follows the supplied score `sortFn`
- creation-path test (`fetch-marketcheck` route or supplementer): a comp failing a hard gate
  is filtered out before `validateListingUrls` is called (assert it's not among the checked set)
- the three render call sites' existing expectations

### Regression gate

`npx jest` → **0 net-new failures** over the recorded 53-failing baseline (CLAUDE.md).
`npx tsc --noEmit` and `npx eslint` clean on every touched file.

---

## Production verification (before calling it done)

1. **Parity:** for ~10 recent paid reports, regenerate the PDF and compare its comp table to
   the live `/view` comp table — every row must match (same VINs, same order).
2. **KPI shift:** re-run `docs/analysis/build-comp-selection-dataset.cjs` pointed at the new
   selector's output; record the link-filtered ("floor") medians (mileage gap %, distance,
   days-on-market, % same-state) in the PR description, next to the pre-change numbers.
3. **Doc:** re-read `docs/comp-selection-process-2026-08-26.md` against the merged code; fix
   any mismatch; commit it.
4. Follow the workspace standing rule: a merged PR is not proof — after deploy, pull one real
   report in production and confirm web and PDF agree.

---

## Rollout

- Branch `comp-selection-unified` off `comp-selection-refinements`.
- Implement task-by-task with TDD; commit per task.
- One PR → `main`. The PR body notes it also brings PR #137 and the whole
  `comp-selection-refinements` line with it, and lists the verification results.
- **Claude never merges.** Skip reviews the Vercel preview, checks web/PDF parity there, merges.
- Outside the three Q4 workstreams — has Skip's explicit go-ahead as enabling work for
  Workstream 3.

---

## Risks & mitigations

| Risk                                                                                           | Mitigation                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-link filter leaves many reports with <10 comps (floor analysis: ~9/25 recent)             | Accepted and expected — fewer accurate comps beats padding with dead links. The two-tier pool, the `linkDataUnavailable` fallback, and the ≤2 ≥90 failed-check allowance all soften it. Surface the per-report shown-count in the PR.                                                                 |
| The ≥90 failed-check allowance re-admits a genuinely dead listing                              | Bounded: at most 2 per report, and only at a score reachable by a near-identical car. The URL check has real false negatives (a link that opens fine but fails HEAD+GET), so ≥90 comps are the ones most worth the benefit of the doubt. Tunable via `DEAD_LINK_SCORE_FLOOR` / `MAX_DEAD_LINK_COMPS`. |
| Trim matching is unreliable (verbose VIN-decoder trim vs MarketCheck short trim)               | Weight is only 0.10; `unknown` maps to neutral 0.5 so it never dominates. Noted as tunable.                                                                                                                                                                                                           |
| Weights are guesses; the new order could look worse on some reports                            | Verification step 2 quantifies the shift on real reports before merge; weights are one-place constants for fast iteration.                                                                                                                                                                            |
| Big unmerged branch + this on top = large PR                                                   | Unavoidable — the branch was never merged. PR description walks the reviewer through it task-group by task-group. Every task is independently tested.                                                                                                                                                 |
| `comp-selection-refinements` local working tree / stale worktree confusion in the website repo | Implementation starts by confirming a clean checkout of `comp-selection-refinements` (or a fresh `git worktree`), not the half-state currently on disk.                                                                                                                                               |
| Older reports with no `source_tier` and no `url_validated`                                     | Explicit fallbacks: missing tag → primary; no link data anywhere → gated set. Both covered by tests.                                                                                                                                                                                                  |

---

## Assumptions to confirm

- `comp.dos_active` / `comp.dom` are present on stored comps often enough for the freshness
  factor to matter (probe showed they are on recent reports). If absent, factor is neutral.
- `subject.trim` is reachable at all three call sites (`report.vehicle_data.trim` on web/print;
  `data.autodevVinData.vehicle.trim` or equivalent on PDF). Confirm the PDF path during
  implementation; if not available there, the PDF passes `undefined` and trim scores neutral.
- `report.marketcheck_predicted_price` (or `valuation.predictedPrice`) is in the Supabase
  select on the web path — add to the select list if missing.

---

## Changelog

- **2026-08-27** — spec created from the session brainstorm. Supersedes the ranking approach
  in `comp-selection-refinements`'s own plan (tier sort → weighted score) and adds the
  live-link filter, `source_tier` tagging, and date/URL surfacing. Item 4 (pool tiers)
  revised per Skip: franchise + independent combined as one primary tier, nationwide fallback
  only on a <10 shortfall.
- **2026-08-27 (same session)** — added per Skip: (1) hard gates run before `validateListingUrls`
  at creation time so gated comps are never URL-checked; (2) documented the existing batched
  early-stop URL validation (batch 20, stop at 10) and pointed its `sortFn` at the weighted
  score; (3) `validateListingUrls` leaves never-checked comps `url_validated: undefined`;
  (4) the ≤`MAX_DEAD_LINK_COMPS` (2) failed-check comps scoring ≥ `DEAD_LINK_SCORE_FLOOR` (90)
  allowance, rendered unlabelled — replaces the "return `[]` when all links dead" rule.

## Read log

- (none yet)
