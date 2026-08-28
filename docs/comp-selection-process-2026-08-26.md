# How comparable listings get picked, today

_Reference doc, now committed to git (it was deliberately kept uncommitted through the
earlier tracing passes; the comp-selection unified release commits it). Originally traced the
code as of 2026-08-26 on `main`; rewritten 2026-08-27 to match the merged
`comp-selection-unified` release (branch `comp-selection-unified`, spec
`docs/plans/2026-08-27-comp-selection-unified-release.md`), which brought PR #137 and the whole
`comp-selection-refinements` line to `main` in one PR and closed its two remaining gaps
(dead links could still show; ranking used rule-of-thumb tiers instead of a score). Covers the
automatic process every normal report goes through. The manual "Fix Comps" admin tool is a
short note at the end, not part of the main walkthrough._

---

## The short version

When a customer clicks "Continue" after entering their VIN, mileage, and ZIP, the app asks a
data vendor called **MarketCheck** for two things: a price estimate, and a list of similar
cars currently for sale. What happens next depends on whether MarketCheck can recognize the
exact car from its VIN. If it can, you get a clean, well-matched result. If it can't — common
for older or lower-volume cars — the app falls back to a blunter, nationwide search.

There are now **two clearly separate phases**, and the second one is new:

1. **At report creation** the app builds and stores a pool of listings: ask MarketCheck →
   clean out bad data → drop anything that fails a few hard rules ("hard gates") → rank what's
   left by a single 0–100 relevance score → check the links of the best-ranked ones until 10
   working links are found → if still short of 10, ask MarketCheck again (independent dealers,
   then a nationwide search). Every listing is tagged with where it came from and whether its
   link checked out.
2. **When the report is rendered** — the web report, the print page, and the downloadable PDF
   — a single shared function (`selectDisplayComparables`) reads that stored pool and picks
   the 10 rows to show, in order. All three call the same function, so they always agree.

The "comps in Hawaii" report that started this whole investigation came from the nationwide
fallback path plus the old rule-of-thumb ordering. Real distance is now computed offline for
every listing (never trusted from MarketCheck) and is the #2 factor in the score.

---

## Phase 1 — Building the stored pool (report creation)

This runs once, server-side, in the report-creation paths (`fetch-marketcheck`, the
LemonSqueezy webhook, and the admin `create-free` route). It is the only phase that makes real
HTTP requests to dealer sites.

### Step 1 — Ask MarketCheck for a price and some comps

The app sends MarketCheck the car's VIN, its mileage, and the customer's ZIP, and asks for a
price estimate plus a batch of similar cars currently listed for sale. This first call asks
for **franchise dealers** specifically (`PRIMARY_DEALER_TYPE = 'franchise'`). Independent
dealers are added later only if franchise alone doesn't yield enough working links (Step 6).

_Where: `lib/api/marketcheck-client.ts`, `fetchMarketCheckData()`; called from
`app/api/reports/[id]/fetch-marketcheck/route.ts` with `subjectVehicle` and `'franchise'`._

#### Fork: does MarketCheck recognize the VIN?

- **Yes →** Step 2A (the good path).
- **No** (MarketCheck can't decode the VIN — common for older, rare, or oddly-optioned cars)
  **→** the app re-asks a looser question: "forget the VIN — cars of this year, make, and
  model, from anywhere in the country." Step 2B.

This fork is invisible to the customer. The only after-the-fact signal is a database flag
(`marketcheck_fallback_used`) and the per-listing `source_tier` tag (below).

### Step 2A — VIN recognized (the good path)

MarketCheck returns real listings tied to that specific VIN lookup, plus its own price
estimate (treated as authoritative — MarketCheck's number, not one this app computes). Each
listing is tagged `source_tier: 'franchise'` (or `'independent'` when it comes from the
Step 6 dealer-type supplement). The listings are run through Step 3 cleanup before anything
else.

MarketCheck sometimes includes its own distance value on a listing; this app **ignores it**.
Distance is always recomputed offline (see _The weighted relevance score_).

_Where: `lib/api/marketcheck-client.ts`, inside `fetchMarketCheckData()`; the tag is set at
map time (`source_tier: dealerType`)._

### Step 2B — VIN not recognized (the fallback path)

The app asks MarketCheck's general search tool for cars matching year, make, and model only —
no VIN. It deliberately never sends a ZIP to this endpoint (passing one without also passing a
mile radius makes it return zero results), so MarketCheck hands back cars from anywhere in the
US. Each listing is tagged `source_tier: 'fallback_search'`.

This search tool produces no valuation of its own, so the app computes a placeholder price
itself: it runs the Step 3 cleanup first, then computes real offline distance for each cleaned
listing and averages only those within 750 miles of the customer, falling back to the full
cleaned set if nothing is that close. The **same cleaned set** is what gets stored as the
listing list — the raw search dump (with "call for price" $0 entries) is not stored.

This is the path report `b4503ff7` took, and why its comps were scattered across the country.
Real distance in the score (Step 7) is what keeps that from happening now.

_Where: `lib/api/marketcheck-client.ts`, `fetchMarketCheckSearchFallback()`._

### Step 3 — Cleanup rules (both paths)

Whatever came back is run through a fixed set of rules, in order:

1. Drop anything with 0 (or missing) miles — unsold new inventory isn't a real comparison.
2. Drop anything with 0 (or missing) price.
3. Drop exact duplicate VINs (keep the first seen).
4. Drop anything outside a model-year window of **3 years older to 1 year newer** than the
   subject car (a 2011 car keeps 2008–2012). Skipped only when the subject year is unknown.
5. Cap at **2 listings per dealer**, so one big-inventory dealer can't fill the report.

_Where: `lib/utils/comparables-cleaner.ts`, `cleanAndFilterComparables()` — constants
`MIN_YEAR_BELOW_SUBJECT = 3`, `MAX_YEAR_ABOVE_SUBJECT = 1`, `MAX_DEALER_LISTINGS = 2`._

### Step 4 — Hard gates

Before any link is checked, each remaining listing must pass four cheap field checks
(`passesHardGates`). Any failure disqualifies the listing outright — it is never URL-checked
and can never appear on the report:

- **Model must match.** If both the subject and the comp name a model and they aren't equal
  (case-insensitive), drop it.
- **Price must be present and above 0.**
- **Mileage must be present.** (0-mile listings are already gone from Step 3; this catches
  listings with no mileage field at all.)
- **Price must be within ±40% of the report's own predicted price**, when a predicted price
  exists. `|comp.price − predictedPrice| / predictedPrice > 0.40` → drop.

_Where: `lib/utils/comp-gates.ts`, `passesHardGates()` / `gateListings()`; run in
`fetch-marketcheck/route.ts` immediately before `validateListingUrls`. `PRICE_GATE_FRACTION =
0.4`._

### Step 5 — Check whether each listing's link works

Every listing with a link is visited by a quick automated check to confirm it still resolves
to a real, specific car page (not a dead link, the dealer homepage, or a generic inventory
list).

- **Check order is the weighted relevance score, highest first** — not "days on lot" as
  before. The route passes `makeScoreSortFn(subject, predictedPrice)` as the `sortFn`, so the
  listings most likely to be shown get their links checked first. (If no subject vehicle is
  available the validator falls back to its old default order, `dos_active` ascending.)
- It checks in **batches of 20**, each batch's requests in parallel, batches run one after
  another, and it **stops as soon as 10 working links** are found. Later batches are only
  fetched if earlier ones came up short — most listings are never checked.
- Each link gets a **HEAD request first**; if that fails it's **retried once with a full GET**
  before being marked dead (some dealer sites block HEAD specifically). Timeout is **8
  seconds**. A response of 200 or 405 passes; a cross-domain redirect or a redirect to a
  homepage / single-segment path fails.
- The result is written back as a **tri-state** `url_validated` flag on each listing:
  - checked and passed → `url_validated: true`
  - checked and failed → `url_validated: false`
  - never checked (ranked below the early-stop point) → **the key is absent** (not `false`)
  - no link to check → `url_validated: true` (the data is still valid, there's just no link)
- The check is known to produce **false negatives** — Skip has seen links marked "dead" open
  fine in a browser, almost certainly because some dealer sites block automated visitors. A
  "dead" mark means "our check couldn't confirm it," not "this listing doesn't exist." Step 7
  leans on this by still allowing up to 2 high-scoring failed-check listings onto a report.

_Where: `lib/utils/url-validator.ts`, `validateListingUrls()` — `BATCH_SIZE = 20`,
`TARGET_VALID = 10`, `VALIDATION_TIMEOUT_MS = 8000`._

### Step 6 — If fewer than 10 working links, go get more

Two supplements run in sequence, each only if the previous step is still short of 10 confirmed
links:

1. **Alternate dealer type.** A second MarketCheck VIN-matched call for **independent**
   dealers (the mirror of Step 1's franchise call). Still MarketCheck's own VIN-matched data.
   New listings are tagged `source_tier: 'independent'`.
   _Where: `lib/utils/dealer-type-supplementer.ts`, `supplementWithAlternateDealerType()`._
2. **Nationwide YMM search.** The same nationwide, no-distance search as Step 2B, tried with a
   widening model-year window (±2 → ±5 → no limit) until something returns results. Whatever
   comes back is re-run through the Step 3 cleanup — including the fixed −3/+1 year cap — so
   the widest stages mostly just help find _any_ results, not the years that end up shown. New
   listings are tagged `source_tier: 'fallback_search'`.
   _Where: `lib/utils/comparables-supplementer.ts`, `supplementComparables()`._

New listings are added on top of the existing pool; nothing is discarded and replaced. The
supplemented listings are also link-checked (inside those supplementers) so their
`url_validated` flags are set the same way.

The full stored pool — cleaned, gated, link-annotated, source-tagged — is what Phase 2 reads.

---

## Phase 2 — Picking the 10 shown (render time)

### Step 7 — One shared selector, three callers

The web report page, the print page, and the PDF template **all call the same function**,
`selectDisplayComparables(valuation, subject, limit = 10)`. There is **no separate per-surface
ranking** — the earlier "each page recalculates it the same way" situation is gone; there is
one function and three callers of it. The web and print pages run it live on each request; the
PDF runs it once at generation time (a snapshot). Same function, same stored data → identical
rows and identical order.

`subject` is `{ year, mileage, zip, model?, trim? }`. The predicted price is read straight out
of the stored `valuation`. What the selector does, in order:

1. **Source the pool.** `valuation.recentComparables.listings`, or `[]`. Empty → return `[]`.
2. **Hard gates again.** Re-runs `gateListings` (Step 4's rules) defensively. Nothing left →
   return `[]`.
3. **Live-link filter (split).**
   - If **no** surviving listing carries a `url_validated` field at all → the report predates
     link validation; treat the whole gated set as "live" (the `linkDataUnavailable` fallback).
   - Otherwise: `live` = listings with `url_validated === true`; `failedCheck` = listings with
     `url_validated === false`; listings that were **never checked** (`url_validated` absent)
     are set aside — they are in neither set.
4. **Two-tier pool.** `livePrimary` = live listings whose `source_tier` is **not**
   `'fallback_search'` (franchise + independent combined; a missing tag counts as primary).
   If `livePrimary` has at least `limit` listings, score only those. Otherwise score all of
   `live` (primary and nationwide-fallback together, competing freely — no pinning).
5. **Weighted relevance score.** Score every listing in that pool 0–100 (see next section).
6. **Failed-check back-fill (the ≤2-at-≥90 allowance).** If the scored live pool already has
   `limit` or more listings, no failed-check listing is admitted. Otherwise, take failed-check
   listings scoring **≥ 90** (`DEAD_LINK_SCORE_FLOOR`), highest first, at most **2**
   (`MAX_DEAD_LINK_COMPS`), to back-fill the shortfall — including the case where zero links
   survived. They're rendered with **no "inactive" label** (the check has false negatives).
7. **Sort by score descending, take the top `limit`.** If the pool plus the ≤2 allowance is
   still fewer than `limit`, the report shows fewer — it is never padded with disqualified or
   sub-90 dead-link listings. All links dead and none scores ≥ 90 → the report shows no comps.

A working link is therefore still not a hard requirement to appear — but it is now a strong
preference (only the two-tier `live` pool competes normally; failed-check listings need a ≥90
score and are capped at 2), where before link status only affected which listings got checked.

_Where: `lib/utils/comparables-ranker.ts`, `selectDisplayComparables()`. Callers:
`app/reports/[id]/view/page.tsx` (line ~237), `app/reports/[id]/print/page.tsx`,
`lib/pdf/report-template.tsx` (line ~901)._

---

## The weighted relevance score

One pure function, `weightedRelevanceScore(comp, subject, predictedPrice)`, returns a number
from **0 to 100** (rounded to one decimal). It is the single ranking signal — used both to
order the displayed set (Step 7) and to order link-checking at creation (Step 5). It replaced
the old lexicographic "year, then distance band, then price band, then mileage" tiering
entirely.

Each factor produces a 0–1 sub-score; the weighted sum is scaled to 0–100. If a **subject-side**
input is missing or zero (`subject.mileage`, `subject.year`, `predictedPrice`, `subject.trim`,
`subject.zip`), that factor returns the neutral **0.5** for every comp, so it neither divides
by zero nor skews the ranking.

| Factor                 | Weight   | Sub-score                                                                                                                    |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Mileage closeness**  | **0.35** | `1 − min(\|comp.miles − subject.mileage\| ÷ subject.mileage, 1)`. Comp with no mileage → 0.5.                                |
| **Distance closeness** | **0.25** | Real miles `d` from `computeDistanceMiles(subject.zip, comp)`; `d == null` → **0.15**; else `1 − min(d ÷ 500, 1)`.           |
| **Price plausibility** | **0.15** | `predictedPrice` known: `1 − min(\|comp.price − predictedPrice\| ÷ predictedPrice ÷ 0.40, 1)`; else 0.5.                     |
| **Trim match**         | **0.10** | `tokenTrimMatch(subject.trim, comp.trim)` → exact **1.0** / partial **0.5** / none **0.15** / unknown **0.5**.               |
| **Listing freshness**  | **0.10** | `dom = comp.dos_active ?? comp.dom`; `null` → 0.5; `≤ 45` days → 1.0; `≥ 180` → 0; else linear between (`1 − (dom−45)÷135`). |
| **Year closeness**     | **0.05** | `1 − min(\|comp.year − subject.year\| ÷ 3, 1)`. Comp with no year → 0.5.                                                     |

`score = round( clamp01( Σ weightᵢ × sub_scoreᵢ ) × 100, 1 decimal )`

`tokenTrimMatch` lower-cases both trims, strips punctuation to spaces, splits into tokens:
identical token strings → `exact`; any shared token → `partial`; no overlap → `none`; either
side empty/missing → `unknown`.

**Every weight and threshold above is a first guess, not a measured optimum** — the six
weights, the ±40% price band, the 500-mile distance denominator, the 45/180-day freshness
knees, the ±3-year span, and `DEAD_LINK_SCORE_FLOOR` (90) / `MAX_DEAD_LINK_COMPS` (2) are all
named constants defined in one place, **`lib/utils/comp-relevance-score.ts`** (the selector in
`comparables-ranker.ts` imports the two dead-link constants from there). Tune them there.

---

## The variables, at a glance

| Variable                                | Used to **select** (include/exclude)?                                                                                                                                                           | Used to **rank** (order)?                                                 | Notes                                                                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Year**                                | Yes — hard cutoff, subject year −3 to +1 (Step 3 cleanup); also a hard gate is _not_ applied to year at display time                                                                            | Yes — weighted score factor, weight **0.05** (lowest)                     | The −3/+1 window is re-applied by every cleanup pass, including the widening nationwide supplement.                                                                                                                            |
| **Make**                                | Yes — MarketCheck is asked for this make specifically                                                                                                                                           | No                                                                        | Guaranteed by the search itself, so not a scoring factor.                                                                                                                                                                      |
| **Model**                               | Yes — asked for in the search, **and** a hard gate: comp model must equal subject model (case-insensitive) when both are present                                                                | No                                                                        | The gate is new — it runs before link-checking and again inside the display selector.                                                                                                                                          |
| **Vehicle mileage**                     | Partly — a hard gate drops any comp with **no** mileage value (0-mile already gone in cleanup); mileage size never excludes                                                                     | Yes — weighted score factor, weight **0.35** (highest)                    | A very different mileage lowers a comp's score but never removes it.                                                                                                                                                           |
| **ZIP code**                            | Indirectly — sent to MarketCheck on the VIN-lookup path for price localization; never sent to the nationwide search                                                                             | Indirectly — it's the origin point for the distance factor                | Distance, not ZIP itself, drives ranking — see the next row.                                                                                                                                                                   |
| **Distance from subject ZIP**           | No — a far listing is ranked worse, never excluded                                                                                                                                              | Yes — weighted score factor, weight **0.25** (2nd highest)                | **Real miles, computed offline** from the listing's own ZIP centroid (`zipcodes` package) or its raw lat/long when it has no ZIP. **MarketCheck's own distance field is never used.** Unknown distance → a low 0.15 sub-score. |
| **Trim**                                | No                                                                                                                                                                                              | Yes — weighted score factor, weight **0.10**                              | `tokenTrimMatch`: exact 1.0 / partial 0.5 / none 0.15 / unknown (either side missing) 0.5. Deliberately low-weight — VIN-decoder trims and MarketCheck trims often disagree.                                                   |
| **Days on market** (`dos_active`/`dom`) | No                                                                                                                                                                                              | Yes — weighted score factor ("listing freshness"), weight **0.10**        | `≤ 45` days → best, `≥ 180` → worst, linear between; missing → neutral 0.5. Also the _default_ link-check order when no subject vehicle is available.                                                                          |
| **Price vs. predicted valuation**       | Yes — a hard gate drops any comp more than **±40%** off the report's predicted price (when a predicted price exists)                                                                            | Yes — weighted score factor ("price plausibility"), weight **0.15**       | The old standalone `withinValuationBand` progressive filter is **removed** — the ±40% gate plus this sub-score now govern price, so it isn't filtered twice.                                                                   |
| **Active / working link**               | Soft — a `url_validated === false` comp is held out of the main pool but can still back-fill up to **2 slots** if it scores ≥ 90; a report with no link data at all falls back to the gated set | Indirectly — the two-tier live pool is scored ahead of failed-check comps | Tri-state flag: `true` / `false` / absent (never checked). Known false negatives; hardened with a HEAD→GET retry and an 8s timeout. Checked in weighted-score order at creation.                                               |
| **Dealer type** (`source_tier`)         | Soft — franchise + independent form the "primary" pool; `fallback_search` comps are scored in only when primary can't fill `limit` live comps                                                   | No (only gates which pool is scored)                                      | Tag set at creation: `'franchise'` (primary VIN call), `'independent'` (dealer-type supplement), `'fallback_search'` (nationwide search). Missing tag → treated as primary.                                                    |
| **Price / mileage = 0**                 | Yes — dropped in Step 3 cleanup on both paths; the fallback path stores the cleaned set too                                                                                                     | —                                                                         | Treated as bad data, not a real listing.                                                                                                                                                                                       |
| **Duplicate VIN**                       | Yes — duplicates dropped, first kept (Step 3)                                                                                                                                                   | —                                                                         |                                                                                                                                                                                                                                |
| **Listings per dealer**                 | Yes — capped at **2** per dealer (Step 3)                                                                                                                                                       | —                                                                         | Prevents one big-inventory dealer from dominating.                                                                                                                                                                             |
| **Certified pre-owned status**          | Requested as "no" by default                                                                                                                                                                    | No                                                                        | Rarely relevant; noted for completeness.                                                                                                                                                                                       |

_Resolved 2026-08-27 (this release): the earlier drafts of this doc left the same-state /
bordering-state ranking heuristic and the standalone valuation-band filter as open questions.
Both are gone — real distance replaces the state heuristic in the score, and the ±40% hard
gate plus the price-plausibility sub-score replace `withinValuationBand`._

---

## Report date and per-comp links (surfaced on all three paths)

Read-only additions, no schema change:

- **Retrieval date.** Each surface renders `valuation.generatedAt` as
  "Comparable listings retrieved &lt;Month D, YYYY&gt;" near the comps table — web view
  (`formatDateET`), print page, and PDF (`formatDateShort`).
- **Per-comp link.** Each displayed comp shows its `vdp_url` as a link on all three surfaces.
  A comp with no `vdp_url` shows plain text. A ≥90 failed-check comp still renders its link
  normally — the check has false negatives and the link may well work.

---

## One piece of code that looks relevant but isn't

`lib/utils/listing-filters.ts` defines a whole system for filtering and ranking listings — by
price, mileage, distance, dealer type, and more. It looks like the answer to "how are comps
selected." **It isn't.** The only part wired into a live page is a small stats-summary helper
(`getListingsStats` — average/min/max price, etc.), used by the web view and print page for
the summary numbers. None of its selection or ranking logic runs in the pipeline described
above. Worth knowing so it isn't mistaken for active code in a future investigation.

---

## Appendix — the manual "Fix Comps" admin tool

Built in PR #137, separate from everything above. An admin opens a specific report and clicks
a button, which:

- Re-tries Step 1 (the VIN lookup) once.
- If that still fails, searches nationwide the same way as Step 2B/6, but computes **real**
  distance for every listing itself (each listing's ZIP, offline, no MarketCheck) and keeps
  only those within a set radius (300 miles by default).
- Ranks survivors by closest mileage, preferring a working link but not requiring it.
- Writes the result to a **brand-new** report — the original is never changed.

It runs only when someone clicks it. It uses its **own** inline `zipcodes.distance` call
(`app/api/admin/reports/[id]/create-radius-corrected-report/route.ts`), not the shared
`lib/utils/geo-distance.ts` module the main pipeline's score uses — same offline method, still
two separate implementations.
