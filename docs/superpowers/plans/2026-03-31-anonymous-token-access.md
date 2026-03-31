# Anonymous Token-Based Report Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken anonymous post-payment flow with a 24-hour UUID token URL that lands the buyer directly on their report, with a skeleton loader while generation completes.

**Architecture:** `access_token` and `access_token_expires_at` are written to the report row at anonymous creation time. The LemonSqueezy `successUrl` for anonymous checkouts points to `/reports/[id]/view?token=[access_token]`. The view page validates the token server-side on every request, rendering the full report or a skeleton depending on whether `marketcheck_valuation` is populated.

**Tech Stack:** Next.js 16 App Router (server components), React 19, Supabase (supabaseAdmin), Tailwind CSS, `crypto.randomUUID()`, `useRouter` from `next/navigation`.

---

## Pre-flight: Branch Setup

Before any code changes, create a feature branch.

- [ ] **Create branch and verify starting point**

```bash
cd "../Vehicle Comparison Site"
git checkout main
git pull origin main
git checkout -b feat/anonymous-token-access
git status
```

Expected: clean working tree on new branch.

---

## Task 1: DB Migration — Add access_token Columns

**Files:**

- Create: `supabase/migrations/20260331000001_add_report_access_token.sql`

This migration adds two nullable columns to `reports`. It must be run in the Supabase SQL editor **before deploying code**.

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: Add access_token columns for anonymous report access
-- Date: 2026-03-31
-- Purpose: Store a UUID token and 24-hour expiry on anonymous reports so
--          buyers can view their report via a token URL without signing in.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.reports.access_token IS
  'UUID token for anonymous report access. NULL for authenticated reports. Generated once at report creation.';

COMMENT ON COLUMN public.reports.access_token_expires_at IS
  'Expiry timestamp for access_token. Set to NOW() + 24 hours at creation. NULL for authenticated reports.';

NOTIFY pgrst, 'reload schema';
```

Save as `supabase/migrations/20260331000001_add_report_access_token.sql`.

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open: `https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql`

Also run the `payments.user_id` nullable migration if not already done:

```sql
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
COMMENT ON COLUMN public.payments.user_id IS 'NULL for anonymous purchases until the buyer claims their report.';
NOTIFY pgrst, 'reload schema';
```

Then run the access_token migration above. Verify with:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reports'
  AND column_name IN ('access_token', 'access_token_expires_at');
```

Expected output: two rows, both `is_nullable = YES`.

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/20260331000001_add_report_access_token.sql
git commit -m "feat: add access_token migration for anonymous report access"
```

---

## Task 2: Update create-anonymous — Generate Token for Anonymous Users

**Files:**

- Modify: `app/api/reports/create-anonymous/route.ts`

Add `access_token` and `access_token_expires_at` to the DB insert when the user is anonymous (no authenticated session). Also update the idempotency return path to include the token from the existing report.

- [ ] **Step 1: Add token generation to the report insert**

In `app/api/reports/create-anonymous/route.ts`, find the `supabase.from('reports').insert({...})` block (around line 133) and add the two new fields:

```typescript
// Generate access token only for anonymous users
const isAnonymous = !authenticatedUserId
const accessToken = isAnonymous ? crypto.randomUUID() : null
const accessTokenExpiresAt = isAnonymous
  ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  : null

// Create report in database (link to authenticated user if available)
const { data: report, error: insertError } = await supabase
  .from('reports')
  .insert({
    vin: sanitizedVin,
    mileage: mileageNum,
    zip_code: zipCode,
    email: normalizedEmail,
    dealer_type: 'private',
    status: 'pending',
    vehicle_data: null,
    user_id: authenticatedUserId,
    // Token-based anonymous access (null for authenticated users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(isAnonymous
      ? { access_token: accessToken, access_token_expires_at: accessTokenExpiresAt }
      : ({} as any)),
  })
  .select()
  .single()
```

- [ ] **Step 2: Include token in the success response**

Find the `return NextResponse.json({ success: true, report: { ... } })` at the end of the function and add `access_token`:

```typescript
return NextResponse.json({
  success: true,
  report: {
    id: report.id,
    vin: report.vin,
    mileage: report.mileage,
    zip_code: report.zip_code,
    email: report.email,
    status: report.status,
    vehicle_data: report.vehicle_data,
    marketcheck_valuation: report.marketcheck_valuation || null,
    created_at: report.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    access_token: (report as any).access_token ?? null,
  },
})
```

- [ ] **Step 3: Update the idempotency (duplicate) return path**

Find the block around line 85 that returns an existing report when a duplicate is detected. It needs to fetch the token from the existing row. Replace the early return:

```typescript
if (recentReports && recentReports.length > 0) {
  console.log('[create-anonymous] Found recent duplicate report:', recentReports[0].id)
  console.log('[create-anonymous] Returning existing report instead of creating duplicate')

  // Fetch full row to include access_token
  const { data: existingReport } = await supabase
    .from('reports')
    .select('id, vin, email, mileage, created_at, access_token')
    .eq('id', recentReports[0].id)
    .single()

  return NextResponse.json({
    success: true,
    report: {
      id: recentReports[0].id,
      vin: recentReports[0].vin,
      mileage: recentReports[0].mileage,
      zip_code: zipCode,
      email: recentReports[0].email,
      status: 'pending',
      vehicle_data: null,
      marketcheck_valuation: null,
      created_at: recentReports[0].created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      access_token: (existingReport as any)?.access_token ?? null,
    },
    message: 'Returning existing recent report (idempotency check)',
  })
}
```

- [ ] **Step 4: Type check**

```bash
cd "../Vehicle Comparison Site"
npm run type-check 2>&1 | grep -E "error TS|create-anonymous"
```

Expected: no errors in `create-anonymous/route.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/api/reports/create-anonymous/route.ts
git commit -m "feat: generate access_token for anonymous report creation"
```

---

## Task 3: Update create-checkout — Conditional successUrl

**Files:**

- Modify: `app/api/lemonsqueezy/create-checkout/route.ts`

When the user is anonymous (no session), read `access_token` from the report row and point `successUrl` directly at the view page with the token. Authenticated users continue to use the success page.

- [ ] **Step 1: Replace the hardcoded successUrl with conditional logic**

Find this block (around line 75):

```typescript
const checkout = await createCheckout({
  variantId,
  customData: {
    reportId,
    reportType,
    ...(user?.id ? { userId: user.id } : {}),
  },
  successUrl: `${appUrl}/reports/${reportId}/success`,
  cancelUrl: `${appUrl}/reports/${reportId}`,
})
```

Replace with:

```typescript
// For anonymous users, successUrl goes straight to the view page with the token.
// Authenticated users continue to the success page (no change).
let successUrl = `${appUrl}/reports/${reportId}/success`
if (!user) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken = (report as any).access_token as string | null
  if (accessToken) {
    successUrl = `${appUrl}/reports/${reportId}/view?token=${accessToken}`
  }
}

const checkout = await createCheckout({
  variantId,
  customData: {
    reportId,
    reportType,
    ...(user?.id ? { userId: user.id } : {}),
  },
  successUrl,
  cancelUrl: `${appUrl}/reports/${reportId}`,
})
```

- [ ] **Step 2: Type check**

```bash
npm run type-check 2>&1 | grep -E "error TS|create-checkout"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/lemonsqueezy/create-checkout/route.ts
git commit -m "feat: point anonymous successUrl to view page with token"
```

---

## Task 4: Create ReportReadyWatcher Component

**Files:**

- Create: `app/reports/[id]/view/ReportReadyWatcher.tsx`

Client component that polls `/api/reports/[id]/status` every 2 seconds. When `ready: true`, calls `router.refresh()` which re-renders the server component with full data (the token in the URL is preserved automatically). After 30 polls with no ready signal, shows a "still generating" message.

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

export function ReportReadyWatcher({ reportId }: Props) {
  const router = useRouter()
  const attemptsRef = useRef(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.ready) {
          // router.refresh() re-fetches the server component; token in URL is preserved
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
        Still generating — refresh the page in a moment.
      </p>
    )
  }

  return null
}
```

- [ ] **Step 2: Type check**

```bash
npm run type-check 2>&1 | grep -E "error TS|ReportReadyWatcher"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/reports/[id]/view/ReportReadyWatcher.tsx
git commit -m "feat: add ReportReadyWatcher client poller component"
```

---

## Task 5: Create TokenAccessBanner Component

**Files:**

- Create: `app/reports/[id]/view/TokenAccessBanner.tsx`

Fixed bottom bar shown only for anonymous token access. Contains: expiry message, copy link button, create account link, PDF export tip, dismiss button. Appears after 1-second delay. Amber background.

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  reportId: string
  token: string
}

export function TokenAccessBanner({ reportId, token }: Props) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Appear after 1 second so report content draws first
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1000)
    return () => clearTimeout(t)
  }, [])

  if (!visible || dismissed) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — silently ignore
    }
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-2xl bg-amber-50 border border-amber-300 rounded-xl shadow-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
        role="alert"
      >
        {/* Message */}
        <div className="flex-1 text-sm text-amber-900">
          <span className="font-semibold">This link expires in 24 hours.</span> After that,{' '}
          <Link
            href={`/auth?mode=signup&redirect=/reports/${reportId}/view`}
            className="underline font-medium hover:text-amber-700"
          >
            create a free account
          </Link>{' '}
          to access your report anytime.{' '}
          <span className="text-amber-700">Tip: export to PDF using the button above.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-amber-700 hover:text-amber-900 text-xl leading-none font-bold px-1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npm run type-check 2>&1 | grep -E "error TS|TokenAccessBanner"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/reports/[id]/view/TokenAccessBanner.tsx
git commit -m "feat: add TokenAccessBanner fixed bottom bar component"
```

---

## Task 6: Update view/page.tsx — Token Validation, Skeleton, isTokenAccess

**Files:**

- Modify: `app/reports/[id]/view/page.tsx`

This is the main change. Replace the hard auth redirect with token-aware access control, add skeleton rendering when `marketcheck_valuation` is null, and mount the two new components when appropriate.

### Access control logic

```
1. Session exists → proceed as today (isTokenAccess = false)
2. No session + ?token present:
   a. Fetch report row
   b. report.access_token === token AND access_token_expires_at > NOW() → proceed (isTokenAccess = true)
   c. Invalid or expired → redirect to /auth?redirect=/reports/[id]/view&reason=token_expired
3. No session + no token → redirect to /auth?redirect=/reports/[id]/view
```

When `isTokenAccess = true`, the paid gate is skipped — the token itself proves the buyer paid. The webhook will stamp `price_paid` and `marketcheck_valuation` asynchronously.

### Skeleton state

When `report.marketcheck_valuation` is null → render skeleton (animated grey bars) in place of the value cards, charts, comparables, and consideration sections. Vehicle header still renders using `report.vin` and any available `autodevData`. Mount `ReportReadyWatcher` so it polls and triggers `router.refresh()` when data arrives.

- [ ] **Step 1: Add searchParams to the page props and imports**

At the top of `app/reports/[id]/view/page.tsx`, add the new imports and update the `PageProps` interface:

```typescript
import { ReportReadyWatcher } from './ReportReadyWatcher'
import { TokenAccessBanner } from './TokenAccessBanner'
```

Replace:

```typescript
interface PageProps {
  params: Promise<{ id: string }>
}
```

With:

```typescript
interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}
```

- [ ] **Step 2: Replace the auth redirect with token-aware access control**

Replace the function signature and the current hard redirect block:

```typescript
// OLD:
export default async function ReportViewPage({ params }: PageProps) {
  const user = await getUser()
  const { id } = await params

  // Auth required — redirect unauthenticated visitors to sign in
  if (!user) {
    redirect(`/auth?redirect=/reports/${id}/view`)
  }
```

With the new access control logic:

```typescript
export default async function ReportViewPage({ params, searchParams }: PageProps) {
  const user = await getUser()
  const { id } = await params
  const { token } = await searchParams

  let isTokenAccess = false

  if (!user) {
    if (!token) {
      redirect(`/auth?redirect=/reports/${id}/view`)
    }

    // Validate token against DB
    const { data: tokenReport } = await supabaseAdmin
      .from('reports')
      .select('access_token, access_token_expires_at')
      .eq('id', id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storedToken = (tokenReport as any)?.access_token as string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expiresAt = (tokenReport as any)?.access_token_expires_at as string | null

    const tokenValid =
      storedToken != null &&
      storedToken === token &&
      expiresAt != null &&
      new Date(expiresAt) > new Date()

    if (!tokenValid) {
      redirect(`/auth?redirect=/reports/${id}/view&reason=token_expired`)
    }

    isTokenAccess = true
  }
```

- [ ] **Step 3: Update the paid gate to skip for token access**

Find this block (around line 80):

```typescript
  // Paid gate: only show report if payment has been processed.
  if (!report.price_paid || report.price_paid === 0) {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      ...
    if (!payment) {
      redirect(`/reports/${id}`)
    }
  }
```

Wrap it so token users bypass it:

```typescript
// Paid gate: skip for token access (token proves the buyer paid; webhook fires async).
// For authenticated users, verify payment record as before.
if (!isTokenAccess) {
  if (!report.price_paid || report.price_paid === 0) {
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
}
```

- [ ] **Step 4: Add skeleton rendering for unready reports**

After the paid gate block (and after `const marketCheck = report.marketcheck_valuation as any`), add a check for report readiness:

```typescript
const isReady = marketCheck != null
```

In `app/reports/[id]/view/page.tsx`, make the following structural change to the JSX return.

The existing JSX inside `<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">` has these sections in order:

1. Report Header (lines ~162–179) — render unconditionally
2. Market Value Cards (lines ~182–213) — wrap in `isReady`
3. Vehicle Specifications (lines ~216–297) — render conditionally on `autodevData`
4. Market Distribution & Analysis (lines ~300–360) — wrap in `isReady`
5. Market Comparables (lines ~362–467) — wrap in `isReady`
6. Additional Valuation Considerations (lines ~470–609) — wrap in `isReady`

After the Report Header block (after line ~179), insert the skeleton/ready conditional. The final structure should be:

```tsx
        {/* Report Header — always render */}
        <div className="mb-8">
          {/* ... existing header JSX unchanged ... */}
        </div>

        {/* Vehicle Specifications — only when autodev data is available (may be null before webhook fires) */}
        {autodevData && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
            {/* ... existing vehicle specs JSX unchanged, starting with the FileText icon and h2 ... */}
          </div>
        )}

        {/* Valuation content — skeleton while report is generating, full content when ready */}
        {!isReady ? (
          <>
            <ReportReadyWatcher reportId={id} />
            {/* Skeleton for value cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-24 mb-3" />
                  <div className="h-10 bg-slate-200 rounded w-32 mb-2" />
                  <div className="h-2 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
            {/* Skeleton for market analysis panel */}
            <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-64 mb-4" />
              <div className="h-4 bg-slate-100 rounded w-48 mb-8" />
              <div className="h-48 bg-slate-100 rounded w-full" />
            </div>
            {/* Skeleton for comparables table */}
            <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-48 mb-6" />
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4 py-4 border-b border-slate-100">
                  <div className="w-24 h-16 bg-slate-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-40" />
                    <div className="h-3 bg-slate-100 rounded w-24" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-20" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Market Value Cards — move the existing grid starting at the {/* Market Value Cards */} comment here */}
            {/* Market Distribution & Analysis — move the existing bg-white rounded-lg section here */}
            {/* Market Comparables — move the existing bg-white rounded-lg section here */}
            {/* Additional Valuation Considerations — move the existing bg-slate-50 rounded-lg section here */}
            {/* All of the above are cut-and-paste of the existing JSX starting at line ~182, unchanged */}
          </>
        )}
```

**Concretely:** In the existing file, cut everything from the `{/* Market Value Cards */}` comment (line ~182) through the end of the Action Plan CTA and disclaimer footer (line ~609), and paste it between `<>` and `</>` in the `isReady ? (...)` true branch above. The vehicle specs card (lines ~216–297) is moved outside the conditional as shown, and wrapped in `{autodevData && ...}`.

- [ ] **Step 5: Add TokenAccessBanner and update the nav back link**

Near the top of the nav bar, the current code is:

```tsx
<Link href={user ? '/dashboard' : '/'} ...>
  {user ? '← Back to Dashboard' : '← Home'}
</Link>
```

Update to handle `isTokenAccess`:

```tsx
<Link href={user ? '/dashboard' : '/'} className="text-sm text-slate-600 hover:text-slate-900">
  {user ? '← Back to Dashboard' : '← Home'}
</Link>
```

(No change needed here — anonymous token users see `← Home`, which is correct.)

At the very end of the returned JSX, before the closing outer `</div>`, mount the banner:

```tsx
      {/* Token access banner — shown only for anonymous token users */}
      {isTokenAccess && token && (
        <TokenAccessBanner reportId={id} token={token} />
      )}
    </div>
  )
```

- [ ] **Step 6: Type check**

```bash
npm run type-check 2>&1 | grep "error TS"
```

Expected: zero TypeScript errors. Fix any that appear before committing.

- [ ] **Step 7: Commit**

```bash
git add app/reports/[id]/view/page.tsx
git commit -m "feat: token-based access control and skeleton loader on report view page"
```

---

## Task 7: Update auth/page.tsx — Expired Token Banner

**Files:**

- Modify: `app/auth/page.tsx`

The auth page is a `'use client'` component that already reads `searchParams` via `useSearchParams()`. Add handling for `reason=token_expired`: when this param is present, show an amber banner at the top prompting the user to sign in to access their report.

- [ ] **Step 1: Read the reason param and add the banner**

In `AuthContent()`, add `reason` to the existing `searchParams` reads:

```typescript
const redirectTo = searchParams.get('returnUrl') || searchParams.get('redirect') || '/dashboard'
const prefilledEmail = searchParams.get('email')
const isExistingUser = searchParams.get('existingUser') === 'true'
const fromHero = searchParams.get('fromHero') === 'true'
const tokenExpired = searchParams.get('reason') === 'token_expired' // ADD THIS LINE
```

Then, inside the return JSX, immediately after the `<div className="max-w-md w-full space-y-8">` opening tag and before the `{/* Header */}` block, add the conditional banner:

```tsx
{
  /* Expired token banner */
}
{
  tokenExpired && (
    <div className="rounded-lg bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">
      <p className="font-semibold mb-1">Your report link has expired.</p>
      <p>Sign in or create a free account to access your report.</p>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npm run type-check 2>&1 | grep "error TS"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/page.tsx
git commit -m "feat: show expired token banner on auth page when reason=token_expired"
```

---

## Task 8: Manual End-to-End Verification

Run the dev server and verify the full anonymous flow works.

- [ ] **Step 1: Start dev server**

```bash
cd "../Vehicle Comparison Site"
npm run dev
```

- [ ] **Step 2: Verify token is generated on anonymous report creation**

```bash
curl -s -X POST http://localhost:3000/api/reports/create-anonymous \
  -H "Content-Type: application/json" \
  -d '{"vin":"1HGBH41JXMN109186","mileage":50000,"zipCode":"90210"}' \
  | grep -o '"access_token":"[^"]*"'
```

Expected: a UUID in the response, e.g. `"access_token":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`.

- [ ] **Step 3: Verify view page renders with a valid token**

Use the report ID and token from step 2. Navigate to:

```
http://localhost:3000/reports/[REPORT_ID]/view?token=[ACCESS_TOKEN]
```

Expected: page renders (skeleton shown since no valuation data yet). No redirect to /auth.

- [ ] **Step 4: Verify invalid token redirects**

Navigate to:

```
http://localhost:3000/reports/[REPORT_ID]/view?token=00000000-0000-0000-0000-000000000000
```

Expected: redirects to `/auth?redirect=/reports/[id]/view&reason=token_expired`. Amber expired-token banner visible on auth page.

- [ ] **Step 5: Verify no-token redirect**

Navigate to:

```
http://localhost:3000/reports/[REPORT_ID]/view
```

(no token, not signed in)

Expected: redirects to `/auth?redirect=/reports/[id]/view` (no reason param, no expired banner).

- [ ] **Step 6: Verify authenticated access unchanged**

Sign in as an existing user and visit their report:

```
http://localhost:3000/reports/[OWNED_REPORT_ID]/view
```

Expected: full report renders with no banner, no skeleton (assuming report is complete).

- [ ] **Step 7: Verify TokenAccessBanner appears on token access**

On the valid token URL from step 3: wait 1 second. Banner should appear at bottom. Test:

- Copy Link button copies the URL
- "×" button dismisses the banner
- "create a free account" link goes to `/auth?mode=signup&redirect=/reports/[id]/view`

---

## Task 9: Open Pull Request

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/anonymous-token-access
```

- [ ] **Step 2: Open PR on GitHub**

Go to `github.com/Lemmeyg/VehicleValuation` and open a pull request from `feat/anonymous-token-access` → `main`.

PR description:

```
## Summary
- Anonymous buyers now land directly on their report after payment via 24-hour UUID token URL
- Skeleton loader shown while webhook processes (~30 seconds); auto-refreshes when ready
- Fixed bottom amber banner shows copy link, expiry warning, create account link, PDF tip
- Expired token redirects to auth page with a clear message
- Authenticated flow and admin free reports: zero change

## Migrations to run before merging
1. `supabase/migrations/20260331000000_allow_anonymous_payments.sql` (payments.user_id nullable)
2. `supabase/migrations/20260331000001_add_report_access_token.sql` (access_token columns)

## Test plan
- [ ] Create anonymous report via curl, verify access_token in response
- [ ] Visit /view?token=[valid] — skeleton renders, no redirect
- [ ] Visit /view?token=[invalid] — redirects to /auth with expired banner
- [ ] Visit /view (no token, not signed in) — redirects to /auth (no expired banner)
- [ ] Authenticated user visits own report — full report, no banner, no regression
- [ ] TokenAccessBanner: copy link, dismiss, create account link all work
```

- [ ] **Step 3: Check Vercel Preview**

Wait for Vercel to post a preview URL on the PR. Test the anonymous flow end-to-end on the preview URL before merging.

---

## Deployment Order (Reminder)

1. Run `payments.user_id` nullable migration in Supabase SQL editor
2. Run `access_token` + `access_token_expires_at` migration in Supabase SQL editor
3. Merge PR → Vercel auto-deploys
4. Test with a real anonymous purchase on production
