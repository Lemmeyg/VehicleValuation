# Design: Stop `/pricing` From Silently Bouncing Users Home

**Date:** 2026-08-08
**Backlog ref:** "`[Session Replay Review] /pricing` silently redirects back to the homepage ~3–4 seconds after arrival" (`totallosstoolkit-workspace/backlog.md`, Agent-Sourced section)

## Context

`app/pricing/page.tsx`'s `initializePricingPage()` (lines 152–187) resolves vehicle/report data from one of two sources: a `reportId` URL query param, or `sessionStorage.getItem('pending_report')` (written by `components/Hero.tsx:203` / `ArticleReportBar.tsx` immediately before `router.push('/pricing')`). If neither is present, it falls through to:

```ts
// No data found - redirect to homepage
setError('No vehicle data found. Please submit the form on the homepage.')
setLoading(false)
setTimeout(() => {
  router.push('/')
}, 3000)
```

`setError` already triggers a proper failure UI further down the component (lines 610–626): a message plus a **"Return to Homepage" button**. The bug is the `setTimeout` — it yanks the user home 3 seconds later regardless of whether they read the message or wanted to click the button themselves.

This was confirmed via PostHog session replay + event SQL: a real visitor session (`019fe37a-...`, iOS Safari) submitted the homepage vehicle-search form, landed on `/pricing`, then was auto-navigated back to `/` exactly **3.225 seconds later** — matching the literal 3000ms timer almost to the millisecond. The user had to retry the entire vehicle-search submission a second time before it worked.

**Evidence correction (2026-08-08 re-review):** a second session originally cited as corroborating evidence (`019fe22d-...`, "desktop Chrome/Mac, direct traffic") was re-checked and excluded — its user agent (`...Claude/1.25927.0 Chrome/148.0.7778.280 Electron/42.7.0...`) shows it was Claude's own Electron browser, not a real visitor. A grep for `sessionStorage.clear()`, other `setTimeout(..., 3000)` calls, and a `middleware.ts` redirect all came back empty, ruling out alternative causes for the exact-3s timing. So the mechanism (this `setTimeout`) is confirmed with high confidence — it's the *frequency across real users* that's now based on one confirmed session rather than two. This is exactly why the diagnostic event (Approach, item 3) matters: it will surface real production frequency and cause-breakdown once shipped, rather than relying on manually-reviewed replay samples.

Why the data is missing in the first place isn't fully confirmed — `Hero.tsx` writes `sessionStorage` synchronously, immediately before `router.push`, so by the code it should always be present by the time `/pricing` mounts. The leading theories (a storage-timing quirk on client-side navigation, particularly on iOS Safari) can't be distinguished from replay data alone. Rather than guess, this design adds diagnostics alongside the fix.

**Scope expansion (2026-08-08, second re-review):** reviewing a further batch of real visitor activity (distinct_ids, not session replays) found the same failure signature is far more common than a one-time landing race. One real visitor (`019fd608-...`, mobile Safari) hit the exact ~3-second bounce **three separate times in one session** — every time they navigated away from `/pricing` (to `/faq`, or after the exit-intent popup) and came back. Root cause: `pending_report` is deleted from `sessionStorage` the moment it's successfully read once (line 173, unchanged by this design so far), and `/pricing`'s React state doesn't survive a route unmount — so *any* return trip to `/pricing` within the same tab (checking FAQ, dismissing the exit-intent popup and coming back later, browser back from checkout, reopening a stale tab) re-runs `initializePricingPage()` with nothing left to hydrate from. This is likely the dominant real-world trigger, not just the first-load timing race items 1–4 below address. Item 5 below closes this gap.

## Approach

Five small, related changes, all in `app/pricing/page.tsx` (plus one new event in `lib/analytics/events.ts` usage — no new tracking function needed, `trackEvent` is already imported and used elsewhere in this same file, e.g. line 857 for `report_preview_viewed`).

### 1. Remove the auto-redirect

Delete the `setTimeout(() => { router.push('/') }, 3000)` call from the no-data branch. The existing error UI (lines 610–626) already renders a "Return to Homepage" button — no auto-redirect is needed once this is gone.

### 2. Add a short retry window before declaring failure

Defense-in-depth against the unconfirmed timing race: when neither `reportId` nor `pending_report` is found on the first check, retry reading `sessionStorage.getItem('pending_report')` up to 3 more times, 400ms apart (~1.2s total), before falling through to the error state. If it appears on a retry, proceed via the existing `hydrateReportFromCreateResponse` path — no visible change for the user in that case. This only affects the "nothing found yet" path; it does not apply to the `reportId` branch (that already does a network fetch with its own error handling via `fetchExistingReport`).

### 3. Add a diagnostic event when the failure state renders

Fire `trackEvent('pricing_data_missing', { reason })` once, right before `setError(...)` in each of the three places that can reach the failure UI:

- `'no_data_after_retry'` — nothing in `sessionStorage`/URL even after the retry window (Task above).
- `'parse_error'` — `sessionStorage` had a `pending_report` value but `JSON.parse` threw (existing `catch` block, line ~176).
- `'existing_report_fetch_failed'` — the `fetchExistingReport` API path's `else` branch (line 274–276), which currently sets `error` with no tracking at all.

This gives real production signal on which case is actually occurring, so the underlying storage-race question can be answered with data instead of guesswork.

### 4. Fix a related asymmetry in the parse-error path

`JSON.parse(pendingReport)` failing currently does **not** clear `sessionStorage.removeItem('pending_report')` — only the success path clears it (line 173). A corrupted value is unusable and will fail to parse again on any retry, so clear it in the `catch` block too, matching the success path's cleanup.

### 5. Resume return visits via the persisted `current_report_id` (Option C)

`hydrateReportFromCreateResponse` already writes `sessionStorage.setItem('current_report_id', reportData.id)` (line 217) on every successful hydration — and nothing ever reads or clears it today. Add it as a third fallback, checked after the retry window (item 2) comes up empty and before declaring failure: if `current_report_id` is present, call the existing `fetchExistingReport(id)` — the same function already used for the `reportId` URL-param flow (Option A), already proven anonymous-safe (PR #97), and already gets Task 3's `existing_report_fetch_failed` tracking and `alreadyPurchased` handling for free.

**Why re-fetch instead of just not deleting `pending_report` in the first place** (the simpler-looking alternative): `pending_report` is a snapshot taken at form-submit time. If the user already purchased the report in this tab and then navigates back to `/pricing` (e.g. via browser back from checkout), a stale snapshot would show the payment buttons again — a worse bug than the one being fixed. Re-fetching via `fetchExistingReport` always asks the server for current truth, so `alreadyPurchased` is correctly detected on return visits, not just first loads.

**Accepted edge case:** if a user successfully loads `/pricing` for vehicle A (setting `current_report_id`), then goes back and resubmits the form for a *different* vehicle B, and that new `pending_report` write loses the retry-window race (item 2) by more than ~1.2s, Option C would show vehicle A's stale data instead of waiting further or failing correctly. This requires two rare conditions to stack (an already-completed prior lookup in the same tab, plus a slow-than-1.2s write race) and the failure mode is mild (wrong-but-real report shown, user can just resubmit) — accepted rather than adding more machinery to prevent it.

## Out of scope

- Determining the exact browser-level cause of the storage-timing race — the new diagnostic event (change 3) is how that gets answered with real data, not this design.
- The `reportId` branch (`fetchExistingReport`)'s network-error handling logic itself — only adding the missing tracking call to its existing `else` branch, not changing its control flow.
- The other 5 items from the same backlog batch (Zoho merge-tag bug, exit-intent popup review, cold-traffic first-visit messaging, click-tracking instrumentation gap, and this same carousel's `article_viewed` heartbeat bug) — each is a separate spec/plan cycle.
- A second finding from the same re-review — 7 rapid `form_submitted` events in 15 seconds from one visitor on the mobile `ArticleReportBar` form, suggesting validation-failure frustration or unclear submit feedback — is unrelated to this bug and belongs in its own backlog item, not this design.

## Testing

Follow `__tests__/app/pricing/page.test.tsx`'s existing conventions (`sessionStorage.setItem`/`clear` in `beforeEach`/`afterEach`, mocked `fetch`). Add cases:

- `pending_report` appears on retry attempt 2 (or 3) → page hydrates normally, no error state, no `pricing_data_missing` event.
- No data at all, even after all retries and with no `current_report_id` either → error state renders with "Return to Homepage" button, **no navigation occurs automatically** (assert `router.push` is not called, or use fake timers and advance well past 3000ms to prove no redirect fires), and `trackEvent` was called with `reason: 'no_data_after_retry'`.
- Malformed JSON in `pending_report` → error state renders, `trackEvent` called with `reason: 'parse_error'`, and `sessionStorage.getItem('pending_report')` returns `null` afterward (proving cleanup).
- `fetchExistingReport`'s existing failure branch (mocked non-OK response) → `trackEvent` called with `reason: 'existing_report_fetch_failed'` (new assertion on an existing test case, or a new one alongside it).
- `current_report_id` present with no `pending_report`/`reportId` → the report loads via the preview endpoint (same as the Option A test), proving return visits work.
- `current_report_id` present but the report was already purchased (mocked `alreadyPurchased: true`) → the existing "already purchased" UI renders, not the payment buttons.

Run `npm run type-check` and `npm run test:ci` before considering this done, per this repo's standard process (`CLAUDE.md`).

## Risks

Low. Pure client-side state/timing change in one page component; no schema, API contract, or payment-flow changes. The retry window adds at most ~1.2s of delay before showing a failure state that previously would have appeared immediately — acceptable since it only affects the already-broken path, and legitimate hand-offs will resolve on the first check as before. Option C adds one extra network round-trip (to an endpoint already used elsewhere on this same page) only for the return-visit case that currently shows a hard error — strictly an improvement, never a regression from today's behavior.

**Correction (final whole-branch review, 2026-08-09):** the paragraph above was written before item 5 (Option C) composed on top of item 2 (the retry window) — the two interact in a way this section didn't originally account for. The retry loop runs unconditionally *before* Option C is ever checked, so a return visit (the case Option C exists to fix, and per the Context section likely the dominant real-world trigger) now pays the full ~1.2s retry delay on a "Loading your vehicle data..." spinner before the Option C fetch is even issued — on top of that fetch's own round-trip. This is still strictly better than today's silent bounce-home, but it is a real, accepted cost, not the "one extra round-trip" this section originally claimed. A fix (e.g. checking `current_report_id` up front and racing it against the retry loop) was considered during the final review and explicitly deferred — the added complexity wasn't judged worth it for a delay this small. Revisit if production data (the `pricing_data_missing` diagnostic event, or direct user feedback) shows this delay is actually a problem in practice.
