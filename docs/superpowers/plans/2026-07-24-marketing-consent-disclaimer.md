# Marketing Consent Disclaimer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 inconsistent/vague email-marketing disclaimers on the site with one shared `MarketingConsentNotice` component, and bring the Privacy Policy's marketing section into present tense.

**Architecture:** One new presentational component (`components/MarketingConsentNotice.tsx`, no state, no hooks) rendered by the 4 existing lead-capture forms in place of their current inline `<p>` disclaimers. A `variant` prop (`'light' | 'dark'`) switches text color to match each call site's background; a `className` escape hatch lets each call site control spacing exactly as it does today. Separately, two stale future-tense sentences in `app/privacy/page.tsx` are edited to present tense.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Tailwind CSS, `next/link`, Jest + React Testing Library.

**Source spec:** `docs/superpowers/specs/2026-07-11-marketing-consent-disclaimer-design.md`

## Global Constraints

- Canonical copy (verbatim, do not paraphrase): "We'll send you related resources and occasional offers by email; you may unsubscribe at any time." followed by a "Privacy Policy" link to `/privacy`.
- `Privacy Policy` link renders via `next/link`'s `<Link href="/privacy">`, underlined, same tab (no `target="_blank"` — confirmed this is the existing site convention for footer/legal links in `app/reports/[id]/print/page.tsx`, `app/reports/[id]/view/page.tsx`, `app/reports/[id]/action-plan/page.tsx`, `app/faq/page.tsx`).
- `variant="light"` (default) → `text-slate-500`. `variant="dark"` → `text-white/55`.
- No new state, no new API calls, no analytics/tracking added to the component.
- No layout changes — the component must render in the same position each disclaimer occupies today.
- No changes to form submission logic, validation, or Zoho/PostHog tracking in any of the 4 forms.
- No cookie-consent or checkbox opt-in mechanism — copy-only change.
- This repo's current branch is `docs/post-payment-report-delivery-messaging`, not `main`. Before starting Task 1, sync with `main` and create a fresh feature branch (e.g. `feat/marketing-consent-disclaimer`) per this workspace's git workflow — never commit directly to `main`.

---

### Task 1: Create the `MarketingConsentNotice` component

**Files:**

- Create: `components/MarketingConsentNotice.tsx`
- Test: `__tests__/components/MarketingConsentNotice.test.tsx`

**Interfaces:**

- Produces: `MarketingConsentNotice({ variant?: 'light' | 'dark', className?: string })` — named export from `@/components/MarketingConsentNotice`. Renders a single `<p>` root element. Tasks 2–5 import and render `<MarketingConsentNotice />` in place of their existing inline disclaimer `<p>`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/MarketingConsentNotice.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'

describe('MarketingConsentNotice', () => {
  it('renders the consent copy with a link to the privacy policy', () => {
    render(<MarketingConsentNotice />)
    expect(screen.getByText(/unsubscribe at any time/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /privacy policy/i })
    expect(link).toHaveAttribute('href', '/privacy')
  })

  it('defaults to the light variant color', () => {
    const { container } = render(<MarketingConsentNotice />)
    expect(container.querySelector('p')).toHaveClass('text-slate-500')
  })

  it('applies the dark variant color when variant="dark"', () => {
    const { container } = render(<MarketingConsentNotice variant="dark" />)
    expect(container.querySelector('p')).toHaveClass('text-white/55')
  })

  it('merges an additional className onto the root element', () => {
    const { container } = render(<MarketingConsentNotice className="mt-4" />)
    expect(container.querySelector('p')).toHaveClass('mt-4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/MarketingConsentNotice.test.tsx`
Expected: FAIL with "Cannot find module '@/components/MarketingConsentNotice'"

- [ ] **Step 3: Write the component**

Create `components/MarketingConsentNotice.tsx`:

```tsx
import Link from 'next/link'

interface MarketingConsentNoticeProps {
  variant?: 'light' | 'dark'
  className?: string
}

export function MarketingConsentNotice({
  variant = 'light',
  className = '',
}: MarketingConsentNoticeProps) {
  const colorClass = variant === 'dark' ? 'text-white/55' : 'text-slate-500'

  return (
    <p className={`text-xs ${colorClass} ${className}`}>
      We&apos;ll send you related resources and occasional offers by email; you may unsubscribe at
      any time.{' '}
      <Link href="/privacy" className="underline hover:opacity-80">
        Privacy Policy
      </Link>
      .
    </p>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/MarketingConsentNotice.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/MarketingConsentNotice.tsx __tests__/components/MarketingConsentNotice.test.tsx
git commit -m "feat: add shared MarketingConsentNotice component"
```

---

### Task 2: Swap into `DisputeLetterForm.tsx`

**Files:**

- Modify: `components/DisputeLetterForm.tsx:1-4` (imports), `components/DisputeLetterForm.tsx:106-108` (disclaimer)

**Interfaces:**

- Consumes: `MarketingConsentNotice` from Task 1 (`@/components/MarketingConsentNotice`).

- [ ] **Step 1: Add the import**

In `components/DisputeLetterForm.tsx`, after the existing imports (line 5, `import { trackEvent } from '@/lib/analytics/events'`), add:

```tsx
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'
```

- [ ] **Step 2: Replace the inline disclaimer**

Replace lines 106-108:

```tsx
<p className="text-xs text-slate-500 text-center">
  No spam. We&apos;ll only use your email to send you relevant resources.
</p>
```

with:

```tsx
<MarketingConsentNotice className="text-center" />
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 4: Run the component's existing test suite**

Run: `npm test -- __tests__/components/DisputeLetterForm.test.tsx`
Expected: PASS (no assertions in this suite reference the old disclaimer copy, so no test edits are needed here)

- [ ] **Step 5: Commit**

```bash
git add components/DisputeLetterForm.tsx
git commit -m "feat: use shared MarketingConsentNotice in DisputeLetterForm"
```

---

### Task 3: Swap into `Hero.tsx`

**Files:**

- Modify: `components/Hero.tsx:1-18` (imports), `components/Hero.tsx:508-510` (disclaimer)
- Modify: `__tests__/components/Hero.test.tsx:55-58` (assertion)

**Interfaces:**

- Consumes: `MarketingConsentNotice` from Task 1.

- [ ] **Step 1: Update the existing test assertion first**

In `__tests__/components/Hero.test.tsx`, replace lines 55-58:

```tsx
it('renders permission text', () => {
  render(<Hero />)
  expect(screen.getByText(/agree to receive occasional emails/i)).toBeInTheDocument()
})
```

with:

```tsx
it('renders permission text', () => {
  render(<Hero />)
  expect(screen.getByText(/unsubscribe at any time/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/Hero.test.tsx -t "renders permission text"`
Expected: FAIL — "renders permission text" fails because `Hero.tsx` still renders the old copy.

- [ ] **Step 3: Add the import**

In `components/Hero.tsx`, after the existing import block (after line 18, `import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'`), add:

```tsx
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'
```

- [ ] **Step 4: Replace the inline disclaimer**

Replace lines 508-510:

```tsx
<p className="text-xs text-slate-500 mt-2 text-center">
  By submitting, you agree to receive occasional emails from TotalLossToolkit.com
</p>
```

with:

```tsx
<MarketingConsentNotice className="mt-2 text-center" />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/components/Hero.test.tsx`
Expected: PASS (all tests in this suite)

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add components/Hero.tsx __tests__/components/Hero.test.tsx
git commit -m "feat: use shared MarketingConsentNotice in Hero"
```

---

### Task 4: Swap into `ArticleReportBar.tsx`

**Files:**

- Modify: `components/ArticleReportBar.tsx:1-13` (imports), `components/ArticleReportBar.tsx:272-275` (disclaimer)

**Interfaces:**

- Consumes: `MarketingConsentNotice` from Task 1, with `variant="dark"`.

- [ ] **Step 1: Add the import**

In `components/ArticleReportBar.tsx`, after the existing import block (after line 13, `import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'`), add:

```tsx
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'
```

- [ ] **Step 2: Replace the inline disclaimer**

Replace lines 272-275:

```tsx
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/55">
            By submitting, you agree to receive occasional emails from TotalLossToolkit.com
          </p>
```

with:

```tsx
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MarketingConsentNotice variant="dark" />
```

(Leave the closing `<button>` and `</div>` on lines 276-283 untouched — only the `<p>` disclaimer is replaced.)

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 4: Run the component's existing test suite**

Run: `npm test -- __tests__/components/ArticleReportBar.test.tsx`
Expected: PASS (no assertions in this suite reference the old disclaimer copy, so no test edits are needed here)

- [ ] **Step 5: Commit**

```bash
git add components/ArticleReportBar.tsx
git commit -m "feat: use shared MarketingConsentNotice in ArticleReportBar"
```

---

### Task 5: Swap into `VehicleValuation.tsx`

**Files:**

- Modify: `components/VehicleValuation.tsx:1-12` (imports), `components/VehicleValuation.tsx:328-330` (disclaimer)
- Modify: `__tests__/components/VehicleValuation.test.tsx:144-147` (assertion)

**Interfaces:**

- Consumes: `MarketingConsentNotice` from Task 1.

- [ ] **Step 1: Update the existing test assertion first**

In `__tests__/components/VehicleValuation.test.tsx`, replace lines 144-147:

```tsx
it('renders permission text', () => {
  render(<VehicleValuation />)
  expect(screen.getByText(/agree to receive occasional emails/i)).toBeInTheDocument()
})
```

with:

```tsx
it('renders permission text', () => {
  render(<VehicleValuation />)
  expect(screen.getByText(/unsubscribe at any time/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/VehicleValuation.test.tsx -t "renders permission text"`
Expected: FAIL — `VehicleValuation.tsx` still renders the old copy.

- [ ] **Step 3: Add the import**

In `components/VehicleValuation.tsx`, after the existing import block (after line 12, `import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'`), add:

```tsx
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'
```

- [ ] **Step 4: Replace the inline disclaimer**

Replace lines 328-330:

```tsx
<p className="text-xs text-slate-500 mt-3 text-center">
  By submitting, you agree to receive occasional emails from TotalLossToolkit.com
</p>
```

with:

```tsx
<MarketingConsentNotice className="mt-3 text-center" />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/components/VehicleValuation.test.tsx`
Expected: PASS (all tests in this suite)

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add components/VehicleValuation.tsx __tests__/components/VehicleValuation.test.tsx
git commit -m "feat: use shared MarketingConsentNotice in VehicleValuation"
```

---

### Task 6: Present-tense the Privacy Policy's marketing section

**Files:**

- Modify: `app/privacy/page.tsx:229-238` (heading + bullet 1)
- Modify: `app/privacy/page.tsx:433` (opt-out bullet)

**Interfaces:**

- None — static copy only, no component interface changes.

- [ ] **Step 1: Update the section heading and first bullet**

Replace lines 229-238:

```tsx
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Future Marketing Communications (With Your Consent)
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    We may send promotional emails, newsletters, or special offers in the future
                  </li>
                  <li>
                    You will have the ability to opt-out of marketing communications at any time
                  </li>
```

with:

```tsx
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Marketing Communications (With Your Consent)
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    We send promotional emails, newsletters, and related updates about your
                    total loss claim and our services
                  </li>
                  <li>
                    You will have the ability to opt-out of marketing communications at any time
                  </li>
```

(Verify there is a third bullet immediately after — per the spec it already reads correctly and needs no edit; leave it untouched.)

- [ ] **Step 2: Update the stale opt-out reference**

Replace line 433:

```tsx
<li>You can opt-out of future marketing communications (when implemented)</li>
```

with:

```tsx
<li>You can opt-out of marketing communications at any time</li>
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 4: Grep to confirm no stale future-tense references remain**

Run: `grep -n "in the future\|when implemented" app/privacy/page.tsx`
Expected: no output (no matches)

- [ ] **Step 5: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "docs: present-tense the privacy policy marketing section"
```

---

### Task 7: Full-suite verification and manual visual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: PASS, no new failures introduced by Tasks 1–6 (pre-existing unrelated failures noted in `backlog.md` High Impact #10 are not in scope for this plan)

- [ ] **Step 2: Run the full type-check**

Run: `npm run type-check`
Expected: no errors

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`
Expected: starts on `localhost:3000` with no compile errors

- [ ] **Step 4: Manually verify all 4 call sites in a browser**

Visit and visually confirm the new disclaimer copy renders correctly, with a working `/privacy` link, in both variants:

- `http://localhost:3000/dispute-letter` — light variant, under the download button
- `http://localhost:3000/` — light variant, under the hero form's submit button
- Any KB article page with the report bar, e.g. `http://localhost:3000/knowledge-base/pennsylvania-total-loss-law` — dark variant, on the blue bar
- `http://localhost:3000/#valuation` (bottom-of-homepage `VehicleValuation` form) — light variant

- [ ] **Step 5: Verify the Privacy Policy page**

Visit `http://localhost:3000/privacy`, confirm the "Marketing Communications (With Your Consent)" section reads in present tense and the opt-out bullet no longer says "(when implemented)".

- [ ] **Step 6: Stop the dev server**

Stop the `npm run dev` process (Ctrl+C).
