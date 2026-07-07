# Premium-Only Money-Back Guarantee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only show the 100% Money-Back Guarantee card to buyers who paid the Premium price point ($49 / `price_paid === 4900`), not Basic ($29 / `price_paid === 2900`).

**Architecture:** Two independent conditional-render changes, one per surface where the guarantee currently renders unconditionally: the payment success page (React/Next.js server component) and the PDF report template (`@react-pdf/renderer` component). Both surfaces already receive a Basic/Premium signal — no new data plumbing needed.

**Tech Stack:** Next.js 15 App Router (server components), Jest + `@testing-library/react`, `@react-pdf/renderer` (mocked in tests via `__tests__/__mocks__/@react-pdf/renderer.ts`).

## Global Constraints

- Basic tier = `price_paid === 2900` ($29). Premium tier = anything else currently sold (`4900` / $49). This exact ternary (`price_paid === 2900 ? 'basic' : 'premium'`) is the established pattern in this codebase (`app/reports/[id]/success/page.tsx:67`, `app/admin/reports/[id]/page.tsx:113`) — do not invent a new comparison.
- Do not touch `app/reports/[id]/success/ReportReadyPoller.tsx` (anonymous-buyer path) — it has no guarantee card today.
- Do not touch `app/reports/[id]/payment-buttons.tsx` — its guarantee mention is pre-purchase marketing copy, not part of "the report."
- Design spec: `docs/superpowers/specs/2026-07-07-premium-only-guarantee-design.md`

---

### Task 1: Gate the guarantee card on the payment success page

**Files:**

- Modify: `app/reports/[id]/success/page.tsx:258-268`
- Test: `__tests__/app/reports/success/page.test.tsx` (create)

**Interfaces:**

- Consumes: `planType` variable already computed at `app/reports/[id]/success/page.tsx:67` (`const planType = report.price_paid === 2900 ? 'basic' : 'premium'`)
- Produces: nothing consumed by other tasks (this task and Task 2 are independent)

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/reports/success/page.test.tsx`:

```tsx
/**
 * @jest-environment node
 */

jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))

jest.mock('@/lib/db/auth', () => ({
  getUser: jest.fn(),
}))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({ from: supabaseFromMock }),
  supabaseAdmin: { from: jest.fn() },
}))

jest.mock('@/app/reports/[id]/success/RedditPurchaseTracker', () => ({
  RedditPurchaseTracker: () => null,
}))
jest.mock('@/app/reports/[id]/success/PostHogPurchaseTracker', () => ({
  PostHogPurchaseTracker: () => null,
}))
jest.mock('@/app/reports/[id]/success/ReportReadyPoller', () => ({
  ReportReadyPoller: () => null,
}))
jest.mock('@/app/reports/[id]/success/AuthenticatedPaymentPoller', () => ({
  AuthenticatedPaymentPoller: () => null,
}))

jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'

const mockChain = (data: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null }),
})

const baseReport = {
  id: 'report-1',
  vin: '1HGBH41JXMN109186',
  status: 'complete',
}

const getSuccessPage = () => import('@/app/reports/[id]/success/page').then(m => m.default)

describe('Payment success page — money-back guarantee', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'buyer@example.com' })
  })

  it('does NOT render the guarantee card for a Basic report', async () => {
    supabaseFromMock.mockReturnValue(mockChain({ ...baseReport, price_paid: 2900 }))

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByText(/100% Money-Back Guarantee/i)).not.toBeInTheDocument()
  })

  it('renders the guarantee card for a Premium report', async () => {
    supabaseFromMock.mockReturnValue(mockChain({ ...baseReport, price_paid: 4900 }))

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/100% Money-Back Guarantee/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/app/reports/success/page.test.tsx`
Expected: The "does NOT render" test FAILS (card currently always renders); the "renders for Premium" test passes already. Confirm the first assertion is the one failing before proceeding.

- [ ] **Step 3: Gate the guarantee card**

In `app/reports/[id]/success/page.tsx`, change lines 258-268 from:

```tsx
{
  /* Money-Back Guarantee */
}
;<div className="bg-green-50 rounded-lg p-6 mb-6">
  <h2 className="text-lg font-semibold text-green-900 mb-2">100% Money-Back Guarantee</h2>
  <p className="text-green-800 text-sm">
    If the insurance settlement falls short of our valuation, you can request a full refund within
    90 days of receiving your report. We&apos;re confident in our valuations.
  </p>
</div>
```

to:

```tsx
{
  /* Money-Back Guarantee — Premium tier only */
}
{
  planType === 'premium' && (
    <div className="bg-green-50 rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold text-green-900 mb-2">100% Money-Back Guarantee</h2>
      <p className="text-green-800 text-sm">
        If the insurance settlement falls short of our valuation, you can request a full refund
        within 90 days of receiving your report. We&apos;re confident in our valuations.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/app/reports/success/page.test.tsx`
Expected: Both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/reports/[id]/success/page.tsx __tests__/app/reports/success/page.test.tsx
git commit -m "fix: only show money-back guarantee on Premium report success page"
```

---

### Task 2: Gate the guarantee box in the PDF report template

**Files:**

- Modify: `lib/pdf/report-template.tsx:1287-1295`
- Test: `__tests__/lib/pdf/report-template.test.tsx` (create)

**Interfaces:**

- Consumes: existing `data.reportType: 'BASIC' | 'PREMIUM'` prop on `VehicleReportPDF` (`lib/pdf/report-template.tsx:860`)
- Produces: nothing consumed by other tasks (independent of Task 1)

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/pdf/report-template.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { VehicleReportPDF } from '@/lib/pdf/report-template'

const baseData = {
  id: 'report-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  createdAt: '2026-07-01T12:00:00Z',
}

describe('VehicleReportPDF — money-back guarantee box', () => {
  it('does NOT render the guarantee box for a BASIC report', () => {
    render(<VehicleReportPDF data={{ ...baseData, reportType: 'BASIC' }} />)
    expect(screen.queryByText(/100% Money-Back Guarantee/i)).not.toBeInTheDocument()
  })

  it('renders the guarantee box for a PREMIUM report', () => {
    render(<VehicleReportPDF data={{ ...baseData, reportType: 'PREMIUM' }} />)
    expect(screen.getByText(/100% Money-Back Guarantee/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/pdf/report-template.test.tsx`
Expected: The "does NOT render" test FAILS (box currently always renders); the "renders for PREMIUM" test passes already.

- [ ] **Step 3: Gate the guarantee box**

In `lib/pdf/report-template.tsx`, change lines 1287-1295 from:

```tsx
{
  /* ── MONEY-BACK GUARANTEE ─────────────────────────── */
}
;<View style={styles.guaranteeBox}>
  <Text style={styles.guaranteeTitle}>100% Money-Back Guarantee</Text>
  <Text style={styles.guaranteeText}>
    If the insurance settlement falls short of our valuation, request a full refund within 90 days.
    We&apos;re confident in our valuations and stand behind every report we generate.
  </Text>
</View>
```

to:

```tsx
{
  /* ── MONEY-BACK GUARANTEE — Premium tier only ──────── */
}
{
  data.reportType === 'PREMIUM' && (
    <View style={styles.guaranteeBox}>
      <Text style={styles.guaranteeTitle}>100% Money-Back Guarantee</Text>
      <Text style={styles.guaranteeText}>
        If the insurance settlement falls short of our valuation, request a full refund within 90
        days. We&apos;re confident in our valuations and stand behind every report we generate.
      </Text>
    </View>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/pdf/report-template.test.tsx`
Expected: Both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/report-template.tsx __tests__/lib/pdf/report-template.test.tsx
git commit -m "fix: only include money-back guarantee box in Premium PDF reports"
```

---

### Task 3: Full regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: All tests pass, including the two new suites from Tasks 1 and 2.

- [ ] **Step 2: Manual smoke check**

Start the dev server (`npm run dev`), then:

1. Find or create one Basic-tier report and one Premium-tier report in the dev database.
2. Visit `/reports/<basic-id>/success` — confirm no green guarantee card.
3. Visit `/reports/<premium-id>/success` — confirm the green guarantee card is present.
4. Generate/download the PDF for each (via the existing PDF generation flow) and confirm the same split in the PDF.

- [ ] **Step 3: Push branch and open PR**

Follow the standard workflow in the workspace `CLAUDE.md` (push branch, open PR, verify Vercel Preview before merging — do not merge to `main` without explicit confirmation).
