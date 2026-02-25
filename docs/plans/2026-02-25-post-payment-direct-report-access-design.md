# Design: Post-Payment Direct Report Access

**Date:** 2026-02-25
**Status:** Approved

## Problem

After a successful LemonSqueezy payment, anonymous buyers land on `/reports/{id}/success` and see a static "Check your email" message instead of their report. Three compounding issues:

1. `/reports/{id}/view` requires authentication — anonymous buyers are redirected to login
2. The webhook that populates report data (MarketCheck fetch) is async — takes 3–10 seconds after payment
3. The magic link email URL in the webhook uses `localhost:3000` when `NEXT_PUBLIC_APP_URL` is not set in Vercel

**Goal:** Pay → immediately see the populated vehicle valuation report.

## Approach: UUID-Public Report Access + Polling

Reports are identified by a UUID (36 chars, cryptographically random). Anyone with the UUID can view a **paid** report — the same model used by Notion, Calendly, and most SaaS share links. The UUID is the access credential.

The magic link email is retained as a convenience ("save to your account") rather than the only access path.

## Components

### 1. Middleware (`proxy.ts`)

Add `/reports/*/view` to the list of routes that bypass the auth wall, alongside the existing success page exception.

```typescript
const isReportViewPage = /^\/reports\/[^/]+\/view(\/)?$/.test(pathname)
```

The view page handles its own access gate (paid check). The middleware no longer needs to know about it.

### 2. Report View Page (`/app/reports/[id]/view/page.tsx`)

- Remove the hard `redirect('/login')` for unauthenticated users
- Fetch report via `supabaseAdmin` by ID only (no `user_id` filter — bypasses RLS)
- **Paid gate:** if `price_paid === 0` or null → redirect to `/reports/{id}` (the purchase page)
- Show full report to any visitor who has the UUID, authenticated or not
- Anonymous visitors: show a subtle "Save this report to your account" banner with a sign-up / magic link prompt

### 3. Status API Endpoint (new: `/app/api/reports/[id]/status/route.ts`)

Lightweight GET endpoint, no auth required. Used by the success page polling loop.

**Response:**

```json
{ "ready": false }
{ "ready": true, "pricePaid": 2900 }
```

`ready = price_paid > 0 AND marketcheck_valuation IS NOT NULL`

Uses `supabaseAdmin` (no user session needed). Exposes no sensitive data — just a readiness boolean.

### 4. Success Page (`/app/reports/[id]/success/page.tsx`)

The anonymous branch (previously static "check your email") becomes a client-side polling component:

1. Shows: _"Fetching your vehicle's market data… This takes about 10 seconds."_
2. Polls `/api/reports/{id}/status` every 2 seconds, up to 30 attempts (60 seconds)
3. On `ready: true` → `router.push('/reports/{id}/view')`
4. On timeout → fallback message: "Taking longer than expected. Check your email for a link, or [refresh to try again]."

Authenticated users are unaffected (they skip the polling branch entirely).

### 5. Webhook (`/app/api/lemonsqueezy/webhook/route.ts`)

Two fixes:

**Fix 1 — `appUrl` resolution.** Apply the same `x-forwarded-host` pattern already used in `create-checkout`. Pass `appUrl` from the route handler down into `resolveUserFromEmail(email, reportId, appUrl)`.

```typescript
const forwardedHost = request.headers.get('x-forwarded-host')
const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin)
```

**Fix 2 — Magic link destination.** Change `emailRedirectTo` from `/reports/${reportId}` to `/reports/${reportId}/view` so the email link takes users directly to the populated report page.

## Data Flow

```
User pays via LemonSqueezy
  → LemonSqueezy redirects to /reports/{id}/success
  → Success page renders (webhook not yet complete)
  → Client polls /api/reports/{id}/status every 2s
  → Meanwhile: webhook fires async
      → MarketCheck API call (3–10s)
      → Update report: price_paid, marketcheck_valuation, user_id
      → Send magic link email to {email}/reports/{id}/view (fixed URL)
  → Poll detects ready: true
  → Client redirects to /reports/{id}/view
  → View page: supabaseAdmin fetches by ID, price_paid > 0 ✓ → show report
```

## Security Model

- UUID (36-char v4) provides ~122 bits of entropy — brute-force infeasible
- Paid gate: report only shown if `price_paid > 0` — unpaid reports remain inaccessible
- Authenticated users continue to work as before (no regression)
- No sensitive PII is exposed by the status endpoint

## Files Changed

| File                                    | Change                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `proxy.ts`                              | Add `isReportViewPage` middleware exception                             |
| `app/reports/[id]/view/page.tsx`        | Remove auth redirect; use supabaseAdmin; add paid gate; add anon banner |
| `app/reports/[id]/success/page.tsx`     | Replace anon static message with polling client component               |
| `app/api/reports/[id]/status/route.ts`  | **New** — readiness check endpoint                                      |
| `app/api/lemonsqueezy/webhook/route.ts` | Fix appUrl (x-forwarded-host); fix magic link path to /view             |
