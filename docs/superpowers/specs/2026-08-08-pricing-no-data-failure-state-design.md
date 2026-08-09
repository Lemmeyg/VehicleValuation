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

This was confirmed via PostHog session replay + event SQL: a real visitor session (`019fe37a-...`, iOS Safari) submitted the homepage vehicle-search form, landed on `/pricing`, then was auto-navigated back to `/` exactly **3.225 seconds later** — matching the literal 3000ms timer almost to the millisecond. A second session (`019fe22d-...`, desktop Chrome/Mac, direct traffic to `/pricing` with no report context at all) showed the identical signature ~4s after landing. Both had to restart their flow or leave; in the mobile session, the user retried the entire vehicle-search submission a second time before it worked.

Why the data is missing in the first place isn't fully confirmed — `Hero.tsx` writes `sessionStorage` synchronously, immediately before `router.push`, so by the code it should always be present by the time `/pricing` mounts. The leading theories (a storage-timing quirk on client-side navigation, particularly on iOS Safari) can't be distinguished from replay data alone. Rather than guess, this design adds diagnostics alongside the fix.

## Approach

Four small, related changes, all in `app/pricing/page.tsx` (plus one new event in `lib/analytics/events.ts` usage — no new tracking function needed, `trackEvent` is already imported and used elsewhere in this same file, e.g. line 857 for `report_preview_viewed`).

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

## Out of scope

- Determining the exact browser-level cause of the storage-timing race — the new diagnostic event (change 3) is how that gets answered with real data, not this design.
- The `reportId` branch (`fetchExistingReport`)'s network-error handling logic itself — only adding the missing tracking call to its existing `else` branch, not changing its control flow.
- The other 5 items from the same backlog batch (Zoho merge-tag bug, exit-intent popup review, cold-traffic first-visit messaging, click-tracking instrumentation gap, and this same carousel's `article_viewed` heartbeat bug) — each is a separate spec/plan cycle.

## Testing

Follow `__tests__/app/pricing/page.test.tsx`'s existing conventions (`sessionStorage.setItem`/`clear` in `beforeEach`/`afterEach`, mocked `fetch`). Add cases:

- `pending_report` appears on retry attempt 2 (or 3) → page hydrates normally, no error state, no `pricing_data_missing` event.
- No data at all, even after all retries → error state renders with "Return to Homepage" button, **no navigation occurs automatically** (assert `router.push` is not called, or use fake timers and advance well past 3000ms to prove no redirect fires), and `trackEvent` was called with `reason: 'no_data_after_retry'`.
- Malformed JSON in `pending_report` → error state renders, `trackEvent` called with `reason: 'parse_error'`, and `sessionStorage.getItem('pending_report')` returns `null` afterward (proving cleanup).
- `fetchExistingReport`'s existing failure branch (mocked non-OK response) → `trackEvent` called with `reason: 'existing_report_fetch_failed'` (new assertion on an existing test case, or a new one alongside it).

Run `npm run type-check` and `npm run test:ci` before considering this done, per this repo's standard process (`CLAUDE.md`).

## Risks

Low. Pure client-side state/timing change in one page component; no schema, API contract, or payment-flow changes. The retry window adds at most ~1.2s of delay before showing a failure state that previously would have appeared immediately — acceptable since it only affects the already-broken path, and legitimate hand-offs will resolve on the first check as before.
