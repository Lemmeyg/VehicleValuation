# Spec: Anonymous Token-Based Report Access

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Replace the broken anonymous post-payment flow with a 24-hour token URL that loads the report directly, with a skeleton loader while generation completes.

---

## Problem

Anonymous buyers (no account) complete payment on LemonSqueezy but never see their report because:

1. The success page redirected them to `/auth` — they had no account to sign in with
2. The webhook was receiving GET instead of POST due to a 301 domain redirect (now fixed via Vercel domain settings)

The previous "create account on success page" approach added unnecessary friction and depended on a fragile webhook → session handoff.

---

## Goals

- Anonymous buyer lands on their report page immediately after payment
- Report loads with a skeleton while generation completes (~30 seconds)
- A dismissable banner shows: copy link, 24-hour expiry warning, create account prompt, PDF export note
- Authenticated users see zero change
- No email dependency

---

## Approach

**Token in URL.** A UUID access token is generated when the anonymous report is created and stored on the report row. The LemonSqueezy `successUrl` for anonymous checkouts points directly to `/reports/[id]/view?token=[access_token]`. The view page validates the token server-side on every request. No session, no cookie, no email.

---

## Data Model

**Migration:** `supabase/migrations/20260331000001_add_report_access_token.sql`

Two new nullable columns on `reports`:

| Column                    | Type          | Default | Notes                                                                             |
| ------------------------- | ------------- | ------- | --------------------------------------------------------------------------------- |
| `access_token`            | `UUID`        | `NULL`  | Generated at anonymous report creation only. NULL for authenticated reports.      |
| `access_token_expires_at` | `TIMESTAMPTZ` | `NULL`  | Set to `NOW() + INTERVAL '24 hours'` at creation. NULL for authenticated reports. |

**Token properties:**

- UUID v4 — 128-bit random, unguessable
- Generated once at report creation, never rotated
- Read-only: grants view access to its specific report ID only
- Expiry checked server-side on every request

**Existing reports** (pre-migration): `access_token = NULL` — fall through to auth redirect, same as today.

---

## Checkout Flow Changes

### `/api/reports/create-anonymous/route.ts`

On anonymous report creation, generate a UUID token and set expiry:

- `access_token`: `crypto.randomUUID()`
- `access_token_expires_at`: `new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()`

Both columns written to the DB in the same `insert` call as the report row.

### `/api/lemonsqueezy/create-checkout/route.ts`

The `successUrl` is now conditional:

- **Authenticated user** (session exists): `successUrl = ${appUrl}/reports/${reportId}/success` — no change
- **Anonymous user** (no session): read `access_token` from the report row, set `successUrl = ${appUrl}/reports/${reportId}/view?token=${access_token}`

Anonymous buyers bypass the success page entirely and land directly on the report view.

---

## Report View Page Changes

**File:** `app/reports/[id]/view/page.tsx`

### Access control (replaces hard redirect)

```
1. User has valid session → proceed as today (no change)
2. No session + ?token in URL:
   - Fetch report row
   - Validate: report.access_token === token AND access_token_expires_at > NOW()
   - Valid → proceed with isTokenAccess = true
   - Invalid/expired → redirect to /auth?redirect=/reports/[id]/view&reason=token_expired
3. No session + no token → redirect to /auth?redirect=/reports/[id]/view
```

### Report readiness + skeleton

After access is granted, check whether `marketcheck_valuation` is populated:

**Report ready:** render full report as today.

**Report not ready:**

- Render page chrome immediately (nav, vehicle header using VIN/year/make/model already stored on the report row)
- Replace valuation panel, comparables, and charts with skeleton placeholder blocks (animated grey bars, Tailwind `animate-pulse`)
- Mount `ReportReadyWatcher` client component

### isTokenAccess prop

`isTokenAccess: boolean` passed to the report content area. When `true`, mounts `TokenAccessBanner`. When `false` (authenticated), nothing changes.

---

## New Components

### `app/reports/[id]/view/ReportReadyWatcher.tsx`

Client component. Props: `reportId: string`. No token prop needed — `router.refresh()` re-fetches the server component with the current URL (token already in it), so token validation is preserved automatically.

- Polls `/api/reports/[id]/status` every 2 seconds
- On `ready: true` → calls `router.refresh()` to re-render the server component with full data; skeleton disappears
- After 30 polls with no ready signal → shows inline message: _"Still generating — refresh the page in a moment"_
- Unmounts itself after triggering refresh

### `app/reports/[id]/view/TokenAccessBanner.tsx`

Client component. Props: `reportId: string`, `token: string`.

**Appearance:** Fixed bottom bar (full-width mobile, wide centred toast desktop). Amber/yellow background. Does not block report content.

**Content:**

- Icon + message: _"This link expires in 24 hours. After that, create a free account to access your report anytime."_
- **Copy Link** button — copies `window.location.href` to clipboard; shows "Copied!" for 2 seconds
- **Create Account** link → `/auth?mode=signup&redirect=/reports/[id]/view`
- Small note: _"Tip: export your report to PDF using the button above."_
- Dismiss (×) button — hides banner for the current session only

**Behaviour:**

- Appears after 1-second delay (report content draws first)
- Stays visible until dismissed
- No external toast library — built with Tailwind classes already in the project

---

## Expired Token Experience

When `access_token_expires_at < NOW()` or token doesn't match:

Redirect to `/auth?redirect=/reports/[id]/view&reason=token_expired`

The auth page reads `reason=token_expired` and shows a banner:

> _"Your report link has expired. Sign in or create a free account to access your report."_

This banner is a small addition to the existing auth page.

---

## Files Changed

| File                                                             | Change type | Description                                                |
| ---------------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `supabase/migrations/20260331000001_add_report_access_token.sql` | New         | Add `access_token` + `access_token_expires_at` columns     |
| `app/api/reports/create-anonymous/route.ts`                      | Modified    | Generate token + expiry on report creation                 |
| `app/api/lemonsqueezy/create-checkout/route.ts`                  | Modified    | Use token in `successUrl` for anonymous checkouts          |
| `app/reports/[id]/view/page.tsx`                                 | Modified    | Token validation, skeleton state, `isTokenAccess` prop     |
| `app/reports/[id]/view/ReportReadyWatcher.tsx`                   | New         | Client poller — calls `router.refresh()` when report ready |
| `app/reports/[id]/view/TokenAccessBanner.tsx`                    | New         | Fixed bottom banner with copy link + expiry notice         |
| `app/auth/page.tsx`                                              | Modified    | Show expired-token banner when `reason=token_expired`      |

**Unchanged (explicitly):**

- `app/reports/[id]/success/page.tsx` — authenticated buyer success page untouched
- `app/reports/[id]/success/ReportReadyPoller.tsx` — left in place, harmless
- `app/api/reports/[id]/claim/route.ts` — left in place, harmless
- `canViewReport` utility — unchanged
- All report rendering components, charts, PDF buttons — unchanged
- Admin free report flow — unchanged

---

## Deployment Order

1. Run `payments.user_id` nullable migration in Supabase SQL editor (already written: `20260331000000_allow_anonymous_payments.sql`)
2. Run `access_token` migration in Supabase SQL editor
3. Deploy all code changes as a single PR
4. Test with a real anonymous purchase — confirm `[WH-0] Webhook POST received` in Vercel logs, confirm report renders within ~30 seconds

---

## Security Notes

- Token validates both UUID match AND expiry on every request — no short-circuit
- Token grants read access to one specific report ID only
- Authenticated session always wins — token check only runs when no session exists
- No token is generated for authenticated checkouts
