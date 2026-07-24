# Post-Payment Report-Delivery Messaging — Design

**Goal:** Update the two on-site post-purchase messaging surfaces (the checkout-success polling screen and the anonymous token-access banner on `/reports/[id]/view`) to reflect that a report-delivery email is now sent automatically (via the Zoho Campaigns automation shipped in `docs/superpowers/specs/2026-07-22-report-delivery-zoho-automation-design.md`), and hand off exact replacement copy for the LemonSqueezy dashboard's receipt screen, which is not code-driven. This is a copy-only change — no change to routing, component state, or the existing instant on-page account-creation flow.

**Context:** Previously, a buyer's only route back to their report after leaving the tab was the account-creation flow on `/reports/[id]/success`, an explicit "email me a sign-in link" button, or the 24-hour anonymous token link on `/view`. None of the on-site copy mentions that a dedicated report-delivery email (containing a direct signed link to the report) now goes out automatically the moment the PDF finishes generating. Separately, an already-implemented but only-partially-documented change (`docs/superpowers/plans/2026-07-23-remove-post-checkout-magic-link.md`) removed the webhook's _automatic_ magic-link send — confirmed in code: `resolveUserFromEmail()` in `app/api/lemonsqueezy/webhook/route.ts` no longer calls `signInWithOtp`. This makes the existing `TokenAccessBanner` copy ("We've already created an account for you... check that inbox for a link to sign in anytime") actively inaccurate today, since no such email is sent unless the buyer explicitly clicks "Email me a sign-in link instead." This design's banner rewrite corrects that stale claim as a direct side effect, not as separate scope.

**Tech Stack:** React 19 client components (no new dependencies, no new tests required — no existing test pins this copy).

---

## 1. `ReportReadyPoller.tsx` — polling screen

File: `app/reports/[id]/success/ReportReadyPoller.tsx`, the `pollerState === 'polling'` return block (currently lines 370–400).

Add one line under the existing "This takes about 10 seconds" text, future tense since the report is not yet complete and no email has been sent at this point:

```tsx
<h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
<p className="text-slate-600 mb-2">Fetching your vehicle&apos;s valuation data&hellip;</p>
<p className="text-sm text-slate-400">This takes about 10 seconds.</p>
<p className="text-sm text-slate-400 mt-1">
  We&apos;ll also email you a secure link to your report within 24 hours.
</p>
```

No other state in this component (`setup`, `magic-link-sent`, `timedOut`) changes — each already has its own clear next step and doesn't need the line repeated (confirmed with user).

## 2. `TokenAccessBanner.tsx` — footer banner on `/view`

File: `app/reports/[id]/view/TokenAccessBanner.tsx`, lines 43–70.

By the time this banner renders, the report has already fully loaded via token access, meaning `generateAndUploadPDF()` already ran and the Zoho report-delivery enrollment already fired (best-effort, same accepted-risk pattern as the rest of this banner's claims) — so this copy uses present-perfect tense, unlike the poller's future tense.

Replace the two branches:

```tsx
<span className="font-semibold">This link expires in 24 hours.</span>{' '}
{hasAccount && email ? (
  <>
    We&apos;ve also emailed a permanent link to this report to your inbox
    (<strong>{email}</strong>) — check there anytime, or{' '}
    <Link
      href={`/auth?redirect=/reports/${reportId}/view`}
      className="underline font-medium hover:text-amber-700"
    >
      sign in now
    </Link>{' '}
    using the account we created for you.
  </>
) : (
  <>
    We&apos;ve also emailed a permanent link to this report to your inbox —
    check there anytime. You can also{' '}
    <Link
      href={`/auth?redirect=/reports/${reportId}/view`}
      className="underline font-medium hover:text-amber-700"
    >
      sign in or create an account
    </Link>{' '}
    for full access.
  </>
)}{' '}
<span className="text-amber-700">Tip: export to PDF using the button above.</span>
```

This removes the now-inaccurate "check that inbox for a link to sign in anytime" claim (no automatic sign-in email is sent post-checkout anymore) and replaces it with the claim that's actually true today: the Zoho-driven report-delivery email.

## 3. LemonSqueezy dashboard receipt fields (manual, not code)

Not implemented in this change — `lib/lemonsqueezy/client.ts` has never set these fields (confirmed via `git log -p`), so they're store/product-level dashboard settings. Text to paste into Store settings → Checkout → Receipt:

- **Thank-you note:** "Your vehicle valuation report is now being generated. We'll email you a secure link to it within 24 hours."
- **Button text:** "Continue to Your Report"
- **Redirect link:** leave unchanged — the per-checkout `redirect_url` sent by `createCheckout()` already takes precedence for the actual destination.

This step is a manual user action, called out at the end of the implementation plan rather than as a code task.

## Accuracy note

The report-delivery email is actually sent synchronously the moment PDF generation finishes — normally seconds, not hours. "Within 24 hours" is a deliberate safety-buffer framing, consistent with the tone already used for the anonymous-link and magic-link expiry windows elsewhere in this same UI, not a claim about real latency.

## Testing

No existing test asserts any of this copy (verified via grep across `__tests__/`). No test changes needed; this is a pure JSX text swap in two already-tested components. Run `npm run type-check` after editing (JSX/text-only change, but confirms no accidental syntax break) — full `npm run test:ci` is not required to change but is cheap enough to run before opening the PR.

## Out of scope

- Any change to the instant on-page account-creation/magic-link flow, or to `setup`/`magic-link-sent`/`timedOut` states in `ReportReadyPoller`.
- The webhook or Zoho enrollment logic itself (`lib/services/pdf-generator.tsx`, `app/api/lemonsqueezy/webhook/route.ts`) — already shipped, unchanged here.
- Setting LemonSqueezy receipt fields via the API/code — user will apply the text above directly in the LemonSqueezy dashboard.
- Documenting/committing the already-implemented magic-link removal (`docs/superpowers/plans/2026-07-23-remove-post-checkout-magic-link.md` and its design doc remain untracked, pre-existing work not part of this change).
