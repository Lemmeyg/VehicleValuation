# Follow-up to PR #140 — comp supply, link-failed back-fill, and empty-comps handling

## Status

- **Status:** Implementation spec — for the PR _after_ #140 merges. Not started.
- **Base:** `main` **after PR #140 lands** (the `comp-selection-unified` work). All file/line
  references below assume post-#140 code — see _Note on the handoff doc_ for why the
  `marketcheck-empty-comps-handoff-2026-08-28.md` line refs are stale.
- **Checkpoint:** none — enabling work for Workstream 3 (report/preview conversion), same as #140.
- **Repos:** code in `../Vehicle Comparison Site`. This spec lives in the workspace.

---

## Plain-language summary (for Skip)

Two separate reasons a report ends up with too few comparables, and this fixes both:

1. **We stored enough comps, but the "is the listing link still live?" check throws out
   70–90% of them.** PR #140's QA showed one report dropping from 10 rows to 1 for this reason.
   The link checker has real blind spots — dealer sites block automated checks, Cloudflare
   challenges them — so a lot of "dead" links actually work fine in a browser. **Fix:** when
   the live set is under 10, fill the rest from the best-ranked comps whose link _check failed_
   but that still pass the price/mileage/model sanity checks — preferring the ones that failed
   for a "probably a bot-block" reason over a hard "page not found".

2. **MarketCheck sometimes returns zero itemised listings, and our backup search recovers
   nothing** — usually because we send it the wrong model name ("Civic Coupe" instead of
   "Civic"). One paid customer (`63cf7f1b`) got a valuation with a completely blank comps
   table. **Fix:** normalise the model name before the backup search, add logging so the next
   occurrence is diagnosable, and decide what the report should say when there genuinely are no
   local listings.

None of this blocks #140 — see _Should #140 merge now?_.

---

## Should #140 merge now?

**Yes — merge #140 as-is, then ship this as the immediate next PR.** Reasoning:

- #140 is a strict improvement on what customers see today: it removes `$0` / "call for price"
  rows and comps priced 60%+ away from the report's own valuation, and makes the web report,
  print page, and PDF finally agree. Every comp it shows is better than the status quo.
- Its one downside — a minority of reports showing 1–2 comps instead of 10 — is _less bad_
  than the status quo on those same reports (10 rows of mostly-`$0` noise). One solid comp
  beats ten unusable ones in a dispute.
- Holding #140 to bundle this work means the `$0`-junk and the three-way web/print/PDF
  disagreement keep shipping for however long this follow-up takes.
- #140 has been through full review + a final whole-branch review + live-preview QA with zero
  regressions.

**Gate before you merge:** open `docs/qa/pr140-shots/8760e865.png` and `d5c7df67.png` and
confirm you're OK with a 1–2 row comparables table being live for the ~1–2 weeks until this
follow-up ships. If that's not acceptable, the alternative is a **~10-line change added to
#140** (Part A step 1 below, minimal version: lower `DEAD_LINK_SCORE_FLOOR` to ~35 and fill
toward `limit`) — but that means re-running #140's review + QA, which costs more than it saves.
Recommendation: merge, don't re-open.

---

## Part A — display-time link-failed back-fill

**Where:** `lib/utils/comparables-ranker.ts` (`selectDisplayComparables`),
`lib/utils/url-validator.ts`, `lib/utils/comp-relevance-score.ts` (constants).

### A1. Loosen the back-fill in `selectDisplayComparables`

Today (post-#140), the assemble step admits at most `MAX_DEAD_LINK_COMPS` (2) failed-check
comps and only if they score ≥ `DEAD_LINK_SCORE_FLOOR` (90). The final review already noted 90
is near-unreachable in practice, so this back-fill almost never fires — which is why the
Altima report stays at 1.

Replace the `deadBudget` / `deadAllowance` logic with:

```ts
// when the live pool can't fill the table, back-fill from the best-ranked
// comps whose link check FAILED but that still pass every hard gate.
if (poolForScoring.length < limit) {
  const need = limit - poolForScoring.length
  const backfill = failedCheck
    .filter(c => passesHardGates(c, subject, predictedPrice)) // model / priced / ±40% — unchanged
    .sort(byLinkFailurePreference) // see A2
    .sort((a, b) => score(b) - score(a)) // then by weighted score (stable)
    .slice(0, need)
  return [...poolForScoring, ...backfill].sort((a, b) => score(b) - score(a)).slice(0, limit)
}
```

- **No `DEAD_LINK_SCORE_FLOOR`.** The hard gates already reject junk; a comp that passes them
  is a legitimate match regardless of the link check. (Keep the constant only if a _low_ floor
  — e.g. 25–30 — turns out to help exclude genuinely-terrible matches in testing; decide with
  data, not upfront.)
- **`MAX_DEAD_LINK_COMPS` → remove or rename to `BACKFILL_MAX` and default it to `limit`.**
  Optionally keep a hard cap (e.g. `Math.min(need, 8)`) so a report never shows _only_
  link-unconfirmed rows — decide after A3 shows the real live/unconfirmed split.
- **Still unlabelled** in the UI (Skip's earlier call — a failed HEAD+GET is _uncertain_, not
  confirmed dead).
- The `full live slate → no back-fill` behaviour is unchanged (only kicks in on a shortfall).

### A2. Record _why_ a link check failed, and prefer transient failures

`lib/utils/url-validator.ts` already sees the HTTP status / error for every check. Classify each
failed check and carry it on the listing:

| Class        | Trigger                                                  | Meaning                                         |
| ------------ | -------------------------------------------------------- | ----------------------------------------------- |
| `dead`       | 404, 410, DNS failure, connection refused                | listing almost certainly gone                   |
| `blocked`    | 403, 429, 503-with-challenge, Cloudflare/Imperva markers | bot-block — link very likely works in a browser |
| `transient`  | timeout, 5xx (non-challenge), network reset              | inconclusive — retry-worthy                     |
| `redirected` | cross-host redirect, or redirect to `/` / 1-segment path | listing pulled, dealer homepage now             |

Store it as `url_check_result?: 'valid' | 'dead' | 'blocked' | 'transient' | 'redirected'` on
each listing, alongside the existing tri-state `url_validated` (keep the boolean for
back-compat — every existing reader uses truthiness). `valid` ⇔ `url_validated === true`.

`byLinkFailurePreference` orders the back-fill: `blocked` and `transient` first, then
`redirected`, then `dead` last (or exclude `dead` entirely — decide from A3 data).

### A3. Log the live / back-filled split per report

From `selectDisplayComparables` (or the render call sites), emit a structured line:
`{ reportId, shown: N, live: L, backfilled: { blocked, transient, redirected, dead } }`.

This is the measurement that tells us whether the link checker itself is the problem: if
reports routinely show, say, 3 live / 7 back-filled, the real fix is upstream (looser VDP
heuristics, a real headless-browser check for the borderline ones, or trusting MarketCheck's
`dom`/`last_seen` freshness) — and this back-fill is a stopgap. Wire this into the same
observability as Part B.

### A4. Tests

- `comp-selection.test.ts`: live pool of 3 + 20 gate-passing `failedCheck` comps, `limit 10`
  → returns 10 (3 live + 7 back-filled), back-filled ordered by score, `blocked`/`transient`
  chosen ahead of `dead`.
- Full live slate + `failedCheck` present → still no back-fill.
- `failedCheck` comps that fail a hard gate are never back-filled.
- `url-validator.test.ts`: a 403 response → `url_check_result: 'blocked'`; 404 → `'dead'`;
  timeout → `'transient'`; homepage-redirect → `'redirected'`; all with `url_validated` still
  `false`.

### A5. Verify

Re-run the PR #140 Playwright QA (`docs/qa/` scripts, re-pointed at the new preview) on the
same 10 reports. Expected: Altima 1 → ~10, F-150 2 → ~10, Sienna 7 → 10, Highlander 9 → 10;
the 6 already at 10 unchanged; every added comp still within ±40% of the estimate; the
live/back-filled split logged and eyeballed.

---

## Part B — creation-time comp supply (from the handoff doc)

Source: `docs/marketcheck-empty-comps-handoff-2026-08-28.md`. My review of that doc follows,
then the work items re-anchored to post-#140 code.

### Review of the handoff doc

- **Solid investigation.** The root-cause hypothesis — the fallback search sends the
  VIN-decoder's `"Civic Coupe"` verbatim while MarketCheck's inventory index uses `"Civic"` +
  a separate body-style — is plausible and correctly hedged (couldn't be confirmed: prod logs
  expired, API key IP-locked). The alternatives it lists (webhook VIN re-decode failing →
  `subjectVehicle` undefined; genuinely thin inventory for a discontinued 2-door; endpoint
  error) are real and shouldn't be dismissed.
- **§3.1 (observability first) is exactly right** and should be item 1 of this whole follow-up
  — it's cheap, and it makes §3.2–3.5 _and_ Part A A3 diagnosable instead of guesswork.
- **§3.2 (model / body_type split) — agree; the handoff doc's upgraded version is right.**
  A Vercel-Preview probe (PR #141, since closed) _confirmed_ the root cause and showed bare
  `model=Civic` pulls a sedan-dominated set — so **split** the body-style token into a separate
  `body_type=Coupe` param rather than discarding it, and only fall back to bare `model` if
  `model+body_type` returns < 10. Keep the "do **not** first-word-truncate" caveat (breaks
  "Grand Highlander" / "Model S" / "IONIQ 5" etc.). The decoder's own body field is too coarse
  (`autodev_vin_data.body = "Car"`) — the body style is only in the trailing token on `model`.
- **Probe-2 side finding — carry it forward:** all 98 recovered listings came back
  `url_validated: false`. Either a Preview-env artefact or a real weakness validating
  supplemented listings. It doesn't change the diagnosis, but it makes the Part A back-fill
  the thing that actually gets recovered comps onto the report — verify both together.
- **§3.3 (geo-aware fallback)** — worth doing, but it genuinely overlaps
  `docs/live-comp-distance-ranking-design`. Treat as a _decision_, not a given: either fold it
  into that branch's scope or do a minimal "pass `zip` + progressive `radius` 100/250/500" here.
- **§3.4 (widen the query year, not just post-fetch)** — agree, low cost, do it alongside §3.2.
- **§3.5 (customer-facing empty-comps behaviour)** — my lean: **explicit copy line** ("No
  active local listings found; this valuation is based on N statistical comparables from
  MarketCheck") **+ flag the report for manual review** (the admin radius-corrected-report flow
  already exists). **Do not gate delivery on a minimum comp count** — that would hold up
  legitimately-thin markets and hurt conversion, and the valuation itself is still sound.
- **§6 scope-out is correct** — don't try to "fix" MarketCheck's primary 0-return.

### Note on the handoff doc's stale references

It was written against `origin/main` @ `7fa37e0c`. **PR #140 modified every file it points at**
— `fetchMarketCheckSearchFallback` now tags `source_tier`; `supplementComparables` /
`dealer-type-supplementer` / `fetchAndValidatePage` now **gate listings before URL validation**
and order the check by weighted score; `comparables-supplementer.ts` line numbers have shifted.
Re-locate each reference in post-#140 code before editing. In particular, §3.2's model-name
normalisation must slot in **before** the new `gateListings(...)` call in the supplement path.

### Work items (re-anchored, in order)

**B1. Observability (do first).**

- `fetchMarketCheckSearchFallback`: write an `api_call_logs` row per attempt —
  `endpoint: '/v2/search/car/active'`, exact `make`/`model`/`year`/`start` sent, `num_found`,
  listings returned, `success`, error string.
- `supplementComparables` **and** `supplementWithAlternateDealerType`: one structured record
  each capturing the exit reason (`validCount >= MIN_VALID`, `subjectVehicle` missing,
  `mileage`/`zip` null, `apiKey` missing, pass-1 `null`, post-gate empty _(new after #140)_,
  post-filter empty), `validCount` in, listings out, `supplemented` boolean.
- Fold Part A's A3 split-logging into the same mechanism.

**B2. Split model + `body_type` for the fallback search** (confirmed root cause — handoff §2).

- New `splitModelAndBodyType(model)`: a trailing body-style token → `{ model: base, bodyType:
<MarketCheck value> }` (`Coupe`/`Sedan`/`Hatchback`/`Convertible`/`Pickup`/`SUV` — verify the
  full set in the docs). Not a trailing body-style token → `{ model }` unchanged. Never strip
  to empty. Do **not** first-word-truncate.
- `fetchMarketCheckSearchFallback` search ladder: `model=<base>&body_type=<bt>&year` → if
  `< 10` and a `body_type` was sent, retry bare `model=<base>` (keep the mixed set, ranked) →
  if still 0, drop `year` → if still 0, bare model + no year. Cap 4 attempts; log each (B1).
- No change to `comparables-supplementer.ts:150` — the split is internal to
  `fetchMarketCheckSearchFallback` now.

**B3. Progressive year widening in the query** (not just post-fetch `applyYearFilter`): if B2
still yields 0, widen the `year` sent to the search (or drop it) before concluding "no comps".

**B4. Empty-comps customer-facing behaviour** (§3.5 decision above): explicit copy line in the
report + flag for manual review. No delivery gate.

**B5. Geo-aware fallback search** — _decision pending_: fold into
`docs/live-comp-distance-ranking-design` or do the minimal zip+radius version here.

### Part B verification

Per the handoff doc §4, adjusted:

1. Deploy B1, then create a test paid report for a discontinued body-style variant (Civic
   Coupe, e.g. VIN `2HGFC3B33HH351102`, ZIP `14450`, ~78k mi) — or wait for a natural
   recurrence — and read the new `api_call_logs` rows to confirm which branch failed.
2. Deploy B2, re-run the same test report → `comparables_supplemented = true`, non-empty
   `recentComparables.listings`.
3. Regression: re-run "Grand Highlander", "Wrangler Unlimited", "Model S", "Prius c",
   "IONIQ 5", "F-150", "Odyssey" — counts must not drop.
4. Confirm on a real production report, not just the merged PR (CLAUDE.md convention).

---

## Sequencing for the follow-up PR

1. **B1 observability** — cheap, unblocks diagnosis of everything else.
2. **B2 model normalisation + B3 year widening** — the concrete "empty table" fix.
3. **A1–A2 display back-fill + failure-reason classification** — the "thin table" fix.
4. **A3 split-logging** (into B1's mechanism).
5. **B4 empty-comps copy + manual-review flag.**
6. **B5 geo-aware fallback** — only if not absorbed by the distance-ranking branch.
7. Verification: Part A QA re-run + Part B test-report flow + production confirmation.

Reasonable as **one PR** (all comp-supply/selection, tightly related) or split 1–2 (creation)
from 3–4 (display) if review size is a concern.

---

## Changelog

- **2026-08-28** — created from the PR #140 preview-QA findings (link check drops 70–90% of
  every pool; 4/10 test reports fell below 10 comps, 2 hard) and a review of
  `docs/marketcheck-empty-comps-handoff-2026-08-28.md` (empty comps on report `63cf7f1b` —
  fallback search sent `"Civic Coupe"` instead of `"Civic"`, no observability). Recommends
  merging #140 as-is first.
- **2026-08-28 (rev)** — reconciled with the upgraded handoff doc after a Vercel-Preview probe
  (PR #141, closed) **confirmed** the root cause and showed bare `model=Civic` returns a
  sedan-dominated set. §3.2 fix changed from "strip the body-style suffix" to "**split** it
  into `model` + `body_type`, fall back to bare model only if `< 10`". Added the probe-2
  `url_validated: false`-on-all-98 side finding (verify with Part A). Impl plan Task 3 rewritten
  to match.

## Read log

- 2026-08-28 — read `docs/marketcheck-empty-comps-handoff-2026-08-28.md` in full and the PR
  #140 QA results (`docs/qa/2026-08-28-pr140-preview-test-results.md`, gate-breakdown data) to
  produce this spec.
