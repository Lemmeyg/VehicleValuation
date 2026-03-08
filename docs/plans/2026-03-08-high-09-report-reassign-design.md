# HIGH-09 — Report Reassignment Design

**Date:** 2026-03-08
**Branch:** feat/high-09-report-reassign

---

## Problem

There is no way for an admin to move a report from one user account to another. This is needed for support corrections and account transfers.

---

## Design

### 1. Database — `admin_audit_log` table

Run once in the Supabase dashboard SQL editor:

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

For a reassignment the row records:

- `action`: `'reassign_report'`
- `admin_user_id`: logged-in admin's UUID
- `entity_type`: `'report'`
- `entity_id`: report UUID
- `from_value`: old `user_id`
- `to_value`: new `user_id`
- `metadata`: `{ "target_email": "user@example.com" }`

Designed generically for future admin actions.

---

### 2. API Route — `POST /api/admin/reports/[id]/reassign`

**Request body:** `{ "email": "user@example.com" }`

**Steps:**

1. `requireAdmin()` — 401/403 if not authenticated or not admin
2. Look up target user by email via `supabaseAdmin.auth.admin.listUsers()`
3. 404 if no user found with that email
4. Fetch current report to get existing `user_id` — 404 if report not found
5. Guard: if target user is already the owner, return 400 `"Report is already assigned to this user"`
6. Update `reports.user_id` to new user's UUID
7. Insert row into `admin_audit_log`
8. Return `{ success: true, newUserId, newUserEmail }`

---

### 3. Admin UI — `ReassignReportForm` client component

Added to `/admin/reports/[id]/page.tsx` below the "Technical Details" card.

Extracted as a `'use client'` component (`components/admin/ReassignReportForm.tsx`) to handle interactivity within the server-rendered page.

**UI elements:**

- Card heading: "Reassign Report"
- Read-only current owner display
- Email input: "New owner email address"
- Submit button: "Reassign Report"
- Success: green confirmation with new email and user ID
- Error: red inline message

---

## Files

- **Create:** `app/api/admin/reports/[id]/reassign/route.ts`
- **Create:** `components/admin/ReassignReportForm.tsx`
- **Modify:** `app/admin/reports/[id]/page.tsx` — import and render `ReassignReportForm`
- **Manual:** Run `admin_audit_log` SQL in Supabase dashboard before deploying

---

## Out of Scope

- No email notification to the receiving user
- No UI to view the audit log (raw Supabase dashboard access is sufficient for now)
- No bulk reassignment
