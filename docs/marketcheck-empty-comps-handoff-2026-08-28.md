# Handoff: empty comparables list on report `63cf7f1b` — problem statement & proposed solution

**Date:** 2026-08-28
**Author:** investigation session (Claude)
**For:** the session working on the live comp/creation pipeline
**Repos:** analysis done against `Vehicle Comparison Site` @ `origin/main` (`7fa37e0c`); the three
files below are identical on `main` and on the `docs/live-comp-distance-ranking-design` branch.

---

## 1. Context

A paid report's PDF is built from MarketCheck data fetched in the LemonSqueezy webhook's
`after(...)` block. MarketCheck's premium prediction endpoint returns two things:

- **`comparables`** — a statistical aggregate (count, price/miles/dos percentiles) over a broad
  set of vehicles. This drives the headline value and price range. Listings are **not** itemised.
- **`recent_comparables`** — the actual individual active listings (VIN, price, miles, dealer,
  VDP URL) shown as the comps table in the report. This is the persuasive evidence a customer
  takes to their insurer.

When `recent_comparables` is thin, `supplementComparables()` is supposed to run a second,
broader search against `/v2/search/car/active` and stitch extra listings in.

---

## 2. Problem statement

**Report `63cf7f1b-0e67-4c60-9907-f7b0c786d747`** (2017 Honda **Civic Coupe** EX-T CVT,
78,000 mi, ZIP 14450 / New York, paid $20.52, `status = completed`, PDF generated, delivery
email sent) was delivered to the customer **with a valid valuation but an empty comparables
table**.

Stored on the row:

| Field                                     | Value                                                           |
| ----------------------------------------- | --------------------------------------------------------------- |
| `marketcheck_predicted_price`             | 15171                                                           |
| `marketcheck_price_range_min` / `_max`    | 13654 / 16688                                                   |
| `marketcheck_confidence`                  | medium                                                          |
| `marketcheck_total_comparables_found`     | 26                                                              |
| `marketcheck_recent_comparables_found`    | **0**                                                           |
| `marketcheck_valuation.recentComparables` | `{ listings: [], num_found: 0, stats: {count: 0, …all null} }`  |
| `marketcheck_valuation.comparablesStats`  | present, `count: 26`, price mean 15563.96 / median 15369        |
| `comparables_supplemented`                | **false**                                                       |
| `marketcheck_fallback_used`               | **false**                                                       |
| `marketcheck_valuation.requestParams`     | `{ vin, zip: "14450", miles: 78000, dealer_type: "franchise" }` |

`api_call_logs` for this report shows exactly one MarketCheck call:
`/v2/predict/car/us/marketcheck_price/comparables`, `success: true`, 785 ms, cost $0.09,
`response_data: { predicted_price: 15171, total_comparables_found: 26, recent_comparables_found: 0 }`.
The fallback/supplement path does **not** call `logApiCall`, so it left no trace.

### What is confirmed

1. **MarketCheck itself returned zero recent comparables** on the primary call. The `0` is
   MarketCheck's own `recent_comparables.num_found`, logged before any of our filtering ran
   (`cleanAndFilterComparables` cannot remove listings that were never there — the
   `recentComparables.stats` block came back with `count: 0`). This is **not** the known
   stale-summary-column artefact (`project-marketcheck-comp-count-columns-stale`), where the
   blob has listings but the scalar columns don't — here the blob's `listings` array is
   genuinely `[]`.
2. **The valuation is sound.** $15,171 / $13,654–$16,688 / medium is derived from the 26-vehicle
   statistical aggregate. Only the itemised listing table is missing.
3. **`marketcheck_fallback_used = false` is correct behaviour.** The in-client search fallback
   inside `fetchMarketCheckData` only triggers on a VIN-decode failure (HTTP 400 containing
   `"Failed to decode VIN"`, `marketcheck-client.ts:421-441`). This VIN decoded fine, so that
   path was never eligible.
4. **`supplementComparables()` ran and recovered nothing** (`comparables_supplemented = false`).
   The webhook calls it whenever `validateListingUrls` didn't throw
   (`webhook/route.ts:409-424`), and URL validation trivially succeeds on 0 listings. So the
   function ran and hit one of its "return `unchanged`" paths.
5. **Not systemic.** Of the last 90 paid reports, only 3 have an empty comps list; 2 of those
   are from June/July. Multi-word model names in general are fine — "Model S", "Prius c",
   "IONIQ 5", "Grand Highlander", "Santa Fe Sport", "Wrangler Unlimited" all supplemented
   successfully in other reports. So "any space in the model name breaks the search" is **not**
   the issue.

### Confirmed root cause of the empty supplement: the fallback search sends the body-style word as part of the model name

`supplementComparables` → `fetchAndValidatePage` → `fetchMarketCheckSearchFallback` sends the
VIN-decoder's model string verbatim as `&model=` to `/v2/search/car/active`
(`marketcheck-client.ts:185-191`). For this VIN the decoder returns model **`"Civic Coupe"`**
(confirmed in `vehicle_data.model` and `autodev_vin_data.model`).

MarketCheck's for-sale inventory indexes this vehicle as model **`"Civic"`**, with the
coupe/sedan distinction in a separate `body_type` field. A literal search for
`model="Civic Coupe"` returns `num_found: 0`, which makes `fetchMarketCheckSearchFallback` hit
its own empty-result guard (`marketcheck-client.ts:224-230`, returns `{ success: false }`),
which makes `fetchAndValidatePage` return `null` (`comparables-supplementer.ts:74`), which
makes `supplementComparables` return `unchanged` (`comparables-supplementer.ts:137`).

**Proven 2026-08-28 with a throwaway probe endpoint** (`GET /api/debug/marketcheck`, deployed
to a Vercel Preview so the API call originated from Vercel infra, then deleted — PR #141,
closed). The probe calls `fetchMarketCheckData` then runs `validateListingUrls` +
`supplementComparables` exactly as the webhook does, with no DB reads/writes:

| Probe                                           | Subject-vehicle `model` | Primary `recent_comparables.num_found` | After supplement                      |
| ----------------------------------------------- | ----------------------- | -------------------------------------- | ------------------------------------- |
| 1 — report's real values                        | `"Civic Coupe"`         | 0                                      | `supplemented: false`, **0 listings** |
| 2 — same VIN/ZIP/miles, only `model` overridden | `"Civic"`               | 0                                      | `supplemented: true`, **98 listings** |

Same VIN, same ZIP (14450), same mileage (78,000). The only variable was the model string sent
to `/v2/search/car/active`. `"Civic Coupe"` → 0 matches; `"Civic"` → 98 matches. The primary
VIN `predict` call returns 0 recent listings either way — that part is MarketCheck's behaviour
and is out of scope (see §6); the fixable failure is the fallback search.

Why "Civic Coupe" and not the other multi-word models: for "Model S", "Grand Highlander" etc.
the multi-word string **is** MarketCheck's canonical model name. For Honda the canonical model
is "Civic"; "Coupe" is a body style. The one other Honda Civic report in the sample
(`f11b4ab5`, 2017 "Civic Sedan") got 49 recent comparables from the **primary** call and never
exercised the fallback.

**Secondary contributing factor (still holds):** `comparables-supplementer.ts:130` tries to
self-correct the model name by borrowing it from an existing comp
(`originalListings[0]?.model ?? subjectVehicle.model`). With zero seed listings there is
nothing to borrow from, so it falls back to the raw `"Civic Coupe"`. The correction is
disabled in exactly the case it's needed most.

**Secondary observation from probe 2 — check during the fix:** all 98 recovered listings came
back `url_validated: false`. Could be the Preview environment failing to reach dealer VDP pages,
or a real weakness in URL-validating supplemented listings. Doesn't change the diagnosis (98
candidates beats 0) but the webhook's own URL validation behaviour on supplemented listings is
worth confirming.

**Ruled out by the probe:** the webhook's VIN re-decode failing / `subjectVehicle` undefined
(probe 1 passed a fully-populated `subjectVehicle` and still got `supplemented: false`), and
the `/search/car/active` endpoint erroring (probe 2 hit the same endpoint and got 98 results).

### Note on local reproduction

The failing call could **not** be replayed from the dev machine directly:
`MARKETCHECK_API_KEY` in `.env.local` returns HTTP 401 `"Invalid authentication credentials"`
on every endpoint (likely a stale/rotated key or an IP allowlist). The Vercel-Preview probe
above was the workaround — the key is scoped to Preview as well as Production, so the request
went out from Vercel's infrastructure with a valid key. Vercel Hobby also retains runtime logs
only ~1 hour, so the original 2026-08-28 webhook run's logs are gone.

---

## 3. Proposed solution

Ordered by priority. §3.1 and §3.2 are the core of the ask; §3.3–§3.5 are worth deciding on
while the code is open.

### 3.1 Make the fallback search observability-first (do this first)

`fetchMarketCheckSearchFallback` and `supplementComparables` currently emit only plain
`console.log`/`console.error` and never write to `api_call_logs`. That is why this report is
un-diagnosable after the fact.

- Add an `api_call_logs` row (or an equivalently durable record) from
  `fetchMarketCheckSearchFallback` per attempt: `provider: 'marketcheck'`,
  `endpoint: '/v2/search/car/active'`, the exact `make`/`model`/`year`/`start` sent,
  `num_found`, listings returned, `success`, and the error string on failure.
- Add a single structured record from `supplementComparables` capturing the **exit reason**:
  which early-return fired (`validCount >= MIN_VALID`, `subjectVehicle` missing, `mileage`/`zip`
  null, `apiKey` missing, pass-1 `null`, post-filter empty), `validCount` in, listings out,
  `supplemented` boolean.

With this in place the next occurrence is self-explaining, and it immediately disambiguates
"search returned 0" from "`subjectVehicle` was undefined" for future cases.

### 3.2 Fix the model-name mismatch in the fallback search — split model and body style

In `fetchMarketCheckSearchFallback` (and/or its callers), before calling `/v2/search/car/active`:

**Primary fix — strip the body-style word off `model` AND re-send it as `body_type`.** Do not
just discard it. `/v2/search/car/active` supports a `body_type` filter (comma-separated;
observed values `SUV`, `Pickup`, `Sedan`, `Hatchback`, `Convertible`, `Coupe` — MarketCheck
[Inventory Search docs](https://docs.marketcheck.com/docs/api/cars/inventory/inventory-search)).
So `"Civic Coupe"` → `model=Civic&body_type=Coupe&year=2017`. This is the version that keeps
comp relevance: probe 2 above searched bare `model=Civic` and got 98 listings that were
mostly sedan/hatch trims (Si, Touring, EX-L, LX) — a 2017 Civic Coupe should be valued against
2017 Civic **coupes**, since the two body styles carry different resale values and a mixed
table is weaker evidence for the customer's insurer.

- **Body-style token allowlist** (case-insensitive, only when it is a trailing token and not
  the whole string): `Coupe`, `Sedan`, `Hatchback`, `Wagon`, `Convertible`, `Cabriolet`,
  `Crew Cab`, `Extended Cab`, `Regular Cab`, `Pickup`, `Van`, `Minivan`, `SUV`. Map each to the
  corresponding `body_type` value. Do **not** first-word-truncate — that would break
  "Grand Highlander", "Santa Fe Sport", "Wrangler Unlimited", "Model S", "Prius c", "IONIQ 5".
- **The decoder's own body field is too coarse to use** — for this VIN `autodev_vin_data.body`
  is `"Car"` and `type` is `"Cars"`. The body style is only recoverable from the trailing word
  on the `model` string, so `body_type` must be derived from the token you strip, not from a
  dedicated field.
- **Fallback when the body-typed search is too thin:** if `model + body_type` returns fewer
  than `MIN_VALID` (10), retry with bare `model` (no `body_type`) and rank the mixed results by
  best match, rather than shipping an empty table. Better a relevant-where-possible set than
  nothing.
- Fix `comparables-supplementer.ts:130` so the "borrow the model name from an existing comp"
  correction has a sensible path when `originalListings` is empty (fall through to the
  split model/`body_type` from the step above, not the raw decoder string).

### 3.3 Decide whether the fallback search should be geo-aware

`fetchMarketCheckSearchFallback` deliberately omits ZIP (comment at
`marketcheck-client.ts:180-182`: passing `zip` with no radius returns 0). Consider passing
`zip` **with** an explicit `radius` (e.g. 100/250/500 mi progressive) so supplemented comps are
at least regionally relevant, instead of nationwide-then-ranked. Coordinate with the
comp-distance-ranking work already on `docs/live-comp-distance-ranking-design` — this overlaps.

### 3.4 Progressive widening in the query, not just post-fetch

`applyYearFilter` (`comparables-supplementer.ts:30-49`) widens ±2 → ±5 → all, but only over
listings already returned. If the search query itself returns nothing there is nothing to
widen. If 3.2 still yields 0, widen the `year` sent to `/v2/search/car/active` (or drop it and
rely on the post-fetch filter) before concluding "no comps exist".

### 3.5 Define the customer-facing fallback when comps are genuinely empty

Even with 3.2–3.4, some VIN/ZIP combinations will legitimately have zero active listings. Decide
the intended behaviour:

- flag the report for manual review (the admin radius-corrected-report flow already exists), and/or
- surface an explicit "no active listings found near you; valuation is based on N statistical
  comparables" line in the PDF instead of a blank table, and/or
- gate delivery on a minimum comp count.

Currently the report ships silently with an empty table.

---

## 4. Verification plan

1. Implement 3.1, deploy, and either wait for a natural recurrence or force one: create a test
   report for VIN `2HGFC3B33HH351102` (or any 2017–2019 Civic Coupe / other discontinued
   body-style variant), ZIP `14450`, ~78k mi, and run it through the paid path.
2. Read the new `api_call_logs` rows to confirm which branch actually failed for `63cf7f1b`
   (search returned 0 vs. `subjectVehicle` undefined vs. endpoint error).
3. Implement 3.2, re-run the same test report, confirm `comparables_supplemented = true`, a
   non-empty `recentComparables.listings`, and that the recovered listings are actually coupes
   (i.e. the `body_type` filter took effect), not a sedan-dominated set.
4. Regression check: re-run a handful of the models that already supplement correctly
   ("Grand Highlander", "Wrangler Unlimited", "Model S", "Prius c", "IONIQ 5", "F-150",
   "Odyssey") and confirm counts don't drop — in particular that a model with no body-style
   token is sent unchanged with no `body_type` param.
5. Confirm the probe-2 `url_validated: false` observation isn't a real problem: check that
   supplemented listings in a production report come back URL-validated.
6. Per workspace convention (`CLAUDE.md` → "verify fixes against production data"): confirm on a
   real production report, not just a merged PR.

---

## 5. Key file references

| Location                                         | What's there                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api/marketcheck-client.ts:170-308`          | `fetchMarketCheckSearchFallback` — sends `&model=` verbatim (`:185-191`); empty-result guard (`:224-230`)                       |
| `lib/api/marketcheck-client.ts:323-591`          | `fetchMarketCheckData` — primary predict call; in-client fallback only on VIN-decode 400 (`:421-441`)                           |
| `lib/api/marketcheck-client.ts:507-562`          | `recentComparables` transform + `cleanAndFilterComparables`                                                                     |
| `lib/utils/comparables-supplementer.ts:102-181`  | `supplementComparables` — early returns (`:113-122`), model-name self-correction (`:130`), pass-1 `null` → `unchanged` (`:137`) |
| `lib/utils/comparables-supplementer.ts:30-49`    | `applyYearFilter` — post-fetch year widening only                                                                               |
| `lib/utils/comparables-supplementer.ts:55-100`   | `fetchAndValidatePage` — returns `null` on `!success` / empty / all-filtered                                                    |
| `app/api/lemonsqueezy/webhook/route.ts:204`      | start of `after(...)` post-payment block                                                                                        |
| `app/api/lemonsqueezy/webhook/route.ts:~297-329` | VIN re-decode → `subjectVehicle` → `fetchMarketCheckData` call                                                                  |
| `app/api/lemonsqueezy/webhook/route.ts:397-427`  | `validateListingUrls` + `supplementComparables` invocation                                                                      |
| `app/api/lemonsqueezy/webhook/route.ts:432-476`  | `updateData` assembly (`comparables_supplemented`, `marketcheck_fallback_used`, etc.)                                           |
| `lib/utils/comparables-cleaner.ts`               | `cleanAndFilterComparables` — year cap, 0-mile/price filter, dedup, per-dealer cap (not read in full this session)              |
| `docs/data-dictionary-reports.md`                | column semantics; note `marketcheck_recent/total_comparables_found` staleness caveat                                            |

## 6. Out of scope for this fix

- The primary endpoint returning 0 recent comparables is MarketCheck's behaviour, not a bug in
  our code — do not try to "fix" the predict call.
- Price/tier changes, the broader comp-distance-ranking redesign (separate branch), and the
  9 paid-but-`pending` reports flagged in the data dictionary are unrelated.

## 7. Read log

- 2026-08-28 (investigation) — queried Supabase (`reports`, `api_call_logs`) for report
  `63cf7f1b`, read the three MarketCheck code paths on `origin/main`, attempted and failed to
  reproduce the MarketCheck search call locally (key returns 401), and cross-checked 90 paid
  reports for the multi-word-model pattern. Wrote this doc; §2 model-name explanation was a
  hypothesis at that point, §3.2 mentioned `body_type` only in passing.
- 2026-08-28 (probe) — deployed a throwaway `GET /api/debug/marketcheck` route to a Vercel
  Preview (branch `debug/marketcheck-vin-probe`, PR #141 — both since deleted/closed) and ran
  it twice. Confirmed the §2 root cause: `model="Civic Coupe"` → 0 supplemented, `model="Civic"`
  → 98 supplemented, same VIN/ZIP/miles. Verified `/v2/search/car/active` supports a `body_type`
  filter via MarketCheck docs. Rewrote §2 (hypothesis → confirmed, with the probe table) and
  §3.2 (split `model` + `body_type` as the primary fix, preserving comp relevance) and added
  verification steps 3, 5.
