# Report View Payment-Gate Redirect Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `/reports/[id]/view` from bouncing users into an infinite redirect loop with `/reports/[id]` when a report has `price_paid = 0`/`null` and no `succeeded` row is found (yet) in `payments` — replace the redirect with a terminal, self-updating "confirming your payment" state.

**Architecture:** `/reports/[id]/page.tsx` unconditionally `redirect()`s to `/reports/[id]/view`. `/reports/[id]/view/page.tsx`'s payment gate currently `redirect()`s back to `/reports/[id]` whenever it can't find a succeeded payment for a zero/null-`price_paid` report — with no escape condition, this ping-pongs forever (confirmed in production PostHog data: one session hit this pair of routes 310 times in 27 minutes, at server-redirect speed, not human clicking). The fix follows the same shape already used for the report-generation-readiness case (`ReportReadyWatcher` + `/api/reports/[id]/status`): the payment gate becomes a terminal server-rendered state (never redirects) paired with a client-side poller that calls `router.refresh()` once a succeeded payment appears. The gate's allow/pending decision is extracted into a small pure function in `lib/utils/report-access.ts`, mirroring the existing `canViewReport` helper, so the regression case (no payment found → must NOT redirect) is covered by a fast unit test rather than a full page-render test (this codebase has no existing test harness for `ReportViewPage` itself — `canViewReport` is unit-tested the same way, not through the page).

**Tech Stack:** Next.js 16 App Router (Server Components + Route Handlers), Supabase (`supabaseAdmin`), Jest + React Testing Library, `next/navigation` `useRouter`.

## Global Constraints

- Do not modify `app/reports/[id]/page.tsx` — once `/view` stops redirecting back to it, the deprecated redirect-only shim is no longer part of a loop and needs no change. Do not "fix" it defensively; that would be scope creep with no bug to close.
- Do not add a generic redirect-loop guard/circuit-breaker. The loop has exactly one root cause (a redirect with no terminal state); fixing that removes the loop entirely — a generic guard would be solving a problem that no longer exists.
- Run `npm run type-check` and `npm run test:ci` before considering this done, per this repo's standard process (`CLAUDE.md`).
- Follow existing conventions exactly: `ReportReadyWatcher.tsx` / `/api/reports/[id]/status/route.ts` for the poll-and-refresh pattern; `canViewReport` in `lib/utils/report-access.ts` for pure, unit-tested access-decision functions.

---

### Task 1: Extract the payment-gate decision into a pure, tested function

**Files:**

- Modify: `lib/utils/report-access.ts`
- Test: `__tests__/lib/utils/report-access.test.ts`

**Interfaces:**

- Produces: `getPaymentGateStatus(isTokenAccess: boolean, pricePaid: number | null, hasSucceededPayment: boolean): 'allowed' | 'pending_confirmation'` — Task 4 calls this after fetching `report.price_paid` and (conditionally) checking the `payments` table, and branches on the result instead of calling `redirect()`.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/lib/utils/report-access.test.ts` (after the existing `canViewReport` import/describe block):

```ts
import { canViewReport, getPaymentGateStatus } from '@/lib/utils/report-access'

describe('getPaymentGateStatus', () => {
  it('allows token access regardless of price_paid or payment records', () => {
    expect(getPaymentGateStatus(true, null, false)).toBe('allowed')
  })

  it('allows a report with a positive price_paid without checking payments', () => {
    expect(getPaymentGateStatus(false, 2900, false)).toBe('allowed')
  })

  it('allows a zero-price_paid report when a succeeded payment exists (admin free report)', () => {
    expect(getPaymentGateStatus(false, 0, true)).toBe('allowed')
  })

  it('returns pending_confirmation for a null-price_paid report with no succeeded payment', () => {
    expect(getPaymentGateStatus(false, null, false)).toBe('pending_confirmation')
  })

  it('returns pending_confirmation for a zero-price_paid report with no succeeded payment', () => {
    expect(getPaymentGateStatus(false, 0, false)).toBe('pending_confirmation')
  })
})
```

Note: this file already has a top-level `import { canViewReport } from '@/lib/utils/report-access'` — replace that single import line with the combined one above rather than adding a second import statement.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/report-access.test.ts`
Expected: FAIL — `getPaymentGateStatus` is not exported yet.

- [ ] **Step 3: Implement the function**

In `lib/utils/report-access.ts`, add below the existing `canViewReport` function:

```ts
/**
 * Decides whether the payment gate on /reports/[id]/view should let the
 * request through or show a "pending confirmation" state.
 *
 * Never returns a value that implies redirecting elsewhere — the caller
 * must render a terminal state for 'pending_confirmation' rather than
 * bouncing to another route, to avoid recreating the redirect loop this
 * function replaces (see docs/superpowers/plans/2026-08-01-report-view-payment-gate-redirect-loop.md).
 */
export type PaymentGateStatus = 'allowed' | 'pending_confirmation'

export function getPaymentGateStatus(
  isTokenAccess: boolean,
  pricePaid: number | null,
  hasSucceededPayment: boolean
): PaymentGateStatus {
  if (isTokenAccess) return 'allowed'
  if (pricePaid != null && pricePaid > 0) return 'allowed'
  return hasSucceededPayment ? 'allowed' : 'pending_confirmation'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/utils/report-access.test.ts`
Expected: PASS — all 10 tests (5 existing `canViewReport` + 5 new `getPaymentGateStatus`).

- [ ] **Step 5: Commit**

```bash
git add lib/utils/report-access.ts __tests__/lib/utils/report-access.test.ts
git commit -m "feat: add pure payment-gate decision function for report view"
```

---

### Task 2: Add a payment-confirmation status API route

**Files:**

- Create: `app/api/reports/[id]/payment-status/route.ts`
- Test: `__tests__/app/api/reports/[id]/payment-status/route.test.ts`

**Interfaces:**

- Produces: `GET /api/reports/[id]/payment-status` → `{ confirmed: boolean }`. Task 3's client poller calls this endpoint.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/api/reports/[id]/payment-status/route.test.ts`:

```ts
/**
 * Report Payment-Status API Tests
 * GET /api/reports/[id]/payment-status
 * No auth required — returns a confirmation boolean only, no report content.
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/reports/[id]/payment-status/route'
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeRequest(reportId: string) {
  return new Request(`http://localhost:3000/api/reports/${reportId}/payment-status`, {
    method: 'GET',
  })
}

function makeContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}

describe('GET /api/reports/[id]/payment-status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns confirmed: true when a succeeded payment exists for the report', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'payment-123' },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.confirmed).toBe(true)
  })

  it('returns confirmed: false when no succeeded payment exists', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.confirmed).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/app/api/reports/[id]/payment-status/route.test.ts`
Expected: FAIL with a module-not-found error (`app/api/reports/[id]/payment-status/route` doesn't exist yet).

- [ ] **Step 3: Implement the route**

Create `app/api/reports/[id]/payment-status/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('report_id', id)
    .eq('status', 'succeeded')
    .maybeSingle()

  return NextResponse.json({ confirmed: payment != null })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/api/reports/[id]/payment-status/route.test.ts`
Expected: PASS — both tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/reports/\[id\]/payment-status/route.ts __tests__/app/api/reports/\[id\]/payment-status/route.test.ts
git commit -m "feat: add report payment-status API route"
```

---

### Task 3: Add the client-side payment-confirmation poller

**Files:**

- Create: `app/reports/[id]/view/PaymentConfirmationWatcher.tsx`
- Test: `__tests__/app/reports/view/PaymentConfirmationWatcher.test.tsx`

**Interfaces:**

- Consumes: `GET /api/reports/[id]/payment-status` (Task 2) → `{ confirmed: boolean }`.
- Produces: `<PaymentConfirmationWatcher reportId={string} />` — a client component with no return value consumed by callers; Task 4 renders it inside the pending-confirmation terminal state. Polls every 2s (mirrors `ReportReadyWatcher`'s `POLL_INTERVAL_MS`), calls `router.refresh()` on `confirmed: true`, and after 30 failed polls renders an inline "taking longer than usual" message instead of polling forever.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/reports/view/PaymentConfirmationWatcher.test.tsx`:

```tsx
import { render, screen, act, waitFor } from '@testing-library/react'
import { PaymentConfirmationWatcher } from '@/app/reports/[id]/view/PaymentConfirmationWatcher'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// fetch is mocked globally in setup.ts — we override per test
const mockFetch = global.fetch as jest.Mock

describe('PaymentConfirmationWatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders nothing while polling', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: false }),
    })

    const { container } = render(<PaymentConfirmationWatcher reportId="report-abc" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('calls router.refresh() once the payment is confirmed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: true }),
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('keeps polling while not confirmed', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      return {
        ok: true,
        json: async () => ({ confirmed: callCount >= 3 }),
      }
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })
    await act(async () => {
      jest.advanceTimersByTime(2000)
    })
    await act(async () => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
    expect(callCount).toBe(3)
  })

  it('shows a timeout message after 30 failed polls and stops implying a redirect', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: false }),
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(62000)
    })

    await waitFor(() => {
      expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/app/reports/view/PaymentConfirmationWatcher.test.tsx`
Expected: FAIL with a module-not-found error (`app/reports/[id]/view/PaymentConfirmationWatcher` doesn't exist yet).

- [ ] **Step 3: Implement the component**

Create `app/reports/[id]/view/PaymentConfirmationWatcher.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

/**
 * Polls for a succeeded payment and refreshes the (server-rendered) page
 * once found. Never redirects — the payment gate on the parent page used
 * to redirect back to /reports/[id] here, which bounced straight back to
 * /view and created an infinite loop (see
 * docs/superpowers/plans/2026-08-01-report-view-payment-gate-redirect-loop.md).
 */
export function PaymentConfirmationWatcher({ reportId }: Props) {
  const router = useRouter()
  const attemptsRef = useRef(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/payment-status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.confirmed) {
          router.refresh()
          return
        }
      } catch {
        // Network error — keep polling
      }

      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_POLLS) {
        setTimedOut(true)
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    poll()
    return () => clearInterval(timer)
  }, [reportId, router])

  if (timedOut) {
    return (
      <p className="mt-4 text-sm text-amber-700 text-center">
        Still confirming — this is taking longer than usual.
      </p>
    )
  }

  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/reports/view/PaymentConfirmationWatcher.test.tsx`
Expected: PASS — all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/reports/\[id\]/view/PaymentConfirmationWatcher.tsx __tests__/app/reports/view/PaymentConfirmationWatcher.test.tsx
git commit -m "feat: add PaymentConfirmationWatcher polling component"
```

---

### Task 4: Replace the redirect in the payment gate with the terminal state

**Files:**

- Modify: `app/reports/[id]/view/page.tsx:12` (import), `app/reports/[id]/view/page.tsx:134-147` (the gate itself)

**Interfaces:**

- Consumes: `getPaymentGateStatus` (Task 1), `PaymentConfirmationWatcher` (Task 3).

- [ ] **Step 1: Update the imports**

In `app/reports/[id]/view/page.tsx`, change line 12 from:

```ts
import { canViewReport } from '@/lib/utils/report-access'
```

to:

```ts
import { canViewReport, getPaymentGateStatus } from '@/lib/utils/report-access'
```

Add a new import after the existing `PurchaseCompleteTracker` import (currently line 21):

```ts
import { PaymentConfirmationWatcher } from './PaymentConfirmationWatcher'
```

- [ ] **Step 2: Replace the payment gate**

Replace the current block (lines 134-147):

```ts
// Paid gate: skip for token access (token proves buyer paid; webhook fires async).
// Admin free reports have price_paid=0 but have a succeeded payment record.
if (!isTokenAccess && (!report.price_paid || report.price_paid === 0)) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('report_id', id)
    .eq('status', 'succeeded')
    .maybeSingle()

  if (!payment) {
    redirect(`/reports/${id}`)
  }
}
```

with:

```ts
  // Paid gate: skip for token access (token proves buyer paid; webhook fires async).
  // Admin free reports have price_paid=0 but have a succeeded payment record.
  //
  // IMPORTANT: this must never redirect() anywhere. /reports/[id] unconditionally
  // redirects to /reports/[id]/view, so a redirect here for an unconfirmed payment
  // creates an infinite loop between the two routes (see
  // docs/superpowers/plans/2026-08-01-report-view-payment-gate-redirect-loop.md).
  // Instead, render a terminal "pending confirmation" state that polls and
  // self-refreshes once the payment shows up.
  let hasSucceededPayment = false
  if (!isTokenAccess && (!report.price_paid || report.price_paid === 0)) {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('report_id', id)
      .eq('status', 'succeeded')
      .maybeSingle()
    hasSucceededPayment = payment != null
  }

  if (getPaymentGateStatus(isTokenAccess, report.price_paid, hasSucceededPayment) === 'pending_confirmation') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <PaymentConfirmationWatcher reportId={id} />
          <h1 className="text-2xl font-bold text-gray-900">Confirming Your Payment</h1>
          <p className="mt-2 text-gray-600">
            This page will update automatically once your payment is confirmed — usually within a
            few seconds.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Still seeing this after a few minutes? Contact{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:text-blue-500">
              {SUPPORT_EMAIL}
            </a>{' '}
            and we&apos;ll sort it out.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-500">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }
```

`SUPPORT_EMAIL` and `Link` are already imported at the top of this file (lines 10-11), so no further import changes are needed.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Run the targeted test suites touched so far to confirm no regressions**

Run: `npx jest __tests__/lib/utils/report-access.test.ts __tests__/app/api/reports/\[id\]/payment-status/route.test.ts __tests__/app/reports/view/PaymentConfirmationWatcher.test.tsx`
Expected: PASS, all files (this step re-runs Tasks 1-3's suites; it doesn't add a new test file, since this codebase has no existing precedent for rendering `ReportViewPage` itself in a test — `canViewReport`'s call site in this same file isn't render-tested either, only the pure function is, and Task 1 already covers this gate's decision logic that way).

- [ ] **Step 5: Commit**

```bash
git add app/reports/\[id\]/view/page.tsx
git commit -m "fix: replace payment-gate redirect with terminal pending-confirmation state"
```

---

### Task 5: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: PASS, no failures introduced by this change.

- [ ] **Step 2: Run the full type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Manual verification note (for the PR description, not automated)**

In a local/staging environment: create or find a report row with `price_paid = 0` (or `null`) and no `succeeded` row in `payments` for it, then visit `/reports/{id}/view` as its owner (or as an admin). Confirm the page renders "Confirming Your Payment" and does **not** navigate to `/reports/{id}` at all (watch the URL bar / network tab — it should stay on `/view`). Then insert a `succeeded` payment row for that report and confirm the page updates to the full report within ~2 seconds without a manual refresh.
