# Report Access Control — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Problem

Report view URLs and PDF download links are publicly accessible to anyone who has the URL, regardless of whether the visitor is the report owner. This is a security issue — reports contain sensitive personal vehicle and valuation data.

## Goal

Only the report owner (matched by `user_id`) or an admin user can view a report or download its PDF. New buyers are guided through account setup on the success page with their checkout email pre-populated.

---

## Access Rules

| Scenario                                        | Behaviour                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Not authenticated → visits `/reports/[id]/view` | Redirect to `/auth?redirect=/reports/[id]/view`                                   |
| Authenticated, wrong account                    | Show "access denied" page                                                         |
| Authenticated as owner                          | Show report as normal                                                             |
| Authenticated as admin                          | Show report as normal                                                             |
| Anonymous buyer on success page                 | Poll for completion → show inline account setup with checkout email pre-populated |
| PDF download                                    | Requires auth + ownership → API returns a signed URL (1-hour expiry)              |

---

## Component Changes

### 1. `app/reports/[id]/view/page.tsx`

**Current:** Auth is optional. Comment explicitly says "UUID is the access credential."

**New behaviour:**

```
1. Call getUser()
2. If no user → redirect to /auth?redirect=/reports/[id]/view
3. Fetch report using supabaseAdmin (by ID only — to check ownership)
4. If report not found → show "Report Not Found"
5. If user.user_metadata?.is_admin === true → allow access
6. If report.user_id !== user.id → show "Access Denied" page
7. Otherwise → render report as normal
```

**Access Denied page** (rendered inline, not a redirect):

- Heading: "This report belongs to a different account"
- Message: "Sign in with the email address you used at checkout to access this report."
- Button: "Sign in with a different account" → links to `/auth?redirect=/reports/[id]/view`

---

### 2. `app/reports/[id]/success/page.tsx` + `ReportReadyPoller`

**Current anonymous flow:** Shows `<ReportReadyPoller reportId={reportId} />` which polls and redirects to `/view` when complete.

**New anonymous flow:**

The success page fetches the report by ID using `supabaseAdmin` (no `user_id` filter) to retrieve the checkout email. It then passes the email to an updated `ReportReadyPoller`.

`ReportReadyPoller` is updated to:

1. Continue polling for report completion as today
2. Once report status is `completed`, show an inline account setup form instead of redirecting:
   - Heading: "Your report is ready — create your account to access it"
   - Email field: pre-populated with checkout email (passed as prop, held in React state — never in the URL)
   - Password + confirm password fields
   - Terms checkbox
   - "Create Account" button → calls `/api/auth/signup` → on success, redirect to `/reports/[id]/view`
   - Below the form: "Already have an account?" link → `/auth?redirect=/reports/[id]/view`
   - Magic link fallback: "Email me a sign-in link instead" → calls `/api/auth/magic-link`

The existing authenticated-user branch of the success page is unchanged.

---

### 3. PDF Gating — `lib/services/pdf-generator.tsx`

**Current:** Stores PDF in Supabase Storage and returns a permanent public URL.

**New:** Returns a **signed URL** (1-hour expiry) instead of a public URL.

```ts
// Replace:
const { data: urlData } = supabase.storage.from('vehicle-reports').getPublicUrl(filepath)

// With:
const { data: signedUrlData } = await supabase.storage
  .from('vehicle-reports')
  .createSignedUrl(filepath, 3600)
```

The `pdf_url` column in the `reports` table stores the **storage path** (`reports/{user_id}/{filename}`) rather than a URL, so a fresh signed URL can be generated on demand.

**`app/api/reports/[id]/generate-pdf/route.ts`** already enforces `user_id` ownership. It is updated to:

1. Check if the PDF already exists in storage (by path) — if so, skip regeneration and go straight to signing
2. Generate a signed URL for the stored file
3. Return the signed URL to the client

The `print-pdf-buttons.tsx` component opens the signed URL in a new tab — no change needed there.

**Supabase Storage bucket:** The `vehicle-reports` bucket must be set to **private** (no public read policy). This is a one-time change in the Supabase dashboard (Storage → vehicle-reports → Policies → remove public read).

---

### 4. `app/reports/[id]/action-plan/page.tsx`

The action-plan page is a direct URL (`/reports/[id]/action-plan`) and must have the same ownership check as the view page. Apply identical logic:

```
1. getUser() — if no user → redirect to /auth?redirect=/reports/[id]/action-plan
2. Fetch report by ID
3. If admin → allow
4. If report.user_id !== user.id → show Access Denied
5. Otherwise → render as normal
```

---

### 5. `pdf_url` storage path — schema migration

A new column `pdf_storage_path TEXT` is added to the `reports` table. This stores the Supabase Storage path (`reports/{user_id}/{filename}.pdf`) separately from any URL, so the generate-pdf API can create a fresh signed URL without URL parsing.

```sql
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
```

**`lib/services/pdf-generator.tsx`** is updated to write `pdf_storage_path` when uploading.

**`app/api/reports/[id]/generate-pdf/route.ts`** is updated to:

1. Read `report.pdf_storage_path` from the database
2. If path exists → call `createSignedUrl(path, 3600)` and return the URL
3. If no path (reports created before this change) → regenerate the PDF via `generateAndUploadPDF`, then return the signed URL

---

## Out of Scope

- No changes to admin report management pages (already behind `requireAdmin`)
- No migration of existing PDFs in storage (the bucket policy change means old public URLs stop working — but owners can always re-download via the API)
- No rate-limiting on the generate-pdf endpoint (pre-existing concern, out of scope here)
