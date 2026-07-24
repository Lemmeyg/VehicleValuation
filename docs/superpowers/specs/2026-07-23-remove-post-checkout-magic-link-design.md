# Remove Automatic Post-Checkout Magic Link — Design

**Goal:** Stop Supabase from automatically emailing a magic (sign-in) link to buyers after a successful LemonSqueezy payment. Keep every explicit, user-initiated magic-link path working exactly as it does today.

**Why now:** Two code paths currently fire `supabaseAdmin.auth.signInWithOtp()` without the buyer asking for it — once from the LemonSqueezy webhook immediately on payment, and once more from a silent fallback on the (now largely unused) post-checkout account-creation form. Neither send is required for buyers to see their report; both are superfluous side effects of code that predates the current anonymous-access design.

---

## 1. Current state (verified against code)

**The mainline anonymous-buyer flow does not use magic links at all.** Every anonymous report gets a unique `access_token` (+ 24-hour expiry) at creation (`app/api/reports/create-anonymous/route.ts:172-177`). Checkout's `successUrl` for anonymous buyers points straight to `${appUrl}/reports/${reportId}/view?token=${access_token}` (`app/api/lemonsqueezy/create-checkout/route.ts:74-83`) — confirmed by the approved `docs/superpowers/specs/2026-03-31-anonymous-token-access-design.md`. The buyer lands on `totallosstoolkit.com/reports/[id]/view?token=...`, which validates the token server-side and renders the report immediately (skeleton placeholders via `ReportReadyWatcher` while `marketcheck_valuation` populates, then the full report in place). No login, no email, no account required.

**Two automatic magic-link sends still happen anyway, in parallel to that flow:**

1. **Webhook** (`app/api/lemonsqueezy/webhook/route.ts`, `resolveUserFromEmail()`, lines 661–675) — for any anonymous purchase (no `userId` in checkout custom data), this function creates/finds a Supabase account for the buyer's email, then unconditionally calls `signInWithOtp()` to email them a magic link, regardless of the token-based page they're about to land on. Non-fatal if it fails; nothing downstream depends on it succeeding.
2. **Success-page fallback** (`app/reports/[id]/success/ReportReadyPoller.tsx:114-122`) — reachable only when a report has no `access_token` (a legacy/edge case; every current anonymous report gets one, per §1). If reached, its "Create account & view report" form always fails with "already registered" (the webhook already created the account in path 1), and the code silently calls `sendMagicLink()` again as a fallback — a second automatic send, with no explicit click from the buyer.

**Explicit, user-initiated magic-link paths (unaffected by this change):**

- The "Email me a sign-in link instead" button on that same fallback form (`ReportReadyPoller.tsx:343-350`) — an explicit click.
- The `/auth` login page's own "sign in with a magic link" option (`app/auth/page.tsx`).
- The `/api/auth/magic-link` route itself (`app/api/auth/magic-link/route.ts`) — the shared endpoint both explicit paths call.

## 2. Change

**2a. Webhook — delete the automatic send** (`app/api/lemonsqueezy/webhook/route.ts`, `resolveUserFromEmail()`)

Remove the `supabaseAdmin.auth.signInWithOtp(...)` call and its logging (lines 661–675). Everything else in the function is unchanged: it still creates/finds the Supabase account and returns `resolvedUserId`, which the caller uses to set `payments.user_id`. The `emailRedirectTo` URL construction and the `appUrl` parameter this function receives become unused once the call is removed — drop the now-dead parameter from `resolveUserFromEmail`'s signature and its one call site, unless `appUrl` is needed elsewhere in `handleOrderCreated` (verify at implementation time).

**2b. Success-page fallback — stop the silent auto-send** (`app/reports/[id]/success/ReportReadyPoller.tsx`, lines 114–122)

When account creation fails with "already registered," replace the automatic `await sendMagicLink()` call with an inline message directing the buyer to the still-present explicit option:

> "An account already exists for this email. Use 'Email me a sign-in link' below, or sign in if you already have a password."

No network call fires until the buyer clicks something themselves. The explicit "Email me a sign-in link instead" button, `/api/auth/magic-link`, and the `/auth` page's own magic-link flow are not touched.

## 3. Impact on the buyer-facing experience

**Normal anonymous purchase (has `access_token`, the current default for all new reports):** No visible change whatsoever. This flow never touched the magic-link code before or after — confirmed in §1. The buyer sees their report load immediately on the token-based `/view` page either way.

**Fallback case (report has no `access_token` — legacy rows only):** The buyer previously received an email automatically the moment payment succeeded, and a second one automatically if they tried "Create account" (since the account already existed). After this change, no email is sent unless they explicitly click "Email me a sign-in link instead." This is an intentional, expected behavior change for that narrow fallback path — it's the entire point of the request — not a regression, since the self-serve options remain fully functional.

**Authenticated buyers (logged in before checkout):** No change. This flow never touches `resolveUserFromEmail` or any magic-link code — `userId` is already present in the checkout custom data, so the webhook takes the authenticated branch instead.

## 4. Testing

- `__tests__/app/api/lemonsqueezy/webhook/route.test.ts` — remove/update the existing "magic link redirects to /reports/{id}/view not /reports/{id}" assertion (the code path it tests no longer exists); add a test asserting `signInWithOtp` is never called for an anonymous `order_created` event.
- `__tests__/app/reports/success/ReportReadyPoller.test.tsx` — add a test asserting that on "already registered," no fetch to `/api/auth/magic-link` fires automatically, and the new inline message renders; keep/verify existing coverage of the explicit "Email me a sign-in link instead" button still firing that request when clicked.
- Run `npm run type-check` and `npm run test:ci` before opening a PR.

## 5. Process

Feature branch → implement → `npm run test:ci` / `npm run type-check` → push → PR → verify on Vercel preview (exercise both the normal token-based anonymous flow and, if a way to simulate a missing `access_token` exists in a test report, the fallback messaging) → merge, per the project's standard branch/PR/Vercel-preview workflow.

## Out of scope

- The separate, unmerged Zoho Campaigns report-delivery automation (`docs/superpowers/specs/2026-07-22-report-delivery-zoho-automation-design.md`) that will email buyers a direct PDF download link once shipped — unrelated mechanism, not touched by this change.
- Redesigning the `/success` page or `ReportReadyPoller` fallback flow beyond the single messaging change in §2b — it already exists purely as a legacy safety net for reports without an `access_token`.
- Any change to `/api/auth/magic-link`, the `/auth` page, or the explicit "Email me a sign-in link instead" button — all remain exactly as they are today.
