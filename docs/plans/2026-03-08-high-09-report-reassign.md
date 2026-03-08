# HIGH-09 Report Reassignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to reassign a report to a different user account by email, with full audit logging.

**Architecture:** New API route handles the reassignment logic. New client component renders the form on the existing admin report detail page. Audit log stored in a new `admin_audit_log` Supabase table.

**Tech Stack:** Next.js 16, Supabase (service role), existing `requireAdmin()` pattern from `@/lib/db/admin-auth`

---

## Pre-requisite: Create `admin_audit_log` table

**Before writing any code**, run this SQL in the Supabase dashboard:
`https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql`

```sql
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  admin_user_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  from_value text,
  to_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
```

Confirm the table appears in the Table Editor before proceeding.

---

### Task 1: Create the reassign API route

**Files:**

- Create: `app/api/admin/reports/[id]/reassign/route.ts`

**Step 1: Create the file with this content**

```ts
/**
 * POST /api/admin/reports/[id]/reassign
 *
 * Admin-only endpoint to reassign a report to a different user account.
 * Identifies the target user by email address.
 * Logs the action to admin_audit_log.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireAdmin()
    const { id: reportId } = await params

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 })
    }

    // Look up target user by email
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    if (usersError) {
      console.error('[REASSIGN] Error listing users:', usersError)
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
    }

    const targetUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    // Fetch current report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('id, user_id')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Guard: already assigned to this user
    if (report.user_id === targetUser.id) {
      return NextResponse.json(
        { error: 'Report is already assigned to this user' },
        { status: 400 }
      )
    }

    const fromUserId = report.user_id

    // Update report user_id
    const { error: updateError } = await supabaseAdmin
      .from('reports')
      .update({ user_id: targetUser.id })
      .eq('id', reportId)

    if (updateError) {
      console.error('[REASSIGN] Error updating report:', updateError)
      return NextResponse.json({ error: 'Failed to reassign report' }, { status: 500 })
    }

    // Log to admin_audit_log
    await supabaseAdmin.from('admin_audit_log').insert({
      action: 'reassign_report',
      admin_user_id: admin.id,
      entity_type: 'report',
      entity_id: reportId,
      from_value: fromUserId,
      to_value: targetUser.id,
      metadata: { target_email: email.toLowerCase() },
    })

    return NextResponse.json({
      success: true,
      newUserId: targetUser.id,
      newUserEmail: targetUser.email,
    })
  } catch (error) {
    console.error('[REASSIGN] Unexpected error:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
```

**Step 2: Run type-check**

```bash
cd "../Vehicle Comparison Site" && npm run type-check 2>&1 | tail -5
```

Expected: no new errors beyond pre-existing test file errors

**Step 3: Commit**

```bash
git add app/api/admin/reports/[id]/reassign/route.ts
git commit -m "feat: HIGH-09 add POST /api/admin/reports/[id]/reassign route"
```

---

### Task 2: Create the ReassignReportForm client component

**Files:**

- Create: `components/admin/ReassignReportForm.tsx`

**Step 1: Create the file**

```tsx
'use client'

import { useState } from 'react'

interface ReassignReportFormProps {
  reportId: string
  currentUserId: string | null
}

export default function ReassignReportForm({ reportId, currentUserId }: ReassignReportFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ newUserId: string; newUserEmail: string } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/reports/${reportId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reassign report')
      } else {
        setSuccess({ newUserId: data.newUserId, newUserEmail: data.newUserEmail })
        setEmail('')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-6 py-5 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Reassign Report</h2>
      </div>
      <div className="px-6 py-5">
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-500 mb-1">Current Owner</p>
          <p className="text-sm text-gray-900 font-mono">{currentUserId ?? 'Unassigned'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reassign-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New owner email address
            </label>
            <input
              id="reassign-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm font-medium text-green-800">Report reassigned successfully</p>
              <p className="text-sm text-green-700 mt-1">
                New owner: <span className="font-mono">{success.newUserEmail}</span>
              </p>
              <p className="text-sm text-green-700 font-mono">{success.newUserId}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Reassigning...' : 'Reassign Report'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Run type-check**

```bash
npm run type-check 2>&1 | tail -5
```

Expected: no new errors

**Step 3: Commit**

```bash
git add components/admin/ReassignReportForm.tsx
git commit -m "feat: HIGH-09 add ReassignReportForm client component"
```

---

### Task 3: Add ReassignReportForm to admin report detail page

**Files:**

- Modify: `app/admin/reports/[id]/page.tsx`

**Step 1: Add import at the top of the file**

After the existing imports, add:

```tsx
import ReassignReportForm from '@/components/admin/ReassignReportForm'
```

**Step 2: Render the component**

Find the "Technical Details" section (the `<div className="bg-white rounded-lg shadow mb-6">` block containing "Technical Details"). Add `ReassignReportForm` immediately after that block's closing `</div>`:

```tsx
<ReassignReportForm reportId={report.id} currentUserId={report.user_id} />
```

**Step 3: Run type-check**

```bash
npm run type-check 2>&1 | tail -5
```

Expected: no new errors

**Step 4: Verify in dev server**

```bash
npm run dev
```

Navigate to `/admin/reports/<any-report-id>`. Confirm:

- "Reassign Report" card appears below "Technical Details"
- Current owner UUID is displayed
- Submitting an unknown email shows "No user found with that email address"
- Submitting the current owner's email shows "Report is already assigned to this user"
- Submitting a valid different user's email shows green success confirmation

**Step 5: Commit**

```bash
git add app/admin/reports/[id]/page.tsx
git commit -m "feat: HIGH-09 add ReassignReportForm to admin report detail page"
```

---

### Task 4: Push branch and open PR

**Step 1: Push branch**

```bash
git push -u origin feat/high-09-report-reassign
```

**Step 2: Open PR on GitHub**

Go to: `https://github.com/Lemmeyg/VehicleValuation/pull/new/feat/high-09-report-reassign`

Title: `feat: HIGH-09 admin report reassignment by email`

Body:

```
## Summary
- New API route: POST /api/admin/reports/[id]/reassign — looks up user by email, updates report user_id, logs to admin_audit_log
- New ReassignReportForm client component on admin report detail page
- All reassignments logged to admin_audit_log table with admin ID, from/to user IDs, and target email

## Pre-requisite
Run the admin_audit_log SQL migration in Supabase dashboard before merging.

## Test Plan
- [ ] admin_audit_log table created in Supabase
- [ ] Unknown email returns clear error message
- [ ] Same user email returns "already assigned" error
- [ ] Valid reassignment updates user_id in reports table
- [ ] admin_audit_log row created with correct from/to values
- [ ] Reassigned report appears in target user's dashboard
- [ ] Vercel Preview URL checked before merging

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
