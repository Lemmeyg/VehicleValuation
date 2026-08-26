# Live comp distance & ranking — design

**Status:** Proposed — awaiting go/no-go. Not started.
**Author:** Claude, with Skip
**Date:** 2026-08-26

## Status block

- **Current status:** Scoped, not approved. No code written against this design.
- **Next action:** Skip reviews this doc and decides go / no-go / revise.
- **Checkpoint:** none set — this is not yet one of the three approved Q4 workstreams (see `CLAUDE.md`).

## Changelog

- 2026-08-26 — Initial draft, written after building and shipping the one-off
  `create-radius-corrected-report` admin tool (PR #137) for report `b4503ff7`,
  and after reviewing a prior research artifact ("Comp Relevance & Coverage
  Audit," 2026-08-25) that scored 77 purchased reports against a
  same-model/≤300mi/active-listing standard.

## Read Log

- 2026-08-26 — Took the "81% of comps fail the active-listing check" finding
  from the 2026-08-25 audit into this doc's framing, but flagged it as
  possibly overstated (Skip observed several "dead" links resolve fine when
  he clicks them manually — likely bot-detection blocking the automated
  checker, not real link rot). Not re-measured here; noted as an open risk.

---

## 1. The problem, in one sentence

The comparable-vehicle listings shown on a report are picked using a
same-state/bordering-state approximation instead of real distance, and there
is no fallback when that pool comes up short — both defects this quarter's
customer complaint (report `b4503ff7`) exposed, and both already fixed
one-off for that single report. This design generalizes that fix into the
normal, automatic report-creation flow so every future customer gets it,
not just the ones who complain.

## 2. What already exists (don't rebuild these)

Three pieces of relevant code already exist, built at different times for
different reasons, currently disconnected from each other:

| Piece                                      | Where                                                                          | What it does today                                                                                                                                                                                                       | Gap                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rankByBestMatch` / `getBestMatchListings` | `lib/utils/comparables-ranker.ts`                                              | Ranks candidate comps by year-closeness, then a same-state/bordering-state tier, then mileage-closeness. Used both to decide URL-check order and to pick the final displayed 10.                                         | The location tier is not real distance — a listing anywhere in a same or neighboring state ranks as "close" even if it's 400 miles away. This is the actual root cause of the customer complaint. |
| `supplementComparables`                    | `lib/utils/comparables-supplementer.ts`                                        | Fires automatically whenever a report ends up with fewer than 10 URL-validated comps. Re-queries MarketCheck's nationwide fallback search and widens the model-year window (±2 → ±5 → unlimited) in up to 2 extra pages. | No distance awareness at all — pulls from anywhere in the country.                                                                                                                                |
| `create-radius-corrected-report`           | `app/api/admin/reports/[id]/create-radius-corrected-report/route.ts` (PR #137) | Admin-only, manual, one report at a time. Computes real distance locally (offline ZIP math, no MarketCheck radius param), searches the standard year band, ranks by closest mileage, writes a _new_ report.              | No automatic trigger — someone has to notice a bad report and click a button.                                                                                                                     |

This design's job is to take the distance-computation approach already
proven in the third row and fold it into the first two, so it runs
automatically for every report instead of needing a human to notice a
problem first.

## 3. Two things this design does NOT do (per your answers)

- **Does not touch past, already-completed reports.** Existing reports keep
  whatever comps they were built with. The admin tool stays in place,
  unchanged, as the manual fix for a customer complaint about an old report.
- **Does not fix the URL-validation false-positive problem.** Skip's
  observation that many "dead" links are actually live (blocked bot, not a
  dead page) is a real, separate problem. This design treats
  `url_validated` as a _soft_ preference, never a hard filter, specifically
  so that problem can't silently throw away good comps — but fixing the
  checker itself is out of scope here.

## 4. Approaches considered

### Approach A — Compute distance at creation time, same request that runs today (recommended)

Extend the existing creation-time pipeline (`fetch-marketcheck` route →
`comparables-supplementer.ts`) so that, in the same server request a
customer already waits on at checkout, it:

1. Computes real distance for every candidate comp — from ZIP when the
   listing has one, or from raw latitude/longitude when it doesn't (the
   audit found roughly half of all comps carry only raw coordinates, no
   ZIP — the admin tool's version only handles the ZIP case, and would
   silently drop the other half; this design fixes that gap).
2. Runs a bounded ladder — same radius but check a wider model-year band,
   then accept fewer than 10 — stopping as soon as 10 real, in-radius comps
   are found, or the ladder is exhausted.
3. Ranks by closest mileage, with working links preferred but never
   required (per point 3 above).
4. Stores only the final ≤10 — same shape and size as what's stored today.

### Approach B — Compute distance at render/view time instead

Move the distance logic into `comparables-ranker.ts`'s
`getBestMatchListings`, so it runs fresh every time a report's `/view` page
loads or its PDF is (re)generated, instead of once at creation.

**Rejected.** Two problems: it requires the _wide_ MarketCheck pool to be
either stored (Supabase growth — see §5) or re-fetched on every view (a
repeated MarketCheck cost, and repeated multi-second latency, on every
single page load). It also means the raw data sitting in Supabase never
actually reflects a corrected, ranked set — only the rendered page does.
Approach A fixes the data once, cheaply; Approach B would keep re-deriving
it forever.

### Approach C — Approach A, plus keep the admin tool as-is

This is the actual recommendation: ship Approach A for all new reports,
change nothing about the admin tool, which keeps its separate job of fixing
individual already-existing reports on request.

## 5. Resource-usage impact — Vercel (Hobby) and Supabase (Free)

Both platforms confirmed via their own current docs/API, not assumed:

### Vercel

- **Function duration.** Checked this project's config: no `maxDuration`
  override anywhere (`vercel.json`, no per-route `export const maxDuration`),
  so the platform default applies. Per Vercel's current docs (checked
  2026-08-26), Hobby's default _and_ max function duration — with Fluid
  Compute, which has been the default execution model since before this
  project's plan tier snapshot — is **300 seconds**. The admin tool's
  worst-case run (8 year-searches + validation batches) took well under 30
  seconds in the actual production runs this session. Even a generous
  version of the same ladder run synchronously during checkout has
  enormous headroom before it risks a timeout. _(One thing worth confirming
  once, not re-deriving: check Project → Settings → Functions → Function
  Max Duration in the dashboard to be certain Fluid Compute is on for this
  project specifically, since I could not confirm that one flag through the
  API.)_
- **Added latency the customer feels.** This is the real constraint, not
  the platform's timeout. Every extra MarketCheck search call adds
  roughly 0.5–2 seconds of network wait, added directly to the "Continue"
  click at checkout — the single most conversion-sensitive moment in the
  funnel per this quarter's priorities. Recommendation: cap the _live_
  path's ladder more tightly than the admin tool's (e.g. stop after ~4-6
  extra search calls, not 16) so a thin local market degrades to "fewer
  than 10 comps, shown honestly" rather than a slow checkout. The admin
  tool keeps its more thorough, slower search for the cases someone
  actually complains about, where a customer isn't sitting there waiting.
- **Function bundle size.** The `zipcodes` package adds ~5.3MB of bundled
  ZIP-centroid data to whichever function(s) import it. Scoped to just the
  one or two routes in the creation pipeline (not the view page or PDF
  generator, per Approach A), this is trivial against Vercel's function
  size ceiling and does not touch any page the customer's browser loads
  directly.

### Supabase

- **Storage.** Approach A stores only the final ≤10 comps per report —
  identical in shape and size to what's stored today. No new table, no new
  column, no growth. (This is the concrete reason Approach A was chosen
  over anything resembling the prior audit's "store the whole wide pool"
  idea — that would trade a MarketCheck-cost problem for a Supabase-storage
  problem, on a free tier already capped at 500MB total.)
- **Queries.** Zero new database reads or writes beyond what the creation
  flow already does — the ZIP-distance lookup is pure in-memory
  computation (the `zipcodes` package), not a database call.
- **Bandwidth/egress.** No change — same JSON payload size in, same size
  stored, same size served back on `/view` or PDF download as today.

### What this does add cost to, off-platform

Not Vercel or Supabase, but worth naming since it's real: MarketCheck
search calls. The 2026-08-25 audit found today's fallback already fires on
92% of reports — this design doesn't create that number, it makes what
already happens on 92% of reports actually work (find real local comps)
instead of quietly returning nationwide junk. Expect a modest increase in
MarketCheck call _volume_ (more search-endpoint calls, which this
codebase already logs at $0 cost — only the one VIN-based prediction call
per report is the $0.09 one, and this design doesn't add extra calls to
that endpoint).

## 6. Open questions worth flagging, not answering here

- What is this MarketCheck account's actual plan-level radius cap? Never
  determined — the calibration approach that would have found it was
  abandoned in favor of computing distance locally instead, which sidesteps
  needing to know the answer. Worth knowing anyway if a _cheap first-pass_
  optimization (try a small, likely-under-the-cap radius search before
  falling back to nationwide-plus-local-filter) is ever worth adding later.
- The `url_validated` false-positive problem (Skip's observation) — real,
  unscoped, and the single largest lever on the audit's own numbers if the
  81% figure holds up under a corrected measurement. Recommend a follow-up
  investigation specifically on that, separate from this design.

## 7. Recommendation

Ship Approach C (A + keep the admin tool as-is) — but only after an
explicit go/no-go from Skip, since this isn't one of the three approved Q4
workstreams. The resource-usage case is clean on both platforms named;
the open question is priority against tracking/drip/conversion work, not
technical risk.
