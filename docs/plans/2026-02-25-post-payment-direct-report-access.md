# Post-Payment Direct Report Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After a successful LemonSqueezy payment, take the user directly to their populated vehicle valuation report — no auth wall, no "check your email" dead end.

**Architecture:** Make `/reports/[id]/view` publicly accessible by UUID when the report is paid (UUID entropy = access credential). The success page polls a lightweight status endpoint until the async webhook completes, then auto-redirects to the view page. Fix the broken magic link URL in the webhook as a bonus improvement.

**Tech Stack:** Next.js 16 App Router, Supabase (`supabaseAdmin` for RLS bypass), Jest + `@testing-library/react`, TypeScript

---

## Task 1: Fix Webhook `appUrl` and Magic Link Destination

**Files:**

- Modify: `app/api/lemonsqueezy/webhook/route.ts`
- Test: `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`

The webhook's `resolveUserFromEmail` function hardcodes `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`, causing magic link emails to point to localhost on Vercel. Also, the magic link redirects to `/reports/${reportId}` (the unpaid landing page) instead of `/reports/${reportId}/view`.

### Step 1: Write the failing test

Create `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`:

```typescript
/**
 * Webhook appUrl resolution tests
 */
import { POST } from '@/app/api/lemonsqueezy/webhook/route'
import { supabaseAdmin } from '@/lib/db/supabase'
import * as client from '@/lib/lemonsqueezy/client'
import * as marketcheck from '@/lib/api/marketcheck-client'
import * as autodev from '@/lib/api/autodev-client'
import * as pdfGenerator from '@/lib/services/pdf-generator'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        listUsers: jest.fn(),
      },
      signInWithOtp: jest.fn(),
    },
  },
}))
jest.mock('@/lib/lemonsqueezy/client')
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/services/pdf-generator')

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeOrderCreatedBody(overrides = {}) {
  return JSON.stringify({
    meta: {
      event_name: 'order_created',
      custom_data: { reportId: 'report-abc', reportType: 'BASIC' },
      webhook_id: 'wh-1',
      test_mode: true,
    },
    data: {
      type: 'orders',
      id: 'order-123',
      attributes: {
        status: 'paid',
        total: 2900,
        user_email: 'buyer@example.com',
        user_name: 'Test Buyer',
        order_number: 1,
        ...overrides,
      },
    },
  })
}

describe('POST /api/lemonsqueezy/webhook — appUrl resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)

    // Mock report fetch
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zip_code: '90210',
          vehicle_data: null,
          marketcheck_valuation: null,
        },
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockAdmin.from = mockFrom as any

    // Mock MarketCheck and AutoDev
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: { predictedPrice: 25000, confidence: 'high', totalComparablesFound: 10 },
    })
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 } },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue(undefined)

    // Mock user creation (new user)
    ;(mockAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })
  })

  it('uses x-forwarded-host when NEXT_PUBLIC_APP_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null })
    mockAdmin.auth.signInWithOtp = signInWithOtpMock as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://internal-vercel-url/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })

    await POST(request)

    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://www.totallosstoolkit.com/reports/report-abc/view',
        }),
      })
    )
  })

  it('uses NEXT_PUBLIC_APP_URL when set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://totallosstoolkit.com'

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null })
    mockAdmin.auth.signInWithOtp = signInWithOtpMock as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://internal/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: { 'x-signature': 'valid' },
      body,
    })

    await POST(request)

    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://totallosstoolkit.com/reports/report-abc/view',
        }),
      })
    )

    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('magic link redirects to /reports/{id}/view not /reports/{id}', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null })
    mockAdmin.auth.signInWithOtp = signInWithOtpMock as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://internal/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })

    await POST(request)

    const callArgs = signInWithOtpMock.mock.calls[0][0]
    expect(callArgs.options.emailRedirectTo).toContain('/view')
    expect(callArgs.options.emailRedirectTo).not.toMatch(/\/reports\/[^/]+$/)
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd "C:\Users\Gordo\Documents\Vehicle Comparison Site"
npx jest __tests__/app/api/lemonsqueezy/webhook/route.test.ts --no-coverage
```

Expected: Tests fail because (a) the test file doesn't exist yet and (b) the webhook still uses hardcoded localhost.

### Step 3: Implement the fix in the webhook

In `app/api/lemonsqueezy/webhook/route.ts`:

**3a.** In the `POST` handler, derive `appUrl` using `x-forwarded-host` and pass it to `handleOrderCreated`:

```typescript
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature')
    // ... existing signature check ...

    // Resolve the public app URL (needed for magic link emails)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin)

    const event: LemonSqueezyWebhookEvent = JSON.parse(rawBody)
    const eventName = event.meta.event_name

    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(event, appUrl) // <-- pass appUrl
        break
      // ...
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    /* ... */
  }
}
```

**3b.** Update `handleOrderCreated` to accept and pass `appUrl`:

```typescript
async function handleOrderCreated(event: LemonSqueezyWebhookEvent, appUrl: string) {
  // ... existing code ...
  if (!resolvedUserId && customerEmail) {
    resolvedUserId = await resolveUserFromEmail(customerEmail, reportId, appUrl)
  }
  // ...
}
```

**3c.** Update `resolveUserFromEmail` signature and fix the magic link URL:

```typescript
async function resolveUserFromEmail(
  email: string,
  reportId: string,
  appUrl: string
): Promise<string | null> {
  // Remove: const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // appUrl is now passed in from above

  // ... existing user create/find logic unchanged ...

  const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/reports/${reportId}/view`, // <-- /view added
      shouldCreateUser: false,
    },
  })
  // ...
}
```

### Step 4: Run tests to verify they pass

```bash
npx jest __tests__/app/api/lemonsqueezy/webhook/route.test.ts --no-coverage
```

Expected: All 3 tests PASS.

### Step 5: Type-check

```bash
npx tsc --noEmit
```

Expected: No errors.

### Step 6: Commit

```bash
git add app/api/lemonsqueezy/webhook/route.ts __tests__/app/api/lemonsqueezy/webhook/route.test.ts
git commit -m "fix: resolve appUrl via x-forwarded-host in webhook; fix magic link to /view"
```

---

## Task 2: Add Report Status API Endpoint

**Files:**

- Create: `app/api/reports/[id]/status/route.ts`
- Test: `__tests__/app/api/reports/[id]/status/route.test.ts`

A lightweight GET endpoint the success page polls. Returns `{ ready: boolean }`. No auth required — only exposes a boolean, not report data.

### Step 1: Write the failing test

Create `__tests__/app/api/reports/[id]/status/route.test.ts`:

```typescript
/**
 * Report Status API Tests
 * GET /api/reports/[id]/status
 * No auth required — returns readiness boolean only
 */
import { GET } from '@/app/api/reports/[id]/status/route'
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeRequest(reportId: string) {
  return new Request(`http://localhost:3000/api/reports/${reportId}/status`, {
    method: 'GET',
  })
}

function makeContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}

describe('GET /api/reports/[id]/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns ready: false when report has no price_paid', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { price_paid: null, marketcheck_valuation: null },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ready).toBe(false)
  })

  it('returns ready: false when price_paid set but marketcheck_valuation is null', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { price_paid: 2900, marketcheck_valuation: null },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.ready).toBe(false)
  })

  it('returns ready: true when both price_paid and marketcheck_valuation are set', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          price_paid: 2900,
          marketcheck_valuation: { predictedPrice: 25000 },
        },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.ready).toBe(true)
    expect(data.pricePaid).toBe(2900)
  })

  it('returns 404 when report not found', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    }) as any

    const response = await GET(makeRequest('nonexistent'), makeContext('nonexistent'))

    expect(response.status).toBe(404)
  })
})
```

### Step 2: Run test to verify it fails

```bash
npx jest "__tests__/app/api/reports/\[id\]/status/route.test.ts" --no-coverage
```

Expected: FAIL — `GET` not found (file doesn't exist yet).

### Step 3: Create the status endpoint

Create `app/api/reports/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('price_paid, marketcheck_valuation')
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const ready =
    report.price_paid != null && report.price_paid > 0 && report.marketcheck_valuation != null

  return NextResponse.json({
    ready,
    ...(ready ? { pricePaid: report.price_paid } : {}),
  })
}
```

### Step 4: Run tests to verify they pass

```bash
npx jest "__tests__/app/api/reports/\[id\]/status/route.test.ts" --no-coverage
```

Expected: All 4 tests PASS.

### Step 5: Type-check

```bash
npx tsc --noEmit
```

Expected: No errors.

### Step 6: Commit

```bash
git add "app/api/reports/[id]/status/route.ts" "__tests__/app/api/reports/[id]/status/route.test.ts"
git commit -m "feat: add GET /api/reports/[id]/status endpoint for polling"
```

---

## Task 3: Open the Middleware for `/reports/[id]/view`

**Files:**

- Modify: `proxy.ts`
- Test: `__tests__/proxy.test.ts` (create new)

The middleware currently blocks all `/reports/*` paths for unauthenticated users. We need to exempt `/reports/[id]/view` so the view page can handle its own access control.

### Step 1: Write the failing test

Create `__tests__/proxy.test.ts`:

```typescript
/**
 * Middleware (proxy.ts) tests
 * Verifies auth-bypass rules for report pages
 */
import { proxy } from '@/proxy'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@supabase/ssr')

const mockGetUser = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(createServerClient as jest.Mock).mockReturnValue({
    auth: { getUser: mockGetUser },
  })
})

function makeRequest(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

describe('proxy middleware — unauthenticated user', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
  })

  it('redirects unauthenticated user from /reports/[id]', async () => {
    const response = await proxy(makeRequest('/reports/abc123'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated user to access /reports/[id]/success', async () => {
    const response = await proxy(makeRequest('/reports/abc123/success'))
    expect(response.status).not.toBe(307)
  })

  it('allows unauthenticated user to access /reports/[id]/view', async () => {
    const response = await proxy(makeRequest('/reports/abc123/view'))
    expect(response.status).not.toBe(307)
  })

  it('still redirects unauthenticated user from /dashboard', async () => {
    const response = await proxy(makeRequest('/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
```

### Step 2: Run test to verify it fails

```bash
npx jest __tests__/proxy.test.ts --no-coverage
```

Expected: The `/reports/[id]/view` test FAILS — middleware currently redirects it.

### Step 3: Add the view page exception to `proxy.ts`

In `proxy.ts`, find the `isReportSuccessPage` line and add `isReportViewPage` immediately after:

```typescript
  // Allow the post-payment success page — anonymous buyers land here after purchase
  const isReportSuccessPage = /^\/reports\/[^/]+\/success(\/)?$/.test(request.nextUrl.pathname)
  // Allow the report view page — UUID is the access credential; page handles paid gate
  const isReportViewPage = /^\/reports\/[^/]+\/view(\/)?$/.test(request.nextUrl.pathname)

  // Redirect to login if accessing protected route without authentication
  if (isProtectedRoute && !user && !isAuthCallbackPage && !isReportSuccessPage && !isReportViewPage) {
```

### Step 4: Run tests to verify they pass

```bash
npx jest __tests__/proxy.test.ts --no-coverage
```

Expected: All tests PASS.

### Step 5: Type-check

```bash
npx tsc --noEmit
```

### Step 6: Commit

```bash
git add proxy.ts __tests__/proxy.test.ts
git commit -m "feat: allow anonymous access to /reports/[id]/view in middleware"
```

---

## Task 4: Make the Report View Page Auth-Optional

**Files:**

- Modify: `app/reports/[id]/view/page.tsx`

Remove the hard `redirect('/login')` and use `supabaseAdmin` to fetch the report by ID alone. Gate on `price_paid > 0`. Show an "account save" banner for anonymous visitors.

> Note: This is a server component — we test it by verifying the render output via a real dev server or Playwright, not Jest. The key logic changes are auditable by reading the code. Type-check is the automated gate here.

### Step 1: Edit `app/reports/[id]/view/page.tsx`

Make the following changes:

**1a.** Remove the `redirect` import dependency and add `supabaseAdmin`:

At the top, the existing imports include:

```typescript
import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
```

Change to:

```typescript
import { getUser } from '@/lib/db/auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
```

**1b.** Replace the auth block at the top of the component:

Remove:

```typescript
const user = await getUser()
if (!user) {
  redirect('/login')
}

const { id } = await params

const supabase = await createServerSupabaseClient()

// Fetch report data
const { data: report, error } = await supabase
  .from('reports')
  .select('*')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()
```

Replace with:

```typescript
// Auth is optional — UUID is the access credential for paid reports
const user = await getUser()

const { id } = await params

// Use admin client: no user_id filter — anyone with the UUID can view if paid
const { data: report, error } = await supabaseAdmin
  .from('reports')
  .select('*')
  .eq('id', id)
  .single()
```

**1c.** Update the "not found" check and add the paid gate. Find the existing:

```typescript
  if (error || !report) {
    return (
      <div ...>Report Not Found</div>
    )
  }
```

After that block, add the paid gate:

```typescript
// Paid gate: only show report if payment has been processed
if (!report.price_paid || report.price_paid === 0) {
  redirect(`/reports/${id}`)
}
```

**1d.** Add an anonymous visitor banner. Inside the returned JSX, immediately after the opening `<div className="min-h-screen bg-white">`, add:

```tsx
{
  /* Anonymous visitor banner */
}
{
  !user && (
    <div className="bg-emerald-700 text-white text-center py-3 px-4 text-sm">
      <span>Save this report to your account — </span>
      <a
        href={`/login?redirect=/reports/${id}/view`}
        className="underline font-semibold hover:text-emerald-200"
      >
        Sign in or create a free account
      </a>
    </div>
  )
}
```

### Step 2: Type-check

```bash
npx tsc --noEmit
```

Expected: No errors.

### Step 3: Verify nav links still work for anonymous users

In the view page, the nav has `← Back to Dashboard` which links to `/dashboard`. For anonymous users this is odd. Update the back link:

Find:

```tsx
<Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
  ← Back to Dashboard
</Link>
```

Replace with:

```tsx
<Link href={user ? '/dashboard' : '/'} className="text-sm text-slate-600 hover:text-slate-900">
  {user ? '← Back to Dashboard' : '← Home'}
</Link>
```

### Step 4: Type-check again

```bash
npx tsc --noEmit
```

Expected: No errors.

### Step 5: Commit

```bash
git add "app/reports/[id]/view/page.tsx"
git commit -m "feat: make report view page auth-optional with UUID+paid gate"
```

---

## Task 5: Add Polling to Success Page for Anonymous Users

**Files:**

- Create: `app/reports/[id]/success/ReportReadyPoller.tsx`
- Modify: `app/reports/[id]/success/page.tsx`
- Test: `__tests__/app/reports/success/ReportReadyPoller.test.tsx`

The anonymous branch of the success page currently shows a static "check your email" message. Replace it with a polling client component that auto-redirects to the view page when the webhook completes.

### Step 1: Write the failing test

Create `__tests__/app/reports/success/ReportReadyPoller.test.tsx`:

```typescript
/**
 * ReportReadyPoller Component Tests
 *
 * Verifies the polling loop and redirect behavior
 */
import { render, screen, act, waitFor } from '@testing-library/react'
import { ReportReadyPoller } from '@/app/reports/[id]/success/ReportReadyPoller'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// fetch is mocked globally in setup.ts — we override per test
const mockFetch = global.fetch as jest.Mock

describe('ReportReadyPoller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows processing message initially', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: false }),
    })

    render(<ReportReadyPoller reportId="test-report-id" />)

    expect(screen.getByText(/Processing|Fetching|valuation/i)).toBeInTheDocument()
  })

  it('redirects to /view when status is ready', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: true }),
    })

    render(<ReportReadyPoller reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(2100)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/reports/report-abc/view')
    })
  })

  it('continues polling when not ready', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      return {
        ok: true,
        json: async () => ({ ready: callCount >= 3 }),
      }
    })

    render(<ReportReadyPoller reportId="report-abc" />)

    // Advance through 3 polling cycles
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
      expect(mockPush).toHaveBeenCalledWith('/reports/report-abc/view')
    })
  })

  it('shows timeout message after 30 failed polls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: false }),
    })

    render(<ReportReadyPoller reportId="report-abc" />)

    // Advance 30 polling cycles (30 × 2000ms = 60s)
    await act(async () => {
      jest.advanceTimersByTime(62000)
    })

    await waitFor(() => {
      expect(screen.getByText(/longer than expected|email|try again/i)).toBeInTheDocument()
    })
  })
})
```

### Step 2: Run test to verify it fails

```bash
npx jest "__tests__/app/reports/success/ReportReadyPoller.test.tsx" --no-coverage
```

Expected: FAIL — component file doesn't exist yet.

### Step 3: Create `ReportReadyPoller.tsx`

Create `app/reports/[id]/success/ReportReadyPoller.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

export function ReportReadyPoller({ reportId }: Props) {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (timedOut) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return

        const data = await res.json()
        if (data.ready) {
          router.push(`/reports/${reportId}/view`)
          return
        }
      } catch {
        // Network error — keep polling
      }

      setAttempts(prev => {
        const next = prev + 1
        if (next >= MAX_POLLS) {
          setTimedOut(true)
        }
        return next
      })
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    // Kick off the first poll immediately
    poll()

    return () => clearInterval(timer)
  }, [reportId, router, timedOut])

  if (timedOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Taking Longer Than Expected</h1>
          <p className="text-slate-600 mb-6">
            Your report is being prepared. Check your email for a link, or try refreshing.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
            <p className="text-sm text-slate-500">
              Still having trouble?{' '}
              <a href="mailto:support@totallosstoolkit.com" className="text-emerald-600 underline">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Animated spinner */}
        <div className="w-16 h-16 mx-auto mb-6">
          <svg
            className="animate-spin w-16 h-16 text-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-600 mb-2">Fetching your vehicle&apos;s valuation data&hellip;</p>
        <p className="text-sm text-slate-400">This takes about 10 seconds.</p>
      </div>
    </div>
  )
}
```

### Step 4: Run tests to verify they pass

```bash
npx jest "__tests__/app/reports/success/ReportReadyPoller.test.tsx" --no-coverage
```

Expected: All 4 tests PASS.

### Step 5: Update `app/reports/[id]/success/page.tsx` to use the poller

In the anonymous branch (the `if (!user)` block), replace the entire static JSX return with:

```tsx
if (!user) {
  return <ReportReadyPoller reportId={reportId} />
}
```

Add the import at the top of the file:

```typescript
import { ReportReadyPoller } from './ReportReadyPoller'
```

### Step 6: Type-check

```bash
npx tsc --noEmit
```

Expected: No errors.

### Step 7: Run the full test suite

```bash
npx jest --no-coverage
```

Expected: All tests pass. Coverage may dip slightly since the old anonymous JSX branch is replaced — that's acceptable.

### Step 8: Commit

```bash
git add "app/reports/[id]/success/ReportReadyPoller.tsx" "app/reports/[id]/success/page.tsx" "__tests__/app/reports/success/ReportReadyPoller.test.tsx"
git commit -m "feat: add polling to success page; redirect to /view when report is ready"
```

---

## Task 6: End-to-End Smoke Test

Manual verification of the full flow in production (or staging). No code changes.

### Step 1: Verify Vercel environment variable

In Vercel dashboard → Project → Settings → Environment Variables, confirm `NEXT_PUBLIC_APP_URL` is set to `https://www.totallosstoolkit.com` (or that the x-forwarded-host fallback works by temporarily omitting it).

### Step 2: Deploy

```bash
git push origin main
```

Wait for Vercel deploy to complete (check dashboard).

### Step 3: Manual test flow

1. Go to `https://www.totallosstoolkit.com`
2. Start a report (enter VIN, mileage, ZIP)
3. Choose a report type → click "Purchase"
4. Complete LemonSqueezy checkout with a test card (`4242 4242 4242 4242`, any future expiry, any CVC)
5. Verify redirect goes to `https://www.totallosstoolkit.com/reports/{id}/success` (not localhost)
6. Observe the spinner: "Fetching your vehicle's valuation data…"
7. After ~10 seconds, verify auto-redirect to `/reports/{id}/view`
8. Verify the view page shows vehicle specs and market value — no login required
9. Verify the green "Save this report to your account" banner appears at the top
10. Check email — verify magic link arrives and points to `/reports/{id}/view`

### Step 4: Verify Vercel logs

In Vercel dashboard → Functions → webhook route logs, confirm:

- `[create-checkout] appUrl resolved to: https://www.totallosstoolkit.com`
- `[Webhook] MarketCheck success for report ...`
- `[Webhook] Magic link sent to buyer@example.com`

---

## Summary of Changes

| File                                             | Type     | Purpose                                                         |
| ------------------------------------------------ | -------- | --------------------------------------------------------------- |
| `app/api/lemonsqueezy/webhook/route.ts`          | Modified | Fix appUrl; fix magic link to `/view`                           |
| `app/api/reports/[id]/status/route.ts`           | **New**  | Polling endpoint                                                |
| `proxy.ts`                                       | Modified | Allow anonymous `/reports/[id]/view`                            |
| `app/reports/[id]/view/page.tsx`                 | Modified | Remove auth redirect; use supabaseAdmin; paid gate; anon banner |
| `app/reports/[id]/success/ReportReadyPoller.tsx` | **New**  | Polling client component                                        |
| `app/reports/[id]/success/page.tsx`              | Modified | Use poller for anonymous branch                                 |
