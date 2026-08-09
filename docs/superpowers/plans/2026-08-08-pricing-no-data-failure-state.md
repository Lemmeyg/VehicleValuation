# Pricing No-Data Failure State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `/pricing` from silently auto-redirecting visitors home 3 seconds after arrival when their vehicle data hasn't loaded yet, and add a short retry window plus diagnostic tracking so real production frequency/cause can be measured going forward.

**Architecture:** `app/pricing/page.tsx`'s `initializePricingPage()` currently sets an error message *and* schedules `setTimeout(() => router.push('/'), 3000)` when neither a `reportId` URL param nor `sessionStorage.pending_report` (written by `Hero.tsx`/`ArticleReportBar.tsx` immediately before navigating here) is found. The error UI (with a manual "Return to Homepage" button) already exists further down the same component — the fix removes the auto-redirect, adds a bounded retry loop before declaring failure (defense-in-depth against a suspected but unconfirmed storage-timing race), and adds a `pricing_data_missing` PostHog event with a `reason` field so the three distinct failure paths (no data found, corrupted data, existing-report API failure) are distinguishable in production data.

**Tech Stack:** Next.js 16 App Router (Client Component), `next/navigation` (`useRouter`, `useSearchParams`), PostHog via `lib/analytics/events.ts`'s `trackEvent`, Jest + React Testing Library (fake timers for time-based assertions, matching the existing `PaymentConfirmationWatcher.test.tsx` pattern in this repo).

## Global Constraints

- Never re-add a `redirect()`, `router.push()`, or `setTimeout(...)` that navigates away from the no-data error state — the whole point of this fix is that it must stay terminal. The existing "Return to Homepage" button (already in the render branch, unchanged) is the only way home from that state.
- No new tracking function — reuse `trackEvent(eventName: string, properties?: Record<string, unknown>)` from `lib/analytics/events.ts`, already imported in `app/pricing/page.tsx`.
- The retry window only applies to the "nothing found yet" `sessionStorage`/`reportId` case. It does not apply to the `reportId` → `fetchExistingReport` branch (that already has its own network-error handling).
- Run `npm run type-check` and `npm run test:ci` before considering this done, per this repo's standard process (`CLAUDE.md`).
- Spec: `docs/superpowers/specs/2026-08-08-pricing-no-data-failure-state-design.md`.

**Known, accepted limitation:** the retry loop in Task 2 has no unmount/cancellation guard. If a user navigates away from `/pricing` while a retry is still in flight (within ~1.2s of landing), the loop keeps running in the background and can fire a false-positive `pricing_data_missing` event for a user who simply left, not one who hit the bug. This is not a functional bug — React 19 makes state updates on an unmounted component a safe no-op, and the existing code already relies on this elsewhere (e.g. `fetchExistingReport`'s fetch has no unmount guard either). A correct fix (an incrementing "epoch" ref, checked at each resume point, to survive React StrictMode's dev-only mount→cleanup→remount cycle without falsely cancelling the real run) was considered and explicitly deferred as unnecessary complexity for a dev-only interaction with zero production impact. Revisit only if the diagnostic event's false-positive rate turns out to matter in practice.

---

### Task 1: Remove the auto-redirect timer

**Files:**
- Modify: `app/pricing/page.tsx:181-187`
- Test: `__tests__/app/pricing/page.test.tsx`

**Interfaces:** None new — internal behavior change only.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `__tests__/app/pricing/page.test.tsx` (after the existing `'PricingPage — reportId flow via the new preview endpoint'` block, before the file's closing):

```tsx
describe('PricingPage — no vehicle data found', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('does not automatically navigate home after showing the no-data message', async () => {
    render(<PricingPage />)

    expect(await screen.findByText(/no vehicle data found/i)).toBeInTheDocument()

    await act(async () => {
      jest.advanceTimersByTime(4000)
    })

    expect(mockPush).not.toHaveBeenCalled()
  })
})
```

This needs `act` imported — add `act` to the existing `import { render, screen } from '@testing-library/react'` at the top of the file, making it `import { render, screen, act } from '@testing-library/react'`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/app/pricing/page.test.tsx -t "does not automatically navigate home"`
Expected: FAIL — `mockPush` was called with `'/'`, because the current code's `setTimeout(() => router.push('/'), 3000)` fires once 4000ms of fake time is advanced past the 3000ms mark.

- [ ] **Step 3: Remove the timer**

In `app/pricing/page.tsx`, replace lines 181–187:

```ts
    // No data found - redirect to homepage
    setError('No vehicle data found. Please submit the form on the homepage.')
    setLoading(false)
    setTimeout(() => {
      router.push('/')
    }, 3000)
  }
```

with:

```ts
    // No data found — show a message instead of auto-redirecting. The user
    // can return home via the button in the error state (see the render
    // branch below); do NOT re-add a redirect() or setTimeout() here — see
    // docs/superpowers/specs/2026-08-08-pricing-no-data-failure-state-design.md
    setError('No vehicle data found. Please submit the form on the homepage.')
    setLoading(false)
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/pricing/page.test.tsx -t "does not automatically navigate home"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/pricing/page.tsx __tests__/app/pricing/page.test.tsx
git commit -m "fix: stop /pricing from auto-redirecting home 3s after showing the no-data message"
```

---

### Task 2: Add a retry window for the `pending_report` hand-off

**Files:**
- Modify: `app/pricing/page.tsx` (add module-level constants + helper; modify the Option B block inside `initializePricingPage`)
- Test: `__tests__/app/pricing/page.test.tsx`

**Interfaces:**
- Produces: module-level `wait(ms: number): Promise<void>`, `PENDING_REPORT_RETRY_DELAY_MS = 400`, `MAX_PENDING_REPORT_RETRIES = 3` — used only within `app/pricing/page.tsx`; Task 3 does not need to import these, it works inside the same function.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `__tests__/app/pricing/page.test.tsx` (after the `'PricingPage — no vehicle data found'` block from Task 1):

```tsx
describe('PricingPage — pending_report retry window', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('hydrates successfully when pending_report appears shortly after mount', async () => {
    render(<PricingPage />)

    // Simulates Hero.tsx's sessionStorage write landing just after this
    // page's first check — the suspected production race.
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })

    await act(async () => {
      jest.advanceTimersByTime(1200)
    })

    expect(await screen.findByText(/2019 Honda Civic/i)).toBeInTheDocument()
    expect(screen.queryByText(/no vehicle data found/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/app/pricing/page.test.tsx -t "hydrates successfully when pending_report appears shortly after mount"`
Expected: FAIL (timeout) — with no retry logic, the component's single synchronous `sessionStorage.getItem('pending_report')` check runs before the test writes the value, finds nothing, and immediately shows the no-data message; `findByText(/2019 Honda Civic/i)` never resolves.

- [ ] **Step 3: Implement the retry loop**

In `app/pricing/page.tsx`, add these constants and helper immediately before `function PricingContent() {`:

```ts
const PENDING_REPORT_RETRY_DELAY_MS = 400
const MAX_PENDING_REPORT_RETRIES = 3

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
```

Then replace the Option B block inside `initializePricingPage` (originally lines 166–179, now shifted slightly by Task 1's edit — locate by the `// Option B:` comment), from:

```ts
    // Option B: report was already created server-side at form-submit time
    // (Hero.tsx / ArticleReportBar.tsx) — this is a same-tab sessionStorage
    // hand-off, not a fresh create-anonymous call.
    const pendingReport = sessionStorage.getItem('pending_report')
    if (pendingReport) {
      try {
        const rawReport = JSON.parse(pendingReport)
        sessionStorage.removeItem('pending_report')
        hydrateReportFromCreateResponse(rawReport)
        return
      } catch (err) {
        console.error('[PricingPage] pending_report parse error:', err)
      }
    }
```

to:

```ts
    // Option B: report was already created server-side at form-submit time
    // (Hero.tsx / ArticleReportBar.tsx) — this is a same-tab sessionStorage
    // hand-off, not a fresh create-anonymous call.
    //
    // Retry a few times before giving up: Hero.tsx writes sessionStorage
    // synchronously right before navigating here, so this should already be
    // present, but a timing race (particularly on iOS Safari) has been
    // observed in production. See
    // docs/superpowers/specs/2026-08-08-pricing-no-data-failure-state-design.md
    let pendingReport = sessionStorage.getItem('pending_report')
    let retries = 0
    while (!pendingReport && retries < MAX_PENDING_REPORT_RETRIES) {
      await wait(PENDING_REPORT_RETRY_DELAY_MS)
      pendingReport = sessionStorage.getItem('pending_report')
      retries++
    }

    if (pendingReport) {
      try {
        const rawReport = JSON.parse(pendingReport)
        sessionStorage.removeItem('pending_report')
        hydrateReportFromCreateResponse(rawReport)
        return
      } catch (err) {
        console.error('[PricingPage] pending_report parse error:', err)
      }
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/pricing/page.test.tsx -t "hydrates successfully when pending_report appears shortly after mount"`
Expected: PASS

Also re-run Task 1's test to confirm no regression:

Run: `npx jest __tests__/app/pricing/page.test.tsx -t "does not automatically navigate home"`
Expected: PASS (the retry loop adds ~1.2s before the no-data message can appear when nothing is ever found, which fake-timer advancement in that test already accounts for since it advances 4000ms total).

- [ ] **Step 5: Commit**

```bash
git add app/pricing/page.tsx __tests__/app/pricing/page.test.tsx
git commit -m "feat: retry pending_report lookup for up to 1.2s before showing the no-data message"
```

---

### Task 3: Add `pricing_data_missing` diagnostic tracking and fix the parse-error cleanup asymmetry

**Files:**
- Modify: `app/pricing/page.tsx` (the `catch` block inside the Option B section, the final no-data fallthrough, and `fetchExistingReport`'s `else` branch)
- Test: `__tests__/app/pricing/page.test.tsx`

**Interfaces:**
- Consumes: `trackEvent` (already imported at the top of `app/pricing/page.tsx`).
- Produces: a new PostHog event `pricing_data_missing` with `{ reason: 'no_data_after_retry' | 'parse_error' | 'existing_report_fetch_failed' }`, fired exactly once per failure.

- [ ] **Step 1: Write the failing tests**

In `__tests__/app/pricing/page.test.tsx`, add `trackEvent` to the imports at the top of the file:

```tsx
import { trackEvent } from '@/lib/analytics/events'
```

Add a new `describe` block (after the `'PricingPage — pending_report retry window'` block from Task 2):

```tsx
describe('PricingPage — pricing_data_missing diagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('tracks reason: no_data_after_retry when nothing is found after retries', async () => {
    render(<PricingPage />)

    await act(async () => {
      jest.advanceTimersByTime(1200)
    })

    expect(await screen.findByText(/no vehicle data found/i)).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('pricing_data_missing', {
      reason: 'no_data_after_retry',
    })
  })

  it('tracks reason: parse_error and clears the corrupted key when pending_report is malformed', async () => {
    sessionStorage.setItem('pending_report', '{not valid json')

    render(<PricingPage />)

    expect(await screen.findByText(/no vehicle data found/i)).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('pricing_data_missing', { reason: 'parse_error' })
    expect(sessionStorage.getItem('pending_report')).toBeNull()
  })
})
```

Then append one more test inside the *existing* `describe('PricingPage — reportId flow via the new preview endpoint', ...)` block (after its `'shows an already-purchased message...'` test, before that block's closing `})`):

```tsx
  it('tracks reason: existing_report_fetch_failed when the preview endpoint fails', async () => {
    jest
      .spyOn(jest.requireMock('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams('reportId=r1'))
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Report not found' }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    expect(await screen.findByText(/report not found/i)).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('pricing_data_missing', {
      reason: 'existing_report_fetch_failed',
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/app/pricing/page.test.tsx -t "pricing_data_missing"`
Run: `npx jest __tests__/app/pricing/page.test.tsx -t "existing_report_fetch_failed"`
Expected: FAIL on all three — `trackEvent` is never called with `'pricing_data_missing'` anywhere in the current code.

- [ ] **Step 3: Implement**

In `app/pricing/page.tsx`, replace the block that Task 2 left in place (the `if (pendingReport) { try { ... } catch ... }` followed by the no-data fallthrough), from:

```ts
    if (pendingReport) {
      try {
        const rawReport = JSON.parse(pendingReport)
        sessionStorage.removeItem('pending_report')
        hydrateReportFromCreateResponse(rawReport)
        return
      } catch (err) {
        console.error('[PricingPage] pending_report parse error:', err)
      }
    }

    // No data found — show a message instead of auto-redirecting. The user
    // can return home via the button in the error state (see the render
    // branch below); do NOT re-add a redirect() or setTimeout() here — see
    // docs/superpowers/specs/2026-08-08-pricing-no-data-failure-state-design.md
    setError('No vehicle data found. Please submit the form on the homepage.')
    setLoading(false)
  }
```

with:

```ts
    if (pendingReport) {
      try {
        const rawReport = JSON.parse(pendingReport)
        sessionStorage.removeItem('pending_report')
        hydrateReportFromCreateResponse(rawReport)
        return
      } catch (err) {
        console.error('[PricingPage] pending_report parse error:', err)
        sessionStorage.removeItem('pending_report')
        trackEvent('pricing_data_missing', { reason: 'parse_error' })
        setError('No vehicle data found. Please submit the form on the homepage.')
        setLoading(false)
        return
      }
    }

    // No data found — show a message instead of auto-redirecting. The user
    // can return home via the button in the error state (see the render
    // branch below); do NOT re-add a redirect() or setTimeout() here — see
    // docs/superpowers/specs/2026-08-08-pricing-no-data-failure-state-design.md
    trackEvent('pricing_data_missing', { reason: 'no_data_after_retry' })
    setError('No vehicle data found. Please submit the form on the homepage.')
    setLoading(false)
  }
```

(The `catch` block needs its own explicit `return` — without it, execution would also fall through to the "no data found" section below and fire a second, contradictory `trackEvent` call for the same failure.)

Then in `fetchExistingReport`, replace the `else` branch (originally lines 274–276):

```ts
      } else {
        setError(data.error || 'Failed to load report')
      }
```

with:

```ts
      } else {
        trackEvent('pricing_data_missing', { reason: 'existing_report_fetch_failed' })
        setError(data.error || 'Failed to load report')
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/app/pricing/page.test.tsx`
Expected: PASS — every test in the file (Task 1, 2, 3's new tests plus all pre-existing tests, none of which are affected since they all supply `pending_report` before render or a `reportId` with a successful mock response).

- [ ] **Step 5: Commit**

```bash
git add app/pricing/page.tsx __tests__/app/pricing/page.test.tsx
git commit -m "feat: track pricing_data_missing with a reason across all three /pricing failure paths"
```

---

### Task 4: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: PASS, no failures introduced by this change.

- [ ] **Step 2: Run the full type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Manual verification note (for the PR description, not automated)**

In a local/staging environment: navigate directly to `/pricing` with no `reportId` param and no prior form submission (simulating direct/bookmarked traffic). Confirm the page shows "No vehicle data found. Please submit the form on the homepage." with a working "Return to Homepage" button, and that the URL bar stays on `/pricing` for at least 10 seconds with no automatic navigation. Then submit the homepage vehicle-search form normally and confirm `/pricing` still loads the report data immediately, as before (no visible regression from the added retry logic on the happy path).
