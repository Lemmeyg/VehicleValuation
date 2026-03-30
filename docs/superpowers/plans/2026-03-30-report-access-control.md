# Report Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate report view pages and PDF downloads behind authentication and ownership checks, and guide new buyers through account setup on the success page with their checkout email pre-populated.

**Architecture:** A shared `canViewReport` utility centralises the ownership/admin logic and is used by both the view and action-plan pages. The PDF service switches from public URLs to on-demand signed URLs, backed by a new `pdf_storage_path` column. The `ReportReadyPoller` component gains an account-setup form shown inline once the report is ready.

**Tech Stack:** Next.js 16 App Router, Supabase (SSR + Admin), React, TypeScript, Jest

---

## File Map

| File                                                          | Change                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `supabase/migrations/20260330000000_add_pdf_storage_path.sql` | CREATE — migration to add `pdf_storage_path` column            |
| `lib/utils/report-access.ts`                                  | CREATE — `canViewReport(userId, isAdmin, reportUserId)` helper |
| `__tests__/lib/utils/report-access.test.ts`                   | CREATE — unit tests for the helper                             |
| `lib/services/pdf-generator.tsx`                              | MODIFY — write `pdf_storage_path`, return signed URL           |
| `app/api/reports/[id]/generate-pdf/route.ts`                  | MODIFY — use `pdf_storage_path` to generate fresh signed URL   |
| `app/reports/[id]/view/page.tsx`                              | MODIFY — add auth + ownership gate at top of function          |
| `app/reports/[id]/action-plan/page.tsx`                       | MODIFY — add admin bypass + access denied UI                   |
| `app/reports/[id]/success/page.tsx`                           | MODIFY — fetch report email for anonymous branch               |
| `app/reports/[id]/success/ReportReadyPoller.tsx`              | MODIFY — add account setup form shown after report is ready    |
| `__tests__/app/reports/success/ReportReadyPoller.test.tsx`    | MODIFY — add tests for new account setup behaviour             |

---

### Task 1: Add `pdf_storage_path` database column

**Files:**

- Create: `supabase/migrations/20260330000000_add_pdf_storage_path.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260330000000_add_pdf_storage_path.sql` with:

```sql
-- Add pdf_storage_path column to reports table.
-- Stores the Supabase Storage path (e.g. reports/{user_id}/total-loss-report-2019-Honda-Civic.pdf)
-- so the API can generate fresh signed URLs without parsing a potentially-stale public URL.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
```

- [ ] **Step 2: Apply the migration via Supabase dashboard**

The Supabase CLI is not available. Apply the migration manually:

1. Open https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql
2. Paste the SQL above and click **Run**
3. Verify: run `SELECT column_name FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'pdf_storage_path';` — should return one row

- [ ] **Step 3: Commit the migration file**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
git add supabase/migrations/20260330000000_add_pdf_storage_path.sql
git commit -m "feat: add pdf_storage_path column to reports table"
```

---

### Task 2: `canViewReport` utility + tests

**Files:**

- Create: `lib/utils/report-access.ts`
- Create: `__tests__/lib/utils/report-access.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/utils/report-access.test.ts`:

```ts
import { canViewReport } from '@/lib/utils/report-access'

describe('canViewReport', () => {
  const OWNER_ID = 'user-abc'
  const OTHER_ID = 'user-xyz'

  it('returns true when user is the owner', () => {
    expect(canViewReport(OWNER_ID, false, OWNER_ID)).toBe(true)
  })

  it('returns false when user is not the owner', () => {
    expect(canViewReport(OTHER_ID, false, OWNER_ID)).toBe(false)
  })

  it('returns true when user is admin regardless of ownership', () => {
    expect(canViewReport(OTHER_ID, true, OWNER_ID)).toBe(true)
  })

  it('returns false when reportUserId is null and user is not admin', () => {
    expect(canViewReport(OWNER_ID, false, null)).toBe(false)
  })

  it('returns true when reportUserId is null but user is admin', () => {
    expect(canViewReport(OTHER_ID, true, null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npx jest __tests__/lib/utils/report-access.test.ts --no-coverage
```

Expected: FAIL with "Cannot find module '@/lib/utils/report-access'"

- [ ] **Step 3: Create the utility**

Create `lib/utils/report-access.ts`:

```ts
/**
 * Determines whether a user is allowed to view a report.
 *
 * Admins can view any report. Non-admins must be the report owner.
 */
export function canViewReport(
  userId: string,
  isAdmin: boolean,
  reportUserId: string | null
): boolean {
  if (isAdmin) return true
  if (!reportUserId) return false
  return userId === reportUserId
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npx jest __tests__/lib/utils/report-access.test.ts --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/report-access.ts __tests__/lib/utils/report-access.test.ts
git commit -m "feat: add canViewReport access control utility"
```

---

### Task 3: Update PDF generator to store path and return signed URL

**Files:**

- Modify: `lib/services/pdf-generator.tsx` (lines 69–110)

- [ ] **Step 1: Replace the upload + URL section**

In `lib/services/pdf-generator.tsx`, find the block starting with `// Generate PDF buffer` and replace from the upload section through the `return` statement. The full updated section (from line 69 to the end of the try block) is:

```ts
    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(<VehicleReportPDF data={pdfData} />)

    // Generate filename from vehicle year/make/model, falling back to VIN
    const vinData = reportData.autodev_vin_data
    const vehicleYear = vinData?.vehicle?.year
    const vehicleMake = vinData?.make
    const vehicleModel = vinData?.model

    let filenamePart: string
    if (vehicleYear && vehicleMake && vehicleModel) {
      filenamePart = `${vehicleYear}-${vehicleMake}-${vehicleModel}`
        .replace(/[^A-Za-z0-9-]/g, '-')
        .replace(/-+/g, '-')
    } else {
      filenamePart = reportData.vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    }
    const filename = `total-loss-report-${filenamePart}.pdf`
    const filepath = `reports/${reportData.user_id}/${filename}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('vehicle-reports')
      .upload(filepath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return { success: false, error: 'Failed to upload PDF' }
    }

    // Generate a 1-hour signed URL for the immediate response
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('vehicle-reports')
      .createSignedUrl(filepath, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', signedUrlError)
      return { success: false, error: 'Failed to create signed URL' }
    }

    // Update report: store the storage path (permanent) and mark completed
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        pdf_url: signedUrlData.signedUrl,
        pdf_storage_path: filepath,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)

    if (updateError) {
      console.error('Error updating report:', updateError)
      return { success: false, error: 'Failed to update report' }
    }

    return {
      success: true,
      pdfUrl: signedUrlData.signedUrl,
    }
```

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npm run type-check 2>&1 | grep -v "__tests__" | grep -v "setup.ts" | grep -v "proxy.test"
```

Expected: no errors in `lib/services/pdf-generator.tsx`.

- [ ] **Step 3: Commit**

```bash
git add lib/services/pdf-generator.tsx
git commit -m "feat: store pdf_storage_path and return signed URL from PDF generator"
```

---

### Task 4: Update generate-pdf route to use stored path

**Files:**

- Modify: `app/api/reports/[id]/generate-pdf/route.ts` (lines 49–73)

Currently the POST handler caches the `pdf_url` (which is now an expired signed URL). Replace the cache check and return logic so it generates a fresh signed URL from `pdf_storage_path` when available.

- [ ] **Step 1: Replace the POST handler body**

In `app/api/reports/[id]/generate-pdf/route.ts`, replace the entire POST handler (keep imports and interface unchanged) with:

```ts
export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Verify user is authenticated
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: reportId } = await params

    // Verify user owns this report
    const supabase = await createServerSupabaseClient()
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const requirePayment = process.env.REQUIRE_PAYMENT_FOR_PDF === 'true'
    if (requirePayment && (!report.price_paid || report.price_paid === 0)) {
      return NextResponse.json({ error: 'Report has not been paid for' }, { status: 400 })
    }

    // If PDF has already been stored, generate a fresh 1-hour signed URL
    if (report.pdf_storage_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('vehicle-reports')
        .createSignedUrl(report.pdf_storage_path, 3600)

      if (signedUrlError || !signedUrlData?.signedUrl) {
        // Path exists in DB but file may be missing — fall through to regenerate
        console.warn('Signed URL failed for stored path, regenerating:', signedUrlError)
      } else {
        return NextResponse.json({
          message: 'PDF ready',
          pdfUrl: signedUrlData.signedUrl,
        })
      }
    }

    // No stored path — generate the PDF for the first time (or re-generate after failure)
    const result = await generateAndUploadPDF({ reportId })

    if (!result.success) {
      console.error('PDF generation failed:', result.error)
      return NextResponse.json({ error: result.error || 'Failed to generate PDF' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'PDF generated successfully',
      pdfUrl: result.pdfUrl,
    })
  } catch (error) {
    console.error('Error in generate-pdf route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

Leave the GET handler on this route unchanged — report status polling uses a separate `/api/reports/[id]/status` route.

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npm run type-check 2>&1 | grep -v "__tests__" | grep -v "setup.ts" | grep -v "proxy.test"
```

Expected: no errors in the route file.

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/[id]/generate-pdf/route.ts
git commit -m "feat: generate fresh signed URL for PDF downloads using pdf_storage_path"
```

---

### Task 5: Gate the report view page

**Files:**

- Modify: `app/reports/[id]/view/page.tsx` (lines 1–65)

- [ ] **Step 1: Add the import for canViewReport**

At the top of `app/reports/[id]/view/page.tsx`, add the import after the existing imports:

```ts
import { canViewReport } from '@/lib/utils/report-access'
```

- [ ] **Step 2: Replace the function opening through the payment gate**

Find the current opening of `ReportViewPage` (lines ~22–64) and replace it with:

```ts
export default async function ReportViewPage({ params }: PageProps) {
  const user = await getUser()
  const { id } = await params

  // Auth required — anonymous access is no longer permitted
  if (!user) {
    redirect(`/auth?redirect=/reports/${id}/view`)
  }

  const isAdmin = user.user_metadata?.is_admin === true

  // Fetch report (admin client bypasses RLS so we can check ownership ourselves)
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report Not Found</h1>
          <p className="mt-2 text-gray-600">
            The report you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-500">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Ownership check — admins can view any report
  if (!canViewReport(user.id, isAdmin, report.user_id)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">
            This report belongs to a different account. Sign in with the email address you used at
            checkout to access this report.
          </p>
          <Link
            href={`/auth?redirect=/reports/${id}/view`}
            className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    )
  }

  // Paid gate: only show report if payment has been processed.
  // Admin free reports have price_paid=0 but have a succeeded payment record.
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
```

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npm run type-check 2>&1 | grep -v "__tests__" | grep -v "setup.ts" | grep -v "proxy.test"
```

Expected: no errors in the view page.

- [ ] **Step 4: Commit**

```bash
git add app/reports/[id]/view/page.tsx
git commit -m "feat: require authentication and ownership to view report"
```

---

### Task 6: Gate the action-plan page

**Files:**

- Modify: `app/reports/[id]/action-plan/page.tsx` (lines 1–50)

The action-plan page already has auth + ownership checks, but needs: (a) redirect to `/auth` not `/login`, (b) admin bypass, (c) proper access-denied UI.

- [ ] **Step 1: Add imports**

At the top of `app/reports/[id]/action-plan/page.tsx`, add after existing imports:

```ts
import { supabaseAdmin } from '@/lib/db/supabase'
import { canViewReport } from '@/lib/utils/report-access'
```

- [ ] **Step 2: Replace the function opening through the report fetch**

Find the current opening of `ActionPlanPage` (lines ~30–50) and replace it with:

```ts
export default async function ActionPlanPage({ params }: PageProps) {
  const user = await getUser()
  const { id } = await params

  // Auth required
  if (!user) {
    redirect(`/auth?redirect=/reports/${id}/action-plan`)
  }

  const isAdmin = user.user_metadata?.is_admin === true

  // Fetch report via admin client so we can check ownership ourselves
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report Not Found</h1>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-500">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!canViewReport(user.id, isAdmin, report.user_id)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">
            This report belongs to a different account. Sign in with the email address you used at
            checkout to access this report.
          </p>
          <Link
            href={`/auth?redirect=/reports/${id}/action-plan`}
            className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    )
  }
```

Remove the old `const supabase = await createServerSupabaseClient()` line and the old report fetch block that followed (they are replaced by the supabaseAdmin fetch above). Keep everything from the `if (error || !report)` check onwards as replaced above, and keep all the JSX render below unchanged.

- [ ] **Step 3: Remove unused import**

If `createServerSupabaseClient` is no longer used in the file, remove its import line.

- [ ] **Step 4: Type-check**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npm run type-check 2>&1 | grep -v "__tests__" | grep -v "setup.ts" | grep -v "proxy.test"
```

Expected: no errors in the action-plan page.

- [ ] **Step 5: Commit**

```bash
git add app/reports/[id]/action-plan/page.tsx
git commit -m "feat: require authentication and ownership to view action plan"
```

---

### Task 7: Success page — account setup for anonymous buyers

**Files:**

- Modify: `app/reports/[id]/success/page.tsx` (lines 26–31)
- Modify: `app/reports/[id]/success/ReportReadyPoller.tsx` (full rewrite)
- Modify: `__tests__/app/reports/success/ReportReadyPoller.test.tsx`

#### Part A — Success page passes checkout email to poller

- [ ] **Step 1: Add supabaseAdmin import to success page**

In `app/reports/[id]/success/page.tsx`, add to the imports:

```ts
import { supabaseAdmin } from '@/lib/db/supabase'
```

- [ ] **Step 2: Replace the anonymous branch**

Find this block (lines ~29–31):

```ts
  // Anonymous buyer — poll until webhook completes, then redirect to /view
  if (!user) {
    return <ReportReadyPoller reportId={reportId} />
  }
```

Replace it with:

```ts
  // Anonymous buyer — fetch report to get checkout email, then show poller with account setup
  if (!user) {
    const { data: anonReport } = await supabaseAdmin
      .from('reports')
      .select('email')
      .eq('id', reportId)
      .single()

    return <ReportReadyPoller reportId={reportId} checkoutEmail={anonReport?.email ?? null} />
  }
```

#### Part B — Update ReportReadyPoller

- [ ] **Step 3: Replace ReportReadyPoller.tsx**

Replace the entire contents of `app/reports/[id]/success/ReportReadyPoller.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'

interface Props {
  reportId: string
  checkoutEmail: string | null
}

type PollerState = 'polling' | 'setup' | 'magic-link-sent' | 'timedOut'

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

export function ReportReadyPoller({ reportId, checkoutEmail }: Props) {
  const router = useRouter()
  const attemptsRef = useRef(0)
  const [pollerState, setPollerState] = useState<PollerState>('polling')

  // Account setup form state
  const [email, setEmail] = useState(checkoutEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (pollerState !== 'polling') return

    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.ready) {
          if (checkoutEmail) {
            // Anonymous buyer — show account setup instead of redirecting
            setPollerState('setup')
          } else {
            // Already authenticated — redirect directly
            router.push(`/reports/${reportId}/view`)
          }
          return
        }
      } catch {
        // Network error — keep polling
      }
      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_POLLS) {
        setPollerState('timedOut')
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    poll()
    return () => clearInterval(timer)
  }, [reportId, router, pollerState, checkoutEmail])

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (password !== confirmPassword) {
      setFormError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }
    if (!agreedToTerms) {
      setFormError('Please agree to the Terms and Conditions')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Account already exists (created by webhook) — send magic link instead
        if (
          data.error?.toLowerCase().includes('already registered') ||
          data.error?.toLowerCase().includes('already exists')
        ) {
          await sendMagicLink()
          return
        }
        setFormError(data.error || 'Failed to create account')
        return
      }

      // Account created and session established — go to report
      router.push(`/reports/${reportId}/view`)
      router.refresh()
    } catch {
      setFormError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sendMagicLink = async () => {
    try {
      await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setPollerState('magic-link-sent')
    } catch {
      setFormError('Failed to send sign-in link. Please try again.')
    }
  }

  if (pollerState === 'timedOut') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
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

  if (pollerState === 'magic-link-sent') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-600 mb-2">
            We sent a sign-in link to <span className="font-medium">{email}</span>.
          </p>
          <p className="text-sm text-slate-400">
            Click the link to access your report. The link expires in 24 hours.
          </p>
        </div>
      </div>
    )
  }

  if (pollerState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Your report is ready!</h1>
            <p className="text-slate-600 mt-1">Create your account to access it.</p>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-4">
            {formError && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="At least 8 characters"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                disabled={loading}
              />
              <label htmlFor="terms" className="ml-3 text-sm text-gray-700 cursor-pointer">
                I agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  Terms and Conditions
                </a>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Creating account...
                </>
              ) : (
                'Create account & view report'
              )}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
            >
              Email me a sign-in link instead
            </button>
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <a
                href={`/auth?redirect=/reports/${reportId}/view`}
                className="text-blue-600 hover:text-blue-500"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // pollerState === 'polling'
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6">
          <svg
            className="animate-spin w-16 h-16 text-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
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

#### Part C — Update existing tests and add new ones

- [ ] **Step 4: Update ReportReadyPoller tests**

Replace `__tests__/app/reports/success/ReportReadyPoller.test.tsx` with:

```tsx
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { ReportReadyPoller } from '@/app/reports/[id]/success/ReportReadyPoller'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}))

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
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ready: false }) })
    render(<ReportReadyPoller reportId="test-id" checkoutEmail={null} />)
    expect(screen.getByText(/Payment Successful/i)).toBeInTheDocument()
  })

  it('redirects to /view when ready and no checkoutEmail (authenticated user)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ready: true }) })
    render(<ReportReadyPoller reportId="report-abc" checkoutEmail={null} />)
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/reports/report-abc/view')
    })
  })

  it('shows account setup form when ready and checkoutEmail provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ready: true }) })
    render(<ReportReadyPoller reportId="report-abc" checkoutEmail="buyer@example.com" />)
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    await waitFor(() => {
      expect(screen.getByText(/Your report is ready/i)).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('buyer@example.com')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows timeout message after 30 failed polls', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ready: false }) })
    render(<ReportReadyPoller reportId="report-abc" checkoutEmail={null} />)
    await act(async () => {
      jest.advanceTimersByTime(62000)
    })
    await waitFor(() => {
      expect(screen.getByText(/Taking Longer Than Expected/i)).toBeInTheDocument()
    })
  })

  it('shows magic-link-sent state after sending magic link', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ready: true }) }) // poll
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // magic-link

    render(<ReportReadyPoller reportId="report-abc" checkoutEmail="buyer@example.com" />)
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    await waitFor(() => screen.getByText(/Your report is ready/i))

    const magicLinkBtn = screen.getByText(/Email me a sign-in link/i)
    await act(async () => {
      fireEvent.click(magicLinkBtn)
    })

    await waitFor(() => {
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 5: Run the tests**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npx jest __tests__/app/reports/success/ReportReadyPoller.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Type-check**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npm run type-check 2>&1 | grep -v "__tests__" | grep -v "setup.ts" | grep -v "proxy.test"
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/reports/[id]/success/page.tsx \
        app/reports/[id]/success/ReportReadyPoller.tsx \
        __tests__/app/reports/success/ReportReadyPoller.test.tsx
git commit -m "feat: show account setup form on success page for new buyers"
```

---

### Task 8: Make Supabase Storage bucket private (manual step)

This step has no code changes. It must be done in the Supabase dashboard.

- [ ] **Step 1: Remove the public read policy from the vehicle-reports bucket**

1. Open https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/storage/buckets
2. Click **vehicle-reports**
3. Go to **Policies**
4. Find any policy that allows `SELECT` for `anon` or `public` role
5. Delete that policy
6. Confirm the bucket is now private: try opening an existing PDF URL in an incognito browser — it should return a 400 or 403 error

**Note:** Existing publicly-shared PDF URLs will stop working after this step. Users must use the "Download PDF" button (which generates a fresh signed URL via the authenticated API) to access their PDFs going forward.

- [ ] **Step 2: Verify signed URLs still work**

Log in as a test user, view a report, and click "Download PDF". Confirm the PDF opens correctly via the signed URL.
