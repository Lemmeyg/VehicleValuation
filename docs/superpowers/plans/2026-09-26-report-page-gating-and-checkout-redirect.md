# Report Page Gating, Screens & Checkout Redirect (Build Steps 4-6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap the pipeline QA gate (build steps 1-3, already merged) opened: today `/reports/[id]/view`, `/print`, and `/action-plan` show a report's data the instant _any_ valuation is saved, with no check on whether it passed anything. This plan rewrites the status endpoint, adds a single shared "what should this report show" decision, builds the Progress/Held/Refunded/Expired screens, and routes every buyer's checkout redirect through `/view` instead of the old `/success` page — because rewriting the status endpoint's response shape breaks `/success`'s two pollers, so retiring `/success` has to land in the same change, not a later one.

**Architecture:** A pure function (`computeReportDisplayState`) is the single source of truth for which of four screens (progress / held / ready / refunded) a report shows; `/view`, `/print`, and `/action-plan` all call it so they can never disagree. A fifth screen (expired) is a page-level early return based on the existing token-validity check, before any of that. One client component (`ProgressHeldGate`) owns both the progress and held visuals plus the polling logic, since PRD §9.2 says a report "working past 120s" shows the _same_ held message as a genuinely held report.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), Tailwind (existing utility classes only — no new keyframes), Jest + `@testing-library/react`, TypeScript.

**Spec:** `docs/Inbox/report-delivery-prd.md` (v2.1) — build order §20 steps 4, 5, and 6. Read PRD §9 (the whole report-page section), §10 (checkout redirect), and §5.1 (statuses) before starting. `docs/superpowers/plans/2026-09-26-report-delivery-pipeline-qa-gate.md` is the prior plan (steps 1-3, merged) — this one assumes `reports.paid_at`, `reports.progress_step`, `reports.qa_results` etc. already exist and are being written correctly.

## Global Constraints

- Never commit or push to `main` — this branch (`feature/report-delivery-pipeline-qa-gate`) already exists from the prior plan; keep working on it, PR + Vercel Preview, merge only with Skip's explicit confirmation.
- `npm run type-check` and `npm run test:ci` must pass before any task is considered done.
- **Scope decision (documented here because it deviates from a literal steps-4-and-5-only reading):** PRD build step 4 rewrites the status endpoint's response shape to stop leaking email/VIN/price (§9.1, PRD bug 7). That endpoint is also polled today by `ReportReadyPoller` and `AuthenticatedPaymentPoller` on `/reports/[id]/success`, which read `data.ready`, `data.manualReview`, `data.pricePaid`, `data.email`, `data.vin` — fields the new shape removes. Shipping step 4 without step 6 (which retires `/success`) would silently break `/success`'s purchase tracking for the ~9% of buyers who still land there. So this plan bundles steps 4, 5, and 6 together, matching the PRD's own build order being a sequence _within one release_, not three separate deploys.
- Do not touch build steps 7-12 (Zoho enrollment, access-token/refund handling beyond what already exists, admin UI, the daily sweep, PostHog tracking events, the sitewide copy sweep). Those are separate, later plans.
- `selectDisplayComparables` and the existing report-content JSX in `/view`, `/print` are unchanged — this plan only gates _when_ that content renders, never _what_ it renders.
- Admins (`user_metadata.is_admin === true`) must keep being able to view any report's content regardless of status — this is existing, relied-upon behavior for inspecting held reports.
- No new Tailwind keyframes — `tailwind.config.js` currently has `caret-nudge` and `ring-pulse` for unrelated UI; the activity bar and step spinners in this plan use the built-in `animate-pulse` / `animate-spin` utilities already used elsewhere in this codebase (e.g. the existing skeleton loader in `/view`).
- Respect `prefers-reduced-motion` on every animated element via Tailwind's `motion-reduce:`/`motion-safe:` variants (PRD §9.3).

## Review Focus

1. **A held report must never render its report content on `/view`, `/print`, or `/action-plan`.** This is the entire reason this plan exists — a report with `status` in the held set must show the Held screen on all three pages, not the data.
2. **The 120-second display switch must be a client-side timer, not a server round-trip.** A report still genuinely `pending` past 120s must flip to the Held-looking message purely from elapsed time, since the server's own status hasn't changed (PRD §8.1/§9.2) — a test must prove this happens without any new fetch response.
3. **A `completed` report with no `pdf_download_token` yet must still show progress, not the report.** `generateAndUploadPDF` sets both fields together, but a defensive reader must check both — the PRD is explicit that `ready` requires `status = 'completed'` **and** `pdf_download_token` set.
4. **An expired anonymous-access token must show the Expired screen, not silently redirect to `/auth` and lose the person.** Today's `redirect(...&reason=token_expired)` bounces someone who thought they were revisiting their own report to a login page with no explanation.
5. **Every buyer landing on `/view` with `checkout=complete` must fire `payment_success` exactly once, including the previously-uncovered authenticated-without-token case** (today only the token-access branch fires it on `/view`; the authenticated branch relied on `/success`, which this plan retires) — a regression here would silently break purchase-funnel tracking, the exact failure workstream 1 exists to prevent.

---

## File structure

**Create:**

- `lib/constants/report-status.ts` — `HELD_STATUSES`, `isHeldStatus()`.
- `lib/report-display-state.ts` — `computeReportDisplayState()`.
- `app/reports/[id]/view/screens/ProgressHeldGate.tsx` — client component: progress screen, held screen, the 120s timer, and the polling loop.
- `app/reports/[id]/view/screens/RefundedScreen.tsx`, `app/reports/[id]/view/screens/ExpiredScreen.tsx` — static screens.
- `app/reports/[id]/view/RedditPurchaseTracker.tsx` — moved from `app/reports/[id]/success/` (same content, new home).
- Tests: `__tests__/lib/report-display-state.test.ts`, `__tests__/app/reports/view/ProgressHeldGate.test.tsx`, `__tests__/app/reports/view/screens.test.tsx` (Refunded/Expired), `__tests__/app/reports/view/page.test.tsx`, `__tests__/app/reports/print/page-gating.test.tsx` (new gating cases, alongside the existing `print/page.test.tsx`), `__tests__/app/reports/action-plan/page.test.tsx`, `__tests__/app/reports/view/RedditPurchaseTracker.test.tsx` (moved).

**Modify:**

- `app/api/reports/[id]/status/route.ts` + its test — full rewrite to the §9.1 shape.
- `app/reports/[id]/view/page.tsx` — gating, admin bypass, purchase-tracker condition, Reddit tracker.
- `app/reports/[id]/print/page.tsx`, `app/reports/[id]/action-plan/page.tsx` — same gate.
- `app/reports/[id]/view/print-pdf-buttons.tsx` + its test — hidden until released; "Download PDF" now hits the download route directly.
- `app/api/reports/download/[token]/route.ts` — reads a `source` query param.
- `lib/analytics/events.ts` — add `'page'` to `ReportDownloadSource`.
- `app/api/lemonsqueezy/create-checkout/route.ts` + its test — every `successUrl` targets `/view`.
- `app/reports/[id]/success/page.tsx` + its test — becomes a thin redirect to `/view`, preserving query params.

**Delete:**

- `app/reports/[id]/view/ReportReadyWatcher.tsx` + its test (no test currently exists for it — confirmed; nothing to remove there) — superseded by `ProgressHeldGate`.
- `app/reports/[id]/success/ReportReadyPoller.tsx`, `AuthenticatedPaymentPoller.tsx`, `PostHogPurchaseTracker.tsx`, `RedditPurchaseTracker.tsx`, and their tests (`ReportReadyPoller.test.tsx`, `PostHogPurchaseTracker.test.tsx`) — superseded by `/view`'s existing `PurchaseCompleteTracker` (condition widened in Task 5) plus the moved `RedditPurchaseTracker`.

---

### Task 1: Shared held-status constant + status endpoint rewrite (§9.1)

**Files:**

- Create: `lib/constants/report-status.ts`
- Modify: `app/api/reports/[id]/status/route.ts`
- Modify (rewrite): `__tests__/app/api/reports/[id]/status/route.test.ts`

**Interfaces:**

- Produces: `HELD_STATUSES: readonly string[]`, `isHeldStatus(status): boolean`. Consumed by this task's route rewrite and by Task 2's `computeReportDisplayState`.
- Produces: the status endpoint's new JSON shape `{ state: 'awaiting_payment' | 'working' | 'held' | 'ready' | 'refunded'; step: 'comps' | 'listings' | 'valuation' | 'pdf' | null; paidAt: string | null }`. Consumed by Task 3's `ProgressHeldGate`.

- [ ] **Step 1: Write the failing tests**

Create `lib/constants/report-status.ts` tests are trivial enough to fold into this task's route test file rather than a separate suite (it's a 6-line constant module) — instead, write the route's new test file first, since it exercises the constant indirectly and is the actual behavior that matters. Replace `__tests__/app/api/reports/[id]/status/route.test.ts` entirely:

```ts
/**
 * Report Status API Tests
 * GET /api/reports/[id]/status
 * No auth required — returns only enough to drive the page's screens, never
 * email/VIN/price (docs/Inbox/report-delivery-prd.md §9.1, bug 7).
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/reports/[id]/status/route'
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeRequest(reportId: string) {
  return new Request(`http://localhost:3000/api/reports/${reportId}/status`, { method: 'GET' })
}
function makeContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}
function mockReport(row: Record<string, unknown>) {
  mockAdmin.from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: row, error: null }),
  }) as any
}

describe('GET /api/reports/[id]/status', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 404 when report not found', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }) as any

    const response = await GET(makeRequest('nope'), makeContext('nope'))
    expect(response.status).toBe(404)
  })

  it('returns awaiting_payment when there is no price_paid yet', async () => {
    mockReport({
      price_paid: null,
      status: 'draft',
      progress_step: null,
      paid_at: null,
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'awaiting_payment', step: null, paidAt: null })
  })

  it('returns working with the current progress_step for a paid, in-progress report', async () => {
    mockReport({
      price_paid: 2900,
      status: 'pending',
      progress_step: 'listings',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'working', step: 'listings', paidAt: '2026-09-26T12:00:00Z' })
  })

  it.each(['needs_review', 'vin_decode_failed', 'valuation_failed', 'failed'])(
    'returns held (with step: null) for status %s',
    async status => {
      mockReport({
        price_paid: 2900,
        status,
        progress_step: 'valuation',
        paid_at: '2026-09-26T12:00:00Z',
        pdf_download_token: null,
      })
      const response = await GET(makeRequest('r1'), makeContext('r1'))
      const data = await response.json()
      expect(data.state).toBe('held')
      expect(data.step).toBeNull()
    }
  )

  it('returns refunded', async () => {
    mockReport({
      price_paid: 2900,
      status: 'refunded',
      progress_step: null,
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: 'tok-1',
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data.state).toBe('refunded')
  })

  it('returns ready only when status is completed AND pdf_download_token is set', async () => {
    mockReport({
      price_paid: 2900,
      status: 'completed',
      progress_step: 'pdf',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: 'tok-1',
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'ready', step: null, paidAt: '2026-09-26T12:00:00Z' })
  })

  it('returns working (not ready) when status is completed but pdf_download_token is not set yet', async () => {
    mockReport({
      price_paid: 2900,
      status: 'completed',
      progress_step: 'pdf',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data.state).toBe('working')
  })

  it('never includes email, vin, or price fields', async () => {
    mockReport({
      price_paid: 2900,
      status: 'completed',
      progress_step: null,
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: 'tok-1',
      email: 'buyer@example.com',
      vin: '1HGBH41JXMN109186',
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('vin')
    expect(data).not.toHaveProperty('pricePaid')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest "__tests__/app/api/reports/\[id\]/status/route.test.ts"`
Expected: FAIL — the current route returns `{ ready, manualReview, ... }`, not `{ state, step, paidAt }`.

- [ ] **Step 3: Create the shared constant**

```ts
// lib/constants/report-status.ts
/**
 * Every status a PAID report can end up in where the pipeline stopped short
 * of releasing it — the customer sees the held screen, not their report
 * (docs/Inbox/report-delivery-prd.md §5.1). Defined once per the PRD's own
 * instruction; every place that used to special-case vin_decode_failed/
 * valuation_failed individually should read this instead.
 */
export const HELD_STATUSES = [
  'needs_review',
  'vin_decode_failed',
  'valuation_failed',
  'failed',
] as const

export type HeldStatus = (typeof HELD_STATUSES)[number]

export function isHeldStatus(status: string | null | undefined): status is HeldStatus {
  return !!status && (HELD_STATUSES as readonly string[]).includes(status)
}
```

- [ ] **Step 4: Rewrite the route**

```ts
// app/api/reports/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { isHeldStatus } from '@/lib/constants/report-status'

interface RouteContext {
  params: Promise<{ id: string }>
}

type ReportApiState = 'awaiting_payment' | 'working' | 'held' | 'ready' | 'refunded'

/**
 * Drives the report page's screens only — no report content, email, VIN, or
 * price (docs/Inbox/report-delivery-prd.md §9.1, fixes bug 7). The 120-second
 * display rule is applied by the page from paidAt, not by this endpoint.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('price_paid, status, progress_step, paid_at, pdf_download_token')
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const paid = report.price_paid != null && report.price_paid > 0

  let state: ReportApiState
  if (report.status === 'refunded') {
    state = 'refunded'
  } else if (isHeldStatus(report.status)) {
    state = 'held'
  } else if (report.status === 'completed' && report.pdf_download_token) {
    state = 'ready'
  } else if (!paid) {
    state = 'awaiting_payment'
  } else {
    state = 'working'
  }

  return NextResponse.json({
    state,
    step: state === 'working' ? ((report.progress_step as string | null) ?? null) : null,
    paidAt: (report.paid_at as string | null) ?? null,
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest "__tests__/app/api/reports/\[id\]/status/route.test.ts"`
Expected: PASS (9 tests).

- [ ] **Step 6: Run type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/constants/report-status.ts app/api/reports/[id]/status/route.ts "__tests__/app/api/reports/[id]/status/route.test.ts"
git commit -m "$(cat <<'EOF'
Rewrite the report status endpoint (PRD §9.1)

Replaces {ready, manualReview, pricePaid, vin, email} with
{state, step, paidAt}. Fixes bug 7 (leaking email/VIN/price to anyone with
a report ID) and bug 2 ("ready" before the PDF exists). Adds the shared
HELD_STATUSES constant the PRD asks for, seeded from the existing
vin_decode_failed/valuation_failed pair plus needs_review and failed.

This is a breaking change for /reports/[id]/success's two pollers, which
this same plan retires in a later task — see this plan's Global
Constraints for why steps 4 and 6 had to land together.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `computeReportDisplayState` — the shared screen decision

**Files:**

- Create: `lib/report-display-state.ts`
- Test: `__tests__/lib/report-display-state.test.ts`

**Interfaces:**

- Consumes: `isHeldStatus` from `@/lib/constants/report-status` (Task 1).
- Produces: `ReportDisplayState = 'progress' | 'held' | 'ready' | 'refunded'`, `computeReportDisplayState({ status, pdfDownloadToken }): ReportDisplayState`. Consumed by Tasks 5 and 6 (`/view`, `/print`, `/action-plan`). Deliberately does **not** handle the "expired" case — an expired access token is checked earlier, on the page, before a report is even fetched (Tasks 5/6), so this function only ever needs to be able to represent the four states that follow a valid access check.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/report-display-state.test.ts
import { computeReportDisplayState } from '@/lib/report-display-state'

describe('computeReportDisplayState', () => {
  it('returns refunded when status is refunded, regardless of other fields', () => {
    expect(computeReportDisplayState({ status: 'refunded', pdfDownloadToken: 'tok-1' })).toBe(
      'refunded'
    )
  })

  it.each(['needs_review', 'vin_decode_failed', 'valuation_failed', 'failed'])(
    'returns held for status %s',
    status => {
      expect(computeReportDisplayState({ status, pdfDownloadToken: null })).toBe('held')
    }
  )

  it('returns ready when status is completed and a pdfDownloadToken exists', () => {
    expect(computeReportDisplayState({ status: 'completed', pdfDownloadToken: 'tok-1' })).toBe(
      'ready'
    )
  })

  it('returns progress when status is completed but there is no pdfDownloadToken yet', () => {
    expect(computeReportDisplayState({ status: 'completed', pdfDownloadToken: null })).toBe(
      'progress'
    )
  })

  it('returns progress for pending', () => {
    expect(computeReportDisplayState({ status: 'pending', pdfDownloadToken: null })).toBe(
      'progress'
    )
  })

  it('refunded takes priority over held (a held report can still be refunded)', () => {
    expect(computeReportDisplayState({ status: 'refunded', pdfDownloadToken: null })).toBe(
      'refunded'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/report-display-state.test.ts`
Expected: FAIL — `Cannot find module '@/lib/report-display-state'`

- [ ] **Step 3: Implement**

```ts
// lib/report-display-state.ts
import { isHeldStatus } from '@/lib/constants/report-status'

export type ReportDisplayState = 'progress' | 'held' | 'ready' | 'refunded'

export interface ReportDisplayInputs {
  status: string
  pdfDownloadToken: string | null
}

/**
 * The single source of truth for which screen a report shows.
 * /view, /print, and /action-plan all call this so they can never disagree
 * about a report's readiness (docs/Inbox/report-delivery-prd.md §9.2).
 */
export function computeReportDisplayState(inputs: ReportDisplayInputs): ReportDisplayState {
  if (inputs.status === 'refunded') return 'refunded'
  if (isHeldStatus(inputs.status)) return 'held'
  if (inputs.status === 'completed' && inputs.pdfDownloadToken) return 'ready'
  return 'progress'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/report-display-state.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run type-check**

Run: `npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add lib/report-display-state.ts __tests__/lib/report-display-state.test.ts
git commit -m "$(cat <<'EOF'
Add computeReportDisplayState — one gate for /view, /print, /action-plan

Pure function so the three report pages can never disagree about whether
a report is ready to show. Deliberately excludes the "expired" case,
which each page checks earlier from its own access-token validity check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `ProgressHeldGate` — the progress/held screens, the 120s timer, and polling

**Files:**

- Create: `app/reports/[id]/view/screens/ProgressHeldGate.tsx`
- Test: `__tests__/app/reports/view/ProgressHeldGate.test.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks at compile time; calls `GET /api/reports/[id]/status` (Task 1's shape) at runtime.
- Produces: `ProgressHeldGate({ reportId, vehicleLabel, paidAt, initialState }: { reportId: string; vehicleLabel: string; paidAt: string | null; initialState: 'held' | 'progress' })`. Consumed by Task 5 (`/view`).

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/app/reports/view/ProgressHeldGate.test.tsx
import { render, screen, act } from '@testing-library/react'
import { ProgressHeldGate } from '@/app/reports/[id]/view/screens/ProgressHeldGate'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

describe('ProgressHeldGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'working', step: 'comps', paidAt: null }),
    }) as jest.Mock
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the held message immediately when initialState is held, even at 0 elapsed time', () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="held"
      />
    )
    expect(screen.getByText(/we're double-checking your data/i)).toBeInTheDocument()
    expect(screen.getByText(/2019 Honda CR-V/)).toBeInTheDocument()
  })

  it('shows the progress steps when initialState is progress and under 120s have elapsed', () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )
    expect(screen.getByText(/building your report for 2019 Honda CR-V/i)).toBeInTheDocument()
    expect(screen.getByText(/finding comparable vehicles/i)).toBeInTheDocument()
    expect(screen.getByText(/this usually takes under a minute/i)).toBeInTheDocument()
  })

  it('flips to the held message purely from elapsed time at 120s, with no new server response', async () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )
    expect(screen.queryByText(/we're double-checking your data/i)).not.toBeInTheDocument()

    await act(async () => {
      jest.advanceTimersByTime(121_000)
    })

    expect(screen.getByText(/we're double-checking your data/i)).toBeInTheDocument()
  })

  it('calls router.refresh() when the poller sees a non-working state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'ready', step: null, paidAt: null }),
    })

    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(refreshMock).toHaveBeenCalled()
  })

  it('does not call router.refresh() while the poller keeps seeing working', async () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('marks the current step from the polled response as active', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'working', step: 'valuation', paidAt: null }),
    })

    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    const valuationStep = screen.getByText(/calculating vehicle valuation/i)
    expect(valuationStep.className).toContain('text-slate-900')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/app/reports/view/ProgressHeldGate.test.tsx`
Expected: FAIL — `Cannot find module '@/app/reports/[id]/view/screens/ProgressHeldGate'`

- [ ] **Step 3: Implement**

```tsx
// app/reports/[id]/view/screens/ProgressHeldGate.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORT_EMAIL } from '@/lib/constants'

interface Props {
  reportId: string
  vehicleLabel: string
  paidAt: string | null
  initialState: 'held' | 'progress'
}

const HOLD_CUTOFF_MS = 120_000
const FAST_POLL_MS = 2_000
const SLOW_POLL_MS = 15_000
const POLL_STOP_MS = 15 * 60 * 1000

const STEPS: { key: 'comps' | 'listings' | 'valuation' | 'pdf'; label: string }[] = [
  { key: 'comps', label: 'Finding comparable vehicles' },
  { key: 'listings', label: 'Checking listings are live' },
  { key: 'valuation', label: 'Calculating vehicle valuation' },
  { key: 'pdf', label: 'Building your report' },
]

function reassuranceLine(elapsedMs: number): string {
  if (elapsedMs < 30_000) return 'This usually takes under a minute.'
  if (elapsedMs < 60_000) return 'Still working — some vehicles take a little longer.'
  return "Almost there — we're making sure every comparable holds up."
}

/**
 * Renders both the progress screen and the held screen, and owns the
 * polling that decides when to switch between them (or hand off to the
 * server-rendered ready/refunded content via router.refresh()).
 *
 * A report still "working" past 120 seconds shows the identical held
 * message as a genuinely held report — that's a display rule, not a status
 * change (docs/Inbox/report-delivery-prd.md §8.1/§9.2), so this component
 * decides that switch from a client-side clock, never from the server.
 */
export function ProgressHeldGate({ reportId, vehicleLabel, paidAt, initialState }: Props) {
  const router = useRouter()
  const startedAt = useRef(paidAt ? new Date(paidAt).getTime() : Date.now())
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - startedAt.current)
  const [step, setStep] = useState<'comps' | 'listings' | 'valuation' | 'pdf' | null>(null)
  const [heldByTimeout, setHeldByTimeout] = useState(elapsedMs >= HOLD_CUTOFF_MS)

  const showHeld = initialState === 'held' || heldByTimeout

  useEffect(() => {
    if (showHeld) return
    const tick = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 1000)
    return () => clearInterval(tick)
  }, [showHeld])

  useEffect(() => {
    if (elapsedMs >= HOLD_CUTOFF_MS) setHeldByTimeout(true)
  }, [elapsedMs])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (cancelled) return
      if (Date.now() - startedAt.current >= POLL_STOP_MS) return

      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (res.ok) {
          const data = await res.json()
          if (data.state && data.state !== 'working' && data.state !== 'awaiting_payment') {
            router.refresh()
            return
          }
          if (typeof data.step === 'string') setStep(data.step)
        }
      } catch {
        // network error — keep polling
      }

      if (cancelled) return
      const interval = Date.now() - startedAt.current < HOLD_CUTOFF_MS ? FAST_POLL_MS : SLOW_POLL_MS
      timer = setTimeout(poll, interval)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  if (showHeld) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center motion-safe:animate-pulse motion-reduce:animate-none">
            <div className="h-8 w-8 rounded-full bg-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            We&apos;re double-checking your data
          </h1>
          <p className="text-slate-600 mb-4">
            Your {vehicleLabel} report needs a closer look to make sure every comparable vehicle
            holds up against the insurer. You don&apos;t need to do anything — we&apos;ll email you
            at the address you used at checkout within 2 business days.
          </p>
          <p className="text-sm text-slate-500">
            Questions?{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-emerald-600 font-semibold mb-1">✓ Payment confirmed</p>
        <h1 className="text-xl font-bold text-slate-900 mb-6">
          Building your report for {vehicleLabel}
        </h1>
        <ul className="text-left space-y-3 mb-6">
          {STEPS.map((s, i) => {
            const done = activeIndex > i
            const active = activeIndex === i
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={
                    done
                      ? 'h-5 w-5 rounded-full bg-emerald-500 flex-shrink-0'
                      : active
                        ? 'h-5 w-5 rounded-full border-2 border-emerald-500 motion-safe:animate-spin motion-reduce:animate-none flex-shrink-0'
                        : 'h-5 w-5 rounded-full border-2 border-slate-300 flex-shrink-0'
                  }
                />
                <span className={done || active ? 'text-slate-900' : 'text-slate-400'}>
                  {s.label}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
          <div className="h-full w-full bg-emerald-500 rounded-full motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
        <p className="text-sm text-slate-500">{reassuranceLine(elapsedMs)}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/app/reports/view/ProgressHeldGate.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Run type-check**

Run: `npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add app/reports/[id]/view/screens/ProgressHeldGate.tsx __tests__/app/reports/view/ProgressHeldGate.test.tsx
git commit -m "$(cat <<'EOF'
Add ProgressHeldGate — progress/held screens, 120s timer, polling (PRD §9.2-9.4)

Replaces ReportReadyWatcher (deleted in a later task). The 120-second
switch to the held message is a client-side clock, not a server signal —
a report still genuinely pending past 120s shows the same calm message
as one that's actually held, per PRD §8.1/§9.2.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `RefundedScreen` and `ExpiredScreen`

**Files:**

- Create: `app/reports/[id]/view/screens/RefundedScreen.tsx`, `app/reports/[id]/view/screens/ExpiredScreen.tsx`
- Test: `__tests__/app/reports/view/screens.test.tsx`

**Interfaces:**

- Produces: `RefundedScreen()`, `ExpiredScreen()` — no props. Consumed by Tasks 5 and 6.

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/app/reports/view/screens.test.tsx
import { render, screen } from '@testing-library/react'
import { RefundedScreen } from '@/app/reports/[id]/view/screens/RefundedScreen'
import { ExpiredScreen } from '@/app/reports/[id]/view/screens/ExpiredScreen'

describe('RefundedScreen', () => {
  it('shows the refunded message and support email', () => {
    render(<RefundedScreen />)
    expect(screen.getByText(/this order was refunded/i)).toBeInTheDocument()
    expect(screen.getByText(/support@totallosstoolkit\.com/)).toBeInTheDocument()
  })
})

describe('ExpiredScreen', () => {
  it('shows the expired message with the 7-day explanation and support email', () => {
    render(<ExpiredScreen />)
    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
    expect(screen.getByText(/7 days/)).toBeInTheDocument()
    expect(screen.getByText(/support@totallosstoolkit\.com/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/app/reports/view/screens.test.tsx`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

```tsx
// app/reports/[id]/view/screens/RefundedScreen.tsx
import { SUPPORT_EMAIL } from '@/lib/constants'

export function RefundedScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-3">This order was refunded</h1>
        <p className="text-slate-600">
          Questions?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  )
}
```

```tsx
// app/reports/[id]/view/screens/ExpiredScreen.tsx
import { SUPPORT_EMAIL } from '@/lib/constants'

export function ExpiredScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-3">This report link has expired</h1>
        <p className="text-slate-600">
          Report links stay active for 7 days after your report is ready. Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          from the address you used at checkout and we&apos;ll help.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/app/reports/view/screens.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run type-check**

Run: `npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add app/reports/[id]/view/screens/RefundedScreen.tsx app/reports/[id]/view/screens/ExpiredScreen.tsx __tests__/app/reports/view/screens.test.tsx
git commit -m "$(cat <<'EOF'
Add RefundedScreen and ExpiredScreen (PRD §9.2, §9.4, §12)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire `/reports/[id]/view`

**Files:**

- Modify: `app/reports/[id]/view/page.tsx`
- Delete: `app/reports/[id]/view/ReportReadyWatcher.tsx`
- Test: `__tests__/app/reports/view/page.test.tsx` (new)

**Interfaces:**

- Consumes: `computeReportDisplayState` (Task 2), `ProgressHeldGate`, `RefundedScreen`, `ExpiredScreen` (Tasks 3-4), `RedditPurchaseTracker` (moved in Task 9 — for this task, create it now at its new home so this task isn't blocked on Task 9's ordering; Task 9 will find it already there and skip re-creating it).

This task both adds the gate and removes now-dead code (`ReportReadyWatcher`, the `!isReady` skeleton branch).

- [ ] **Step 1: Create `RedditPurchaseTracker` at its new home (needed by this task, formally relocated in Task 9)**

```tsx
// app/reports/[id]/view/RedditPurchaseTracker.tsx
'use client'

import { useEffect, useRef } from 'react'
import { trackRedditPurchase } from '@/lib/analytics/reddit-events'

export function RedditPurchaseTracker({
  value,
  currency,
  transactionId,
}: {
  value: number
  currency: string
  transactionId?: string
}) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true

    trackRedditPurchase({
      value,
      currency,
      transactionId,
      itemCount: 1,
    })
  }, [value, currency, transactionId])

  return null
}
```

- [ ] **Step 2: Write the failing tests**

```tsx
// __tests__/app/reports/view/page.test.tsx
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: supabaseFromMock },
}))

jest.mock('@/lib/utils/report-access', () => ({
  canViewReport: jest.fn(() => true),
  getPaymentGateStatus: jest.fn(() => 'allowed'),
}))
jest.mock('@/components/MarketCharts', () => ({ MarketCharts: () => null }))
jest.mock('@/components/ReportViewTracker', () => ({ ReportViewTracker: () => null }))
jest.mock('@/app/reports/[id]/view/print-pdf-buttons', () => ({ PrintPdfButtons: () => null }))
jest.mock('@/app/reports/[id]/view/TokenAccessBanner', () => ({ TokenAccessBanner: () => null }))
jest.mock('@/app/reports/[id]/view/PurchaseCompleteTracker', () => ({
  PurchaseCompleteTracker: () => null,
}))
jest.mock('@/app/reports/[id]/view/RedditPurchaseTracker', () => ({
  RedditPurchaseTracker: () => null,
}))
jest.mock('@/app/reports/[id]/view/PaymentConfirmationWatcher', () => ({
  PaymentConfirmationWatcher: () => null,
}))
jest.mock('@/app/reports/[id]/view/screens/ProgressHeldGate', () => ({
  ProgressHeldGate: ({ initialState }: { initialState: string }) => (
    <div data-testid="progress-held-gate" data-initial-state={initialState} />
  ),
}))
jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})
jest.mock('next/image', () => {
  return function MockImage() {
    return null
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'

const baseReport = {
  id: 'report-1',
  user_id: 'user-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  zip_code: '90210',
  price_paid: 2900,
  created_at: '2026-09-20T12:00:00Z',
  paid_at: '2026-09-26T12:00:00Z',
  access_token: null,
  access_token_expires_at: null,
  autodev_vin_data: { make: 'Honda', model: 'CR-V', vehicle: { year: 2019 } },
  marketcheck_valuation: null,
  pdf_download_token: null,
}

function mockSupabase(reportRow: Record<string, unknown>) {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'reports') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
        update: jest.fn().mockReturnThis(),
      }
    }
    if (table === 'payments') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

const getViewPage = () => import('@/app/reports/[id]/view/page').then(m => m.default)

describe('Report view page — gating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
  })

  it('shows the ProgressHeldGate with initialState progress for a pending report, never the report content', async () => {
    mockSupabase({ ...baseReport, status: 'pending', marketcheck_valuation: null })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('progress-held-gate')).toHaveAttribute(
      'data-initial-state',
      'progress'
    )
    expect(screen.queryByText(/vehicle specifications/i)).not.toBeInTheDocument()
  })

  it('shows the ProgressHeldGate with initialState held for a needs_review report, even with valuation data saved', async () => {
    mockSupabase({
      ...baseReport,
      status: 'needs_review',
      marketcheck_valuation: {
        predictedPrice: 25000,
        recentComparables: { listings: [{ vin: 'X', price: 25000, miles: 1 }] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('progress-held-gate')).toHaveAttribute('data-initial-state', 'held')
    expect(screen.queryByText(/vehicle specifications/i)).not.toBeInTheDocument()
    expect(screen.queryByText('25000')).not.toBeInTheDocument()
  })

  it('shows the RefundedScreen for a refunded report', async () => {
    mockSupabase({ ...baseReport, status: 'refunded' })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this order was refunded/i)).toBeInTheDocument()
  })

  it('shows the full report content for a completed report with a pdf_download_token', async () => {
    mockSupabase({
      ...baseReport,
      status: 'completed',
      pdf_download_token: 'tok-1',
      marketcheck_valuation: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { listings: [] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/vehicle specifications/i)).toBeInTheDocument()
    expect(screen.queryByTestId('progress-held-gate')).not.toBeInTheDocument()
  })

  it('does NOT show the full report content for a completed report with no pdf_download_token yet', async () => {
    mockSupabase({
      ...baseReport,
      status: 'completed',
      pdf_download_token: null,
      marketcheck_valuation: { predictedPrice: 25000, recentComparables: { listings: [] } },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByText(/vehicle specifications/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('progress-held-gate')).toBeInTheDocument()
  })

  it('lets an admin see the full report content for a held report (existing behavior, preserved)', async () => {
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'admin-1', user_metadata: { is_admin: true } })
    mockSupabase({
      ...baseReport,
      user_id: 'someone-else',
      status: 'needs_review',
      marketcheck_valuation: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { listings: [] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/vehicle specifications/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest "__tests__/app/reports/view/page.test.tsx"`
Expected: FAIL — `page.tsx` still uses `isReady = marketCheck != null` with no status gate, so several assertions about the ProgressHeldGate/RefundedScreen not existing or the content leaking will fail.

- [ ] **Step 4: Edit `app/reports/[id]/view/page.tsx`**

Replace the import block:

```ts
import { getUser } from '@/lib/db/auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/constants'
import { canViewReport, getPaymentGateStatus } from '@/lib/utils/report-access'
import Image from 'next/image'
import { Car, FileText } from 'lucide-react'
import { getListingsStats } from '@/lib/utils/listing-filters'
import { selectDisplayComparables } from '@/lib/utils/comparables-ranker'
import { formatDateET } from '@/lib/utils/format-date-eastern'
import { MarketCharts } from '@/components/MarketCharts'
import { PrintPdfButtons } from './print-pdf-buttons'
import { ReportViewTracker } from '@/components/ReportViewTracker'
import { TokenAccessBanner } from './TokenAccessBanner'
import { PurchaseCompleteTracker } from './PurchaseCompleteTracker'
import { RedditPurchaseTracker } from './RedditPurchaseTracker'
import { PaymentConfirmationWatcher } from './PaymentConfirmationWatcher'
import { computeReportDisplayState } from '@/lib/report-display-state'
import { ProgressHeldGate } from './screens/ProgressHeldGate'
import { RefundedScreen } from './screens/RefundedScreen'
import { ExpiredScreen } from './screens/ExpiredScreen'
```

(Drops the `ReportReadyWatcher` import.)

Replace the token-validity block:

```ts
if (!tokenValid) {
  redirect(`/auth?redirect=/reports/${id}/view&reason=token_expired`)
}

isTokenAccess = true
```

with:

```ts
    if (!tokenValid) {
      return <ExpiredScreen />
    }

    isTokenAccess = true
```

Immediately after the existing block that computes `purchaseTrackerProps` (the `if (isTokenAccess && checkout === 'complete') { ... }` block), widen its condition so an authenticated buyer with no token also gets tracked now that `/success` (their old destination) is retired:

```ts
  if (checkout === 'complete') {
```

(was `if (isTokenAccess && checkout === 'complete') {`).

Replace:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autodevData = report.autodev_vin_data as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const marketCheck = report.marketcheck_valuation as any

// Report is ready when marketcheck data is populated (webhook fires async after payment)
const isReady = marketCheck != null
```

with:

```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autodevData = report.autodev_vin_data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marketCheck = report.marketcheck_valuation as any

  const vehicleLabel =
    `${autodevData?.vehicle?.year ?? ''} ${autodevData?.make ?? ''} ${autodevData?.model ?? ''}`.trim() ||
    'your vehicle'

  const trackers = purchaseTrackerProps && (
    <>
      <PurchaseCompleteTracker
        reportId={id}
        planType={purchaseTrackerProps.planType}
        amountCents={purchaseTrackerProps.amountCents}
        transactionId={purchaseTrackerProps.transactionId}
        email={report.email ?? undefined}
        vin={report.vin}
      />
      <RedditPurchaseTracker
        value={purchaseTrackerProps.amountCents / 100}
        currency="USD"
        transactionId={purchaseTrackerProps.transactionId}
      />
    </>
  )

  // Admins can inspect any report's content whatever its status (existing
  // behavior) — everyone else goes through the shared gate (PRD §9.5).
  const displayState = isAdmin
    ? marketCheck != null
      ? 'ready'
      : 'progress'
    : computeReportDisplayState({
        status: report.status,
        pdfDownloadToken: (report.pdf_download_token as string | null) ?? null,
      })

  if (displayState === 'refunded') {
    return <RefundedScreen />
  }

  if (displayState !== 'ready') {
    return (
      <>
        {trackers}
        <ProgressHeldGate
          reportId={id}
          vehicleLabel={vehicleLabel}
          paidAt={(report.paid_at as string | null) ?? null}
          initialState={displayState === 'held' ? 'held' : 'progress'}
        />
      </>
    )
  }
```

Delete the `// Report is ready when...` comment's old spot is already replaced above. Now delete the entire `{!isReady ? ( ... skeleton ... ) : ( ... report content ... )}` ternary's skeleton branch — since we've already returned above for every non-ready case, replace:

```tsx
{
  /* Valuation content — skeleton while report is generating, full content when ready */
}
{
  !isReady ? (
    <>
      <ReportReadyWatcher reportId={id} />
      {/* Skeleton for value cards */}
      ...
      {/* Skeleton for comparables table */}
      ...
    </>
  ) : (
    <>... (existing "ready" content, unchanged) ...</>
  )
}
```

with just the existing "ready" content, unwrapped from the ternary (delete the `!isReady` branch and the surrounding `{!isReady ? (\n  <>\n ... \n </>\n) : (\n <>` / closing `</>\n)}` — the "ready" JSX itself, from the Market Value Cards through the Additional Valuation Considerations block and the Action Plan CTA, is unchanged).

Also render `{trackers}` once near the top of this remaining "ready" JSX (where `{purchaseTrackerProps && (<PurchaseCompleteTracker ... />)}` currently sits) instead of the old single-tracker block — replace that block with `{trackers}`.

- [ ] **Step 5: Delete `ReportReadyWatcher.tsx`**

```bash
git rm app/reports/[id]/view/ReportReadyWatcher.tsx
```

(No test file exists for it today — confirmed via `find __tests__ -iname '*ReportReadyWatcher*'` returning nothing — so there is nothing else to remove.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest "__tests__/app/reports/view/page.test.tsx"`
Expected: PASS (6 tests).

- [ ] **Step 7: Run the full existing view-related test suites for regressions**

Run: `npx jest __tests__/app/reports/view`
Expected: PASS — `PaymentConfirmationWatcher.test.tsx`, `print-pdf-buttons.test.tsx` (not yet touched — Task 7 rewrites it), `PurchaseCompleteTracker.test.tsx`, plus this task's new files, all pass.

- [ ] **Step 8: Run type-check**

Run: `npm run type-check`

- [ ] **Step 9: Commit**

```bash
git add app/reports/[id]/view/page.tsx app/reports/[id]/view/RedditPurchaseTracker.tsx "__tests__/app/reports/view/page.test.tsx"
git rm app/reports/[id]/view/ReportReadyWatcher.tsx
git commit -m "$(cat <<'EOF'
Gate /reports/[id]/view behind computeReportDisplayState (PRD §9.5)

The page no longer decides readiness from "does marketcheck_valuation
exist" — it uses the shared gate, so a held or still-working report never
renders its (possibly thin or incomplete) content. Admins keep their
existing ability to inspect any report regardless of status.

Also widens payment_success tracking to fire for authenticated buyers
with no access token landing here with checkout=complete — previously
only the token-access branch covered this; the authenticated branch
relied on /success, which a later task in this plan retires.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Gate `/print` and `/action-plan`

**Files:**

- Modify: `app/reports/[id]/print/page.tsx`, `app/reports/[id]/action-plan/page.tsx`
- Test: `__tests__/app/reports/print/page-gating.test.tsx` (new — alongside the existing `print/page.test.tsx`, which keeps passing unchanged), `__tests__/app/reports/action-plan/page.test.tsx` (new — no page-level test exists for action-plan today)

**Interfaces:**

- Consumes: `computeReportDisplayState` (Task 2), `ExpiredScreen` (Task 4).

Per PRD §9.5: an unreleased report on either page redirects to `/view` (carrying the token, matching the existing pattern used elsewhere in `action-plan/page.tsx` for its own CTA link); an expired token shows `ExpiredScreen` directly, same as `/view`.

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/app/reports/print/page-gating.test.tsx
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({ supabaseAdmin: { from: supabaseFromMock } }))
jest.mock('@/lib/utils/report-access', () => ({ canViewReport: jest.fn(() => true) }))
jest.mock('@/lib/utils/listing-filters', () => ({
  getLowestDOSActiveListings: jest.fn(() => []),
  getListingsStats: jest.fn(() => ({ count: 0 })),
}))
jest.mock('@/app/reports/[id]/print/PrintToolbar', () => ({ PrintToolbar: () => null }))
jest.mock('@/components/MarketCharts', () => ({ MarketCharts: () => null }))
jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'
import { redirect } from 'next/navigation'
import { canViewReport } from '@/lib/utils/report-access'

const validReport = {
  id: 'report-1',
  user_id: 'user-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  price_paid: 4900,
  created_at: '2026-06-01T12:00:00Z',
  autodev_vin_data: { make: 'Honda', model: 'Civic', vehicle: { year: 2020 } },
  marketcheck_valuation: null,
  status: 'pending',
  pdf_download_token: null,
}

const getPrintPage = () => import('@/app/reports/[id]/print/page').then(m => m.default)

describe('Print page — gating (PRD §9.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
    ;(canViewReport as jest.Mock).mockImplementation(() => true)
  })

  it('redirects to /view when the report is not completed', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: validReport, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
    })

    const PrintPage = await getPrintPage()
    await expect(
      PrintPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/reports/report-1/view')
  })

  it('shows the ExpiredScreen (not a redirect to /auth) for an expired token', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { access_token: 'real-token', access_token_expires_at: '2020-01-01T00:00:00Z' },
        error: null,
      }),
    })

    const PrintPage = await getPrintPage()
    const result = await PrintPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'real-token' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
  })

  it('renders normally when the report is completed with a pdf_download_token', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { ...validReport, status: 'completed', pdf_download_token: 'tok-1' },
        error: null,
      }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
    })

    const PrintPage = await getPrintPage()
    const result = await PrintPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })

    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
```

```tsx
// __tests__/app/reports/action-plan/page.test.tsx
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({ supabaseAdmin: { from: supabaseFromMock } }))
jest.mock('@/lib/utils/report-access', () => ({ canViewReport: jest.fn(() => true) }))
jest.mock('@/app/reports/[id]/action-plan/PrintChecklistButton', () => ({
  PrintChecklistButton: () => null,
}))
jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'
import { redirect } from 'next/navigation'
import { canViewReport } from '@/lib/utils/report-access'

const validReport = {
  id: 'report-1',
  user_id: 'user-1',
  autodev_vin_data: { make: 'Honda', model: 'Civic', vehicle: { year: 2020 } },
  status: 'pending',
  pdf_download_token: null,
}

const getActionPlanPage = () => import('@/app/reports/[id]/action-plan/page').then(m => m.default)

describe('Action-plan page — gating (PRD §9.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
    ;(canViewReport as jest.Mock).mockImplementation(() => true)
  })

  it('redirects to /view when the report is not completed', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: validReport, error: null }),
    })

    const ActionPlanPage = await getActionPlanPage()
    await expect(
      ActionPlanPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/reports/report-1/view')
  })

  it('shows the ExpiredScreen for an expired token', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { access_token: 'real-token', access_token_expires_at: '2020-01-01T00:00:00Z' },
        error: null,
      }),
    })

    const ActionPlanPage = await getActionPlanPage()
    const result = await ActionPlanPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'real-token' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
  })

  it('renders normally when the report is completed', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { ...validReport, status: 'completed', pdf_download_token: 'tok-1' },
        error: null,
      }),
    })

    const ActionPlanPage = await getActionPlanPage()
    const result = await ActionPlanPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })

    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/app/reports/print/page-gating.test.tsx __tests__/app/reports/action-plan/page.test.tsx`
Expected: FAIL — neither page currently checks `status`, and both still `redirect` to `/auth` on an expired token instead of rendering `ExpiredScreen`.

- [ ] **Step 3: Edit `app/reports/[id]/print/page.tsx`**

Add imports:

```ts
import { computeReportDisplayState } from '@/lib/report-display-state'
import { ExpiredScreen } from '../view/screens/ExpiredScreen'
```

Replace:

```ts
if (!tokenValid) {
  redirect(`/auth?redirect=/reports/${id}/print&reason=token_expired`)
}
```

with:

```ts
    if (!tokenValid) {
      return <ExpiredScreen />
    }
```

Immediately after the existing report fetch + access-denied check (before the payment-gate `if (!isTokenAccess && ...)` block, so it applies to every visitor), add:

```ts
const isAdmin = user?.user_metadata?.is_admin === true
if (
  !isAdmin &&
  computeReportDisplayState({
    status: report.status,
    pdfDownloadToken: (report as { pdf_download_token?: string | null }).pdf_download_token ?? null,
  }) !== 'ready'
) {
  redirect(token ? `/reports/${id}/view?token=${token}` : `/reports/${id}/view`)
}
```

(`report.status` and `report.pdf_download_token` are already available on the `select('*')` fetch already present in this file — no query change needed. Note this file did not previously compute `isAdmin`; check `canViewReport(user?.id ?? '', isAdmin, report.user_id)` a few lines above already needs it too — reuse the same `isAdmin` binding rather than declaring it twice.)

- [ ] **Step 4: Edit `app/reports/[id]/action-plan/page.tsx`**

Same two edits, adjusted for this file's structure: add the same two imports; replace the `redirect(...&reason=token_expired)` call with `return <ExpiredScreen />`; add the same `computeReportDisplayState` redirect-to-`/view` check right after the existing access-denied check (this file already computes `isAdmin` on the line `const isAdmin = user?.user_metadata?.is_admin === true` — reuse it, don't redeclare).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/app/reports/print/page-gating.test.tsx __tests__/app/reports/action-plan/page.test.tsx`
Expected: PASS (6 tests total).

- [ ] **Step 6: Run the existing print page suite for regressions**

Run: `npx jest __tests__/app/reports/print`
Expected: PASS — `print/page.test.tsx`'s 3 existing tests still pass (its `validReport` fixture has no `status`/`pdf_download_token`, i.e. both `undefined` — confirm `computeReportDisplayState` treats `undefined` status as not `'ready'` and therefore redirects; if that breaks the existing "renders page when user owns the report" test, fix the **test fixture** in `print/page.test.tsx` to add `status: 'completed', pdf_download_token: 'tok-1'`, matching the reality that a real report reaching that assertion must be completed — this is a legitimate fixture update, not a loosened assertion).

- [ ] **Step 7: Run type-check**

Run: `npm run type-check`

- [ ] **Step 8: Commit**

```bash
git add app/reports/[id]/print/page.tsx app/reports/[id]/action-plan/page.tsx __tests__/app/reports/print/page-gating.test.tsx __tests__/app/reports/action-plan/page.test.tsx __tests__/app/reports/print/page.test.tsx
git commit -m "$(cat <<'EOF'
Gate /print and /action-plan behind computeReportDisplayState (PRD §9.5)

Unreleased reports redirect to /view (where the progress/held screens
live); an expired access token shows ExpiredScreen directly instead of
bouncing to /auth with no explanation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `PrintPdfButtons` serves the stored PDF; download route accepts `source` (§9.6)

**Files:**

- Modify: `app/reports/[id]/view/print-pdf-buttons.tsx` + `__tests__/app/reports/view/print-pdf-buttons.test.tsx` (rewrite — behavior is intentionally changing)
- Modify: `app/api/reports/download/[token]/route.ts`, `lib/analytics/events.ts`
- Modify: `app/reports/[id]/view/page.tsx` (pass the new prop)

**Interfaces:**

- Produces: `PrintPdfButtons({ reportId, token, pdfDownloadToken }: { reportId: string; token?: string; pdfDownloadToken: string | null })` — the button group renders nothing when `pdfDownloadToken` is null.
- Produces: `ReportDownloadSource = 'print' | 'email_link' | 'page'` in `lib/analytics/events.ts`.

- [ ] **Step 1: Write the failing tests**

Replace `__tests__/app/reports/view/print-pdf-buttons.test.tsx`:

```tsx
const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

jest.mock('@/lib/analytics/events', () => ({
  trackReportDownload: jest.fn(),
  trackReportWorkflow: jest.fn(),
  trackButtonClick: jest.fn(),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { PrintPdfButtons } from '@/app/reports/[id]/view/print-pdf-buttons'
import { trackReportWorkflow } from '@/lib/analytics/events'

describe('PrintPdfButtons', () => {
  beforeEach(() => {
    pushMock.mockClear()
    ;(trackReportWorkflow as jest.Mock).mockClear()
  })

  it('renders nothing when pdfDownloadToken is null (unreleased report — PRD §9.5)', () => {
    const { container } = render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a Download PDF link to the download route when pdfDownloadToken is set', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    const link = screen.getByRole('link', { name: /download pdf/i })
    expect(link).toHaveAttribute('href', '/api/reports/download/tok-1?source=page')
  })

  it('no longer tracks print_flow_started — the button downloads directly now', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    fireEvent.click(screen.getByRole('link', { name: /download pdf/i }))
    expect(trackReportWorkflow).not.toHaveBeenCalledWith(
      expect.objectContaining({ step: 'print_flow_started' })
    )
  })

  it('renders Share button', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/app/reports/view/print-pdf-buttons.test.tsx`
Expected: FAIL — the current component always renders a "Save as PDF" button that navigates to `/print`, and has no `pdfDownloadToken` prop.

- [ ] **Step 3: Rewrite `print-pdf-buttons.tsx`**

```tsx
'use client'

import { Download, Share2 } from 'lucide-react'
import { trackButtonClick } from '@/lib/analytics/events'

interface PrintPdfButtonsProps {
  reportId: string
  token?: string
  pdfDownloadToken: string | null
}

/**
 * Hidden until the report is released — "Download PDF" links straight to
 * the stored, QA-checked PDF (the same file the ready email links to),
 * never a fresh /print re-render (docs/Inbox/report-delivery-prd.md §9.6).
 */
export function PrintPdfButtons({ reportId, pdfDownloadToken }: PrintPdfButtonsProps) {
  const handleShare = async () => {
    const url = window.location.href
    trackButtonClick('share_report', { reportId })

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TotalLossToolKit Report',
          text: 'Check out this report from TotalLossToolKit',
          url,
        })
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          await copyToClipboard(url)
        }
      }
    } else {
      await copyToClipboard(url)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Link copied to clipboard!')
    } catch {
      console.error('Failed to copy link')
    }
  }

  if (!pdfDownloadToken) return null

  return (
    <div className="flex items-center space-x-4">
      <a
        href={`/api/reports/download/${pdfDownloadToken}?source=page`}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors print:hidden"
        title="Download PDF"
      >
        <Download className="h-4 w-4 mr-2" />
        Download PDF
      </a>

      <button
        onClick={handleShare}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors print:hidden"
        title="Share this report"
      >
        <Share2 className="h-4 w-4 mr-2" />
        Share
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Update the download route to read `source`**

In `app/api/reports/download/[token]/route.ts`, change:

```ts
if (!isLikelyBotUserAgent(request.headers.get('user-agent'))) {
  after(() =>
    captureReportDownloaded({
      reportId: report.id as string,
      distinctId: (report.posthog_distinct_id as string | null) ?? null,
    })
  )
}
```

to:

```ts
if (!isLikelyBotUserAgent(request.headers.get('user-agent'))) {
  const source = new URL(request.url).searchParams.get('source')
  after(() =>
    captureReportDownloaded({
      reportId: report.id as string,
      distinctId: (report.posthog_distinct_id as string | null) ?? null,
      ...(source === 'page' || source === 'print' || source === 'email_link' ? { source } : {}),
    })
  )
}
```

- [ ] **Step 5: Add `'page'` to `ReportDownloadSource`**

In `lib/analytics/events.ts`, change:

```ts
export type ReportDownloadSource = 'print' | 'email_link'
```

to:

```ts
export type ReportDownloadSource = 'print' | 'email_link' | 'page'
```

- [ ] **Step 6: Pass `pdfDownloadToken` from `page.tsx`**

In `app/reports/[id]/view/page.tsx`, change the nav's usage:

```tsx
<PrintPdfButtons reportId={id} token={token ?? undefined} />
```

to:

```tsx
<PrintPdfButtons
  reportId={id}
  token={token ?? undefined}
  pdfDownloadToken={(report.pdf_download_token as string | null) ?? null}
/>
```

(This line only executes in the `ready` branch, since everything above already returned for non-ready states — `report.pdf_download_token` is guaranteed non-null there by `computeReportDisplayState`'s own `ready` condition, but the prop stays typed as nullable since `PrintPdfButtons` itself must not assume that.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest __tests__/app/reports/view/print-pdf-buttons.test.tsx "__tests__/app/api/reports/download"`
Expected: PASS.

- [ ] **Step 8: Run type-check**

Run: `npm run type-check`

- [ ] **Step 9: Commit**

```bash
git add app/reports/[id]/view/print-pdf-buttons.tsx __tests__/app/reports/view/print-pdf-buttons.test.tsx app/api/reports/download/[token]/route.ts lib/analytics/events.ts app/reports/[id]/view/page.tsx
git commit -m "$(cat <<'EOF'
Download PDF now serves the stored, QA-checked file (PRD §9.6)

PrintPdfButtons no longer navigates to /print for a browser print — it
links straight to the download route, hidden entirely until the report
is released. Adds source=page to ReportDownloadSource so this is
distinguishable from an email-link or print-page download.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Checkout redirect → `/view` for every buyer (PRD §10)

**Files:**

- Modify: `app/api/lemonsqueezy/create-checkout/route.ts` + its test

**Interfaces:**

- Consumes: nothing new.
- Produces: every `successUrl` this route builds points at `/view`, never `/success`.

- [ ] **Step 1: Find and read the existing test file for this route**

Run: `find "__tests__/app/api/lemonsqueezy/create-checkout" -type f` (already known from Task 2 of the prior plan's context: `__tests__/app/api/lemonsqueezy/create-checkout/route.test.ts` exists). Read it to find the exact assertions on `successUrl` for the authenticated-user branch before editing (they currently expect `/success`).

- [ ] **Step 2: Write/update the failing test**

Add or update a test in that file asserting the authenticated-buyer branch now targets `/view`:

```ts
it('sends an authenticated buyer to /view, not /success', async () => {
  // (reuse this file's existing request-building helpers/mocks; the only
  // change is the expected successUrl)
  // ... existing setup that authenticates a user and mocks createCheckout ...
  expect(createCheckoutMock).toHaveBeenCalledWith(
    expect.objectContaining({
      successUrl: expect.stringContaining('/reports/report-1/view?checkout=complete'),
    })
  )
})
```

Update any existing test that currently asserts a `/success` URL for the authenticated branch to expect `/view` instead — this is the intended behavior change (D13/§10), not a regression to paper over.

- [ ] **Step 3: Run tests to verify the updated assertions fail**

Run: `npx jest __tests__/app/api/lemonsqueezy/create-checkout`
Expected: FAIL on the updated/new assertions — the route still builds a `/success` URL for authenticated buyers.

- [ ] **Step 4: Edit the route**

Replace:

```ts
let successUrl = `${appUrl}/reports/${reportId}/success?checkout=complete`
if (!user) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken = (report as any).access_token as string | null
  if (accessToken) {
    successUrl = `${appUrl}/reports/${reportId}/view?token=${accessToken}&checkout=complete`
  }
}
```

with:

```ts
// Every buyer lands on /view now — /success is retired to a thin
// redirect (docs/Inbox/report-delivery-prd.md §10, D13).
let successUrl = `${appUrl}/reports/${reportId}/view?checkout=complete`
if (!user) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken = (report as any).access_token as string | null
  if (accessToken) {
    successUrl = `${appUrl}/reports/${reportId}/view?token=${accessToken}&checkout=complete`
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/app/api/lemonsqueezy/create-checkout`
Expected: PASS.

- [ ] **Step 6: Run type-check**

Run: `npm run type-check`

- [ ] **Step 7: Commit**

```bash
git add app/api/lemonsqueezy/create-checkout/route.ts __tests__/app/api/lemonsqueezy/create-checkout/route.test.ts
git commit -m "$(cat <<'EOF'
Send every checkout success redirect to /view, not /success (PRD §10, D13)

/success becomes a thin redirect in the next task, kept only so existing
bookmarked/emailed success links still work.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Retire `/reports/[id]/success`

**Files:**

- Modify (rewrite): `app/reports/[id]/success/page.tsx`
- Modify (rewrite): `__tests__/app/reports/success/page.test.tsx`
- Delete: `app/reports/[id]/success/ReportReadyPoller.tsx`, `AuthenticatedPaymentPoller.tsx`, `PostHogPurchaseTracker.tsx`, `RedditPurchaseTracker.tsx`
- Delete: `__tests__/app/reports/success/ReportReadyPoller.test.tsx`, `__tests__/app/reports/success/PostHogPurchaseTracker.test.tsx`
- Note: `app/reports/[id]/view/RedditPurchaseTracker.tsx` and `__tests__/app/reports/view/RedditPurchaseTracker.test.tsx` — the component was already created in Task 5 (needed there); this task only needs its test, since the component itself already exists and is already wired into `/view`.

**Interfaces:**

- Consumes: nothing new.

- [ ] **Step 1: Write the failing test for `RedditPurchaseTracker` at its new home**

```tsx
// __tests__/app/reports/view/RedditPurchaseTracker.test.tsx
jest.mock('@/lib/analytics/reddit-events', () => ({ trackRedditPurchase: jest.fn() }))

import { render } from '@testing-library/react'
import { RedditPurchaseTracker } from '@/app/reports/[id]/view/RedditPurchaseTracker'
import { trackRedditPurchase } from '@/lib/analytics/reddit-events'

describe('RedditPurchaseTracker (moved to /view)', () => {
  it('fires trackRedditPurchase once on mount with the given props', () => {
    render(<RedditPurchaseTracker value={29} currency="USD" transactionId="txn-1" />)
    expect(trackRedditPurchase).toHaveBeenCalledWith({
      value: 29,
      currency: 'USD',
      transactionId: 'txn-1',
      itemCount: 1,
    })
    expect(trackRedditPurchase).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/app/reports/view/RedditPurchaseTracker.test.tsx`
Expected: This should actually **pass immediately** — the component was already created in Task 5. Confirm this rather than expecting a failure: run it and verify PASS. (This is the one step in this plan where "watch it fail first" does not apply, because the production code already exists from Task 5's own needs; note this explicitly rather than fabricating a red step — see docs/superpowers/plans/2026-09-26-report-delivery-pipeline-qa-gate.md's Task 3 ruling for the same kind of honest deviation.)

- [ ] **Step 3: Rewrite `app/reports/[id]/success/page.tsx` as a thin redirect**

```tsx
/**
 * /reports/[id]/success is retired (docs/Inbox/report-delivery-prd.md §10,
 * D13) — every buyer now lands on /view. This route is kept only so an
 * old bookmarked or emailed success link still works, by forwarding every
 * query parameter (the token, checkout=complete) straight through.
 */
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SuccessRedirectPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') query.set(key, value)
  }
  const qs = query.toString()

  redirect(`/reports/${id}/view${qs ? `?${qs}` : ''}`)
}
```

- [ ] **Step 4: Rewrite `__tests__/app/reports/success/page.test.tsx`**

```tsx
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))

import { redirect } from 'next/navigation'

const getSuccessPage = () => import('@/app/reports/[id]/success/page').then(m => m.default)

describe('/reports/[id]/success — retired, redirects to /view', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to /view preserving the token and checkout query params', async () => {
    const SuccessPage = await getSuccessPage()
    await expect(
      SuccessPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({ token: 'tok-1', checkout: 'complete' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    const url = (redirect as jest.Mock).mock.calls[0][0] as string
    expect(url.startsWith('/reports/report-1/view?')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('token')).toBe('tok-1')
    expect(params.get('checkout')).toBe('complete')
  })

  it('redirects to /view with no query string when there are no params', async () => {
    const SuccessPage = await getSuccessPage()
    await expect(
      SuccessPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/reports/report-1/view')
  })
})
```

- [ ] **Step 5: Delete the superseded files**

```bash
git rm app/reports/[id]/success/ReportReadyPoller.tsx
git rm app/reports/[id]/success/AuthenticatedPaymentPoller.tsx
git rm app/reports/[id]/success/PostHogPurchaseTracker.tsx
git rm app/reports/[id]/success/RedditPurchaseTracker.tsx
git rm __tests__/app/reports/success/ReportReadyPoller.test.tsx
git rm __tests__/app/reports/success/PostHogPurchaseTracker.test.tsx
```

(`AuthenticatedPaymentPoller` and `PaymentConfirmationWatcher` on `/view` are not the same component — `/view`'s `PaymentConfirmationWatcher.tsx` already exists, is untouched, and is not part of this deletion.)

- [ ] **Step 6: Run tests to verify everything passes**

Run: `npx jest __tests__/app/reports/success __tests__/app/reports/view`
Expected: PASS — no test file still imports any of the deleted components (confirm with a repo-wide grep before running: `grep -rl "ReportReadyPoller\|AuthenticatedPaymentPoller\|success/PostHogPurchaseTracker\|success/RedditPurchaseTracker" app __tests__` should return nothing after the deletions and Task 5/8's edits).

- [ ] **Step 7: Run full suite and type-check**

Run: `npm run test:ci`
Run: `npm run type-check`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add app/reports/[id]/success/page.tsx __tests__/app/reports/success/page.test.tsx __tests__/app/reports/view/RedditPurchaseTracker.test.tsx
git rm app/reports/[id]/success/ReportReadyPoller.tsx app/reports/[id]/success/AuthenticatedPaymentPoller.tsx app/reports/[id]/success/PostHogPurchaseTracker.tsx app/reports/[id]/success/RedditPurchaseTracker.tsx __tests__/app/reports/success/ReportReadyPoller.test.tsx __tests__/app/reports/success/PostHogPurchaseTracker.test.tsx
git commit -m "$(cat <<'EOF'
Retire /reports/[id]/success to a thin redirect to /view (PRD §10, D13)

Old bookmarked/emailed success links keep working — every query param
forwards through. Deletes the four components /success used
(ReportReadyPoller, AuthenticatedPaymentPoller, PostHogPurchaseTracker,
RedditPurchaseTracker) now that /view's PurchaseCompleteTracker (widened
in an earlier task) and the moved RedditPurchaseTracker cover every
buyer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** PRD build steps 4 (Tasks 1, 2, 6 partially), 5 (Tasks 3, 4, 7), and 6 (Tasks 5, 8, 9) are each covered. Steps 7-12 are explicitly out of scope per Global Constraints.
- **Placeholder scan:** no TBD/TODO markers. Task 9 Step 2 is the one deliberate, explicitly-flagged exception to "watch it fail first" (the component already exists from Task 5), and it's called out rather than silently skipped.
- **Type consistency:** `ReportDisplayState`, `ReportDisplayInputs`, `HELD_STATUSES`/`isHeldStatus`, and the status endpoint's `{state, step, paidAt}` shape are each defined once (Tasks 1-2) and reused with the same names/shapes in Tasks 3, 5, 6.
- **Review Focus:** all five items are pinned to a specific task's tests — held-content-never-renders → Task 5's "even with valuation data saved" test; the 120s client timer → Task 3's fake-timer test; completed-without-token → Task 1's and Task 5's dedicated tests; expired-token screen → Tasks 5/6; purchase-tracking coverage → Task 5's widened condition plus Task 8/9's redirect changes.

## After Task 9

All three build steps (4, 5, 6) are complete. Before opening a PR:

- Run `npm run test:ci` and `npm run type-check` one final time on the whole branch (which now includes both this plan's commits and the prior pipeline/QA-gate plan's).
- A fresh whole-branch review (same process as the prior plan: `superpowers:requesting-code-review`, most capable model) should cover the combined diff since `origin/main`, not just this plan's commits — the two plans together are what would actually ship in one PR.
- Steps 7-12 (Zoho enrollment, refunds/admin, the daily sweep, PostHog tracking events, the copy sweep) remain as a separate, later plan.
