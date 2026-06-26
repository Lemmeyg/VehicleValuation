# Remove "$19" Pricing Hint from Homepage Form

**Date:** 2026-06-25

## Problem

The report submission form on the homepage displays "Takes 60 seconds • Instant results • Reports from $19" under the submit button when the `emailCaptureEnabled` flag is active. The "$19" pricing hint is no longer desired on the homepage.

## Change

**File:** `components/Hero.tsx`, line 471

**Remove:**

```tsx
{
  emailCaptureEnabled && ' • Reports from $19'
}
```

The `<p>` tag reads "Takes 60 seconds • Instant results" after the change — no other text, logic, or files are affected.

## Scope

- One line deleted in one file.
- No feature flag changes.
- No other homepage pricing references exist.
- `pricing/layout.tsx` SEO metadata and `pricing/page.tsx` price definitions are out of scope — they belong to the pricing page, not the homepage.

## Verification

- Visual check: homepage form no longer shows "$19" text.
- Test suite: `npm run test:ci` must pass (no tests reference this string).
- No type errors: `npm run type-check`.
