# Autocapture Repair + Pricing/Exit-Intent Click Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix BL-7 (near-zero PostHog autocapture data) by removing the stale URL allowlist that's silently disabling autocapture on production, and add explicit click tracking to the pricing page's FAQ/trust elements and the related exit-intent discount popup.

**Architecture:** Four independent, self-contained changes: (1) delete one config key from the PostHog provider, (2)-(3) add `trackButtonClick()` calls to existing interactive elements on the pricing page and its mobile view, (4) enrich two existing `trackEvent()` calls in the exit-intent popup with new properties. No new components, no new tracking helpers — every change reuses `trackButtonClick()` / `trackEvent()` already exported from `lib/analytics/events.ts`.

**Tech Stack:** Next.js 15 App Router (client components), Jest + `@testing-library/react`, `posthog-js`.

## Global Constraints

- BL-4 and the `capture_dead_clicks` PostHog project setting are already done (applied directly via the PostHog MCP on 2026-08-09/10, not part of this plan) — do not re-touch PostHog project settings as part of this plan.
- Design spec: `docs/superpowers/specs/2026-08-09-analytics-agent-traffic-and-autocapture-design.md`.
- Do not re-add a `url_allowlist` to the autocapture config for any reason — that's the bug being fixed. If a future need arises to scope autocapture to specific pages, that's a new design conversation, not a quick fix here.
- Do not touch the pricing-page "Mobile expand toggle" button in `app/pricing/page.tsx` (~line 782) — it is unreachable dead code (nested inside a `hidden md:block` wrapper with its own `md:hidden` class) and out of scope for this plan.
- `DISCOUNT_CODE` in `components/ExitIntentPopup.tsx` is intentionally hardcoded (`'STAY15'`) per the comment above it — do not change it to read from an env var.

---

### Task 1: Remove the stale `url_allowlist` from autocapture config

**Files:**

- Modify: `app/providers/posthog-provider.tsx:26-31`
- Test: `__tests__/app/providers/posthog-provider.test.tsx`

**Interfaces:**

- Consumes: nothing from other tasks (fully independent)
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to the end of `__tests__/app/providers/posthog-provider.test.tsx` (after the existing `describe('PostHogProvider — Vercel preview filter', ...)` block, same file, same mocks already at the top):

```tsx
describe('PostHogProvider — autocapture config', () => {
  it('does not restrict autocapture to a url_allowlist, so it runs on every production URL', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'

    render(<PostHogProvider>child</PostHogProvider>)

    const [, options] = mockPosthog.init.mock.calls[0] as [
      string,
      { autocapture: Record<string, unknown> },
    ]
    expect(options.autocapture).not.toHaveProperty('url_allowlist')
    expect(options.autocapture.dom_event_allowlist).toEqual(['click', 'change', 'submit'])
    expect(options.autocapture.element_allowlist).toEqual([
      'a',
      'button',
      'form',
      'input',
      'select',
      'textarea',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/app/providers/posthog-provider.test.tsx`
Expected: FAIL on `expect(options.autocapture).not.toHaveProperty('url_allowlist')` — the key is currently present with value `['localhost', 'vehicle-valuation']`.

- [ ] **Step 3: Remove the config key**

In `app/providers/posthog-provider.tsx`, change:

```tsx
          autocapture: {
            // Automatically capture click events on buttons, links, and forms
            dom_event_allowlist: ['click', 'change', 'submit'],
            url_allowlist: ['localhost', 'vehicle-valuation'], // Adjust based on your domain
            element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea'],
          },
```

to:

```tsx
          autocapture: {
            // Automatically capture click events on buttons, links, and forms.
            // No url_allowlist: it previously restricted capture to URLs containing
            // "localhost" or "vehicle-valuation" (the project's early working name),
            // which silently disabled autocapture on production (totallosstoolkit.com)
            // after the domain changed. Unset = capture on every URL, per posthog-js
            // default; dom_event_allowlist/element_allowlist below still scope what
            // gets captured.
            dom_event_allowlist: ['click', 'change', 'submit'],
            element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea'],
          },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/app/providers/posthog-provider.test.tsx`
Expected: All tests in the file PASS (both the pre-existing 3 and the new one).

- [ ] **Step 5: Commit**

```bash
git add app/providers/posthog-provider.tsx __tests__/app/providers/posthog-provider.test.tsx
git commit -m "fix: remove stale url_allowlist disabling autocapture on production"
```

---

### Task 2: Track FAQ accordion opens/closes on the mobile pricing view

**Files:**

- Modify: `components/pricing/MobilePricingView.tsx:6,246-251` (import + FAQ button `onClick`)
- Test: `__tests__/components/pricing/MobilePricingView.test.tsx`

**Interfaces:**

- Consumes: `trackButtonClick(buttonName: string, properties?: Record<string, unknown>)` from `lib/analytics/events.ts` (existing, already used elsewhere e.g. `app/pricing/page.tsx:410`)
- Produces: the `trackButtonClick` import in `components/pricing/MobilePricingView.tsx` and the `trackButtonClick: jest.fn()` entry in `__tests__/components/pricing/MobilePricingView.test.tsx`'s module mock — **Task 3 depends on both** (it adds more `trackButtonClick` calls to the same component and more assertions to the same test file's already-updated mock). Run Task 2 before Task 3; do not parallelize them.

- [ ] **Step 1: Write the failing test**

In `__tests__/components/pricing/MobilePricingView.test.tsx`, update the top-level mock (currently only mocks `trackEvent`) to also mock `trackButtonClick`:

```tsx
jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
  trackButtonClick: jest.fn(),
}))
```

Add the import and a new test at the end of the `describe('MobilePricingView', ...)` block:

```tsx
import { trackEvent, trackButtonClick } from '@/lib/analytics/events'
```

```tsx
  it('tracks pricing_faq_toggled with the question and open/close action', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    // The first FAQ item starts open (openFaqIndex defaults to 0) — clicking closes it.
    fireEvent.click(
      screen.getByRole('button', { name: /how do you find my vehicle information\?/i })
    )
    expect(trackButtonClick).toHaveBeenCalledWith('pricing_faq_toggled', {
      question: 'How do you find my vehicle information?',
      action: 'close',
    })

    // The second item starts closed — clicking opens it.
    fireEvent.click(screen.getByRole('button', { name: /is there a money-back guarantee\?/i }))
    expect(trackButtonClick).toHaveBeenCalledWith('pricing_faq_toggled', {
      question: 'Is there a money-back guarantee?',
      action: 'open',
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/pricing/MobilePricingView.test.tsx`
Expected: FAIL — `trackButtonClick` is not called at all yet (also verify the file doesn't error on the import; `trackButtonClick` is now a valid mocked export as of the mock change above).

- [ ] **Step 3: Add the tracking call**

In `components/pricing/MobilePricingView.tsx`, change the import on line 15:

```tsx
import { trackEvent } from '@/lib/analytics/events'
```

to:

```tsx
import { trackEvent, trackButtonClick } from '@/lib/analytics/events'
```

Then change the FAQ toggle button's `onClick` (currently `onClick={() => setOpenFaqIndex(isOpen ? null : index)}`, around line 248) to:

```tsx
                <button
                  type="button"
                  onClick={() => {
                    trackButtonClick('pricing_faq_toggled', {
                      question: item.question,
                      action: isOpen ? 'close' : 'open',
                    })
                    setOpenFaqIndex(isOpen ? null : index)
                  }}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-slate-50"
                >
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/pricing/MobilePricingView.test.tsx`
Expected: All tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add components/pricing/MobilePricingView.tsx __tests__/components/pricing/MobilePricingView.test.tsx
git commit -m "feat: track FAQ accordion open/close on mobile pricing view"
```

---

### Task 3: Track the guarantee "Full terms" link and mobile "Purchase Now" button

**Files:**

- Modify: `app/pricing/page.tsx:19,848-853` (import already present — add usage)
- Modify: `components/pricing/MobilePricingView.tsx:281-295` (link + button `onClick`)
- Test: `__tests__/app/pricing/page.test.tsx`
- Test: `__tests__/components/pricing/MobilePricingView.test.tsx`

**Interfaces:**

- Consumes: `trackButtonClick` from `lib/analytics/events.ts` (already imported in `page.tsx`) and, in `MobilePricingView.tsx` / its test file, the import and mock entry Task 2 adds — **this task must run after Task 2**, not in parallel with it, since both touch the same production file and the same test file's module mock. If for some reason Task 2 hasn't landed yet, add its Step 1 mock update and Step 3 import change first.
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Write the failing tests**

In `__tests__/app/pricing/page.test.tsx`, add a new `describe` block (the file already mocks `trackButtonClick` in its top-level `jest.mock('@/lib/analytics/events', ...)` — no mock changes needed here). This test reuses the same report-hydration setup pattern as the existing `'PricingPage — desktop/mobile split'` describe block (see that block's `beforeEach` for the `setPendingReport` + render + `waitFor` pattern):

```tsx
describe('PricingPage — guarantee link tracking', () => {
  beforeEach(() => {
    // Same jest.restoreAllMocks() guard as the "desktop/mobile split" block above —
    // undoes any leaked useSearchParams spyOn override from an earlier-run block so
    // this block always gets the default `() => new URLSearchParams()` mock.
    jest.restoreAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('tracks guarantee_full_terms_link with viewport: desktop when the desktop link is clicked', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)

    // Both the desktop (page.tsx) and mobile (MobilePricingView) trees render
    // simultaneously in jsdom (CSS hiding isn't enforced) — the desktop one is first.
    const links = await screen.findAllByText(/full terms/i)
    fireEvent.click(links[0])

    expect(trackButtonClick).toHaveBeenCalledWith('guarantee_full_terms_link', {
      viewport: 'desktop',
    })
  })

  it('tracks guarantee_full_terms_link with viewport: mobile when the mobile link is clicked', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)

    const links = await screen.findAllByText(/full terms/i)
    fireEvent.click(links[1])

    expect(trackButtonClick).toHaveBeenCalledWith('guarantee_full_terms_link', {
      viewport: 'mobile',
    })
  })
})
```

Change the existing import at the top of the same file (line 4) from:

```tsx
import { trackEvent } from '@/lib/analytics/events'
```

to:

```tsx
import { trackEvent, trackButtonClick } from '@/lib/analytics/events'
```

In `__tests__/components/pricing/MobilePricingView.test.tsx`, add one more test to the existing `describe('MobilePricingView', ...)` block:

```tsx
  it('tracks guarantee_banner_purchase_now when "Purchase Now" is clicked', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /purchase now/i }))
    expect(trackButtonClick).toHaveBeenCalledWith('guarantee_banner_purchase_now')
  })

  it('tracks guarantee_full_terms_link with viewport: mobile when its own "Full terms" link is clicked', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    fireEvent.click(screen.getByText(/full terms/i))
    expect(trackButtonClick).toHaveBeenCalledWith('guarantee_full_terms_link', {
      viewport: 'mobile',
    })
  })
```

(This duplicates coverage of the mobile link at the unit level in addition to the integration-level test in `page.test.tsx` above — keep both; they test the same behavior from different entry points and both are cheap.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/app/pricing/page.test.tsx __tests__/components/pricing/MobilePricingView.test.tsx`
Expected: FAIL — `trackButtonClick` is never called for these interactions yet.

- [ ] **Step 3: Add the tracking calls**

In `app/pricing/page.tsx`, change the desktop guarantee link (around line 848):

```tsx
                <a
                  href="/guarantee"
                  className="flex-shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors"
                >
                  Full terms →
                </a>
```

to:

```tsx
                <a
                  href="/guarantee"
                  onClick={() => trackButtonClick('guarantee_full_terms_link', { viewport: 'desktop' })}
                  className="flex-shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors"
                >
                  Full terms →
                </a>
```

In `components/pricing/MobilePricingView.tsx`, change the mobile guarantee banner (around lines 281-295):

```tsx
          <a
            href="/guarantee"
            className="text-sm font-semibold text-white underline underline-offset-2"
          >
            Full terms →
          </a>
          <button
            type="button"
            onClick={() =>
              premiumCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            className="w-full rounded-xl bg-white px-6 py-3.5 font-bold text-primary-600 shadow-lg transition-transform active:scale-95"
          >
            Purchase Now
          </button>
```

to:

```tsx
          <a
            href="/guarantee"
            onClick={() => trackButtonClick('guarantee_full_terms_link', { viewport: 'mobile' })}
            className="text-sm font-semibold text-white underline underline-offset-2"
          >
            Full terms →
          </a>
          <button
            type="button"
            onClick={() => {
              trackButtonClick('guarantee_banner_purchase_now')
              premiumCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            className="w-full rounded-xl bg-white px-6 py-3.5 font-bold text-primary-600 shadow-lg transition-transform active:scale-95"
          >
            Purchase Now
          </button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/app/pricing/page.test.tsx __tests__/components/pricing/MobilePricingView.test.tsx`
Expected: All tests in both files PASS.

- [ ] **Step 5: Commit**

```bash
git add app/pricing/page.tsx components/pricing/MobilePricingView.tsx __tests__/app/pricing/page.test.tsx __tests__/components/pricing/MobilePricingView.test.tsx
git commit -m "feat: track guarantee 'Full terms' link and mobile 'Purchase Now' button"
```

---

### Task 4: Enrich exit-intent popup tracking with discount code and dismiss method

**Files:**

- Modify: `components/ExitIntentPopup.tsx:151-165,179,217`
- Test: `__tests__/components/ExitIntentPopup.test.tsx`

**Interfaces:**

- Consumes: nothing from other tasks (fully independent)
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Write the failing tests**

In `__tests__/components/ExitIntentPopup.test.tsx`, add two tests. Add the first inside the existing `describe('ExitIntentPopup — dismiss behaviour', ...)` block:

```tsx
  it('tracks exit_intent_popup_dismissed with dismiss_method: close_button for the X button', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(trackEvent).toHaveBeenCalledWith('exit_intent_popup_dismissed', {
      reportId: 'r1',
      vin: '1HGCM82633A123456',
      dismiss_method: 'close_button',
    })
  })

  it('tracks exit_intent_popup_dismissed with dismiss_method: decline_link for the "No thanks" link', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    fireEvent.click(screen.getByText(/no thanks, i'll take what the insurance company offers/i))

    expect(trackEvent).toHaveBeenCalledWith('exit_intent_popup_dismissed', {
      reportId: 'r1',
      vin: '1HGCM82633A123456',
      dismiss_method: 'decline_link',
    })
  })
```

Add the second inside the existing `describe('ExitIntentPopup — CTA action', ...)` block:

```tsx
  it('tracks exit_intent_popup_converted with the discount code', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    fireEvent.click(screen.getByRole('button', { name: /get my report/i }))

    expect(trackEvent).toHaveBeenCalledWith('exit_intent_popup_converted', {
      reportId: 'r1',
      vin: '1HGCM82633A123456',
      discount_code: 'STAY15',
    })
  })
```

Add the import at the top of the file (the existing `jest.mock('@/lib/analytics/events', ...)` already mocks `trackEvent` as `jest.fn()` — just import the mocked function to assert on it):

```tsx
import { trackEvent } from '@/lib/analytics/events'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/components/ExitIntentPopup.test.tsx`
Expected: FAIL — the three new assertions fail because `dismiss_method` and `discount_code` aren't in the tracked properties yet (the other, pre-existing tests in the file continue to pass).

- [ ] **Step 3: Thread the new properties through**

In `components/ExitIntentPopup.tsx`, change `handleDismiss` and `handleCTA` (lines 151-165):

```tsx
  const handleDismiss = () => {
    setVisible(false)
    trackEvent('exit_intent_popup_dismissed', { reportId, vin })
    if (isBackButtonRef.current) {
      router.back()
    } else if (pendingHrefRef.current) {
      router.push(pendingHrefRef.current)
    }
  }

  const handleCTA = () => {
    trackEvent('exit_intent_popup_converted', { reportId, vin })
    onSelectPlan(DISCOUNT_CODE)
    setVisible(false)
  }
```

to:

```tsx
  const handleDismiss = (method: 'close_button' | 'decline_link') => {
    setVisible(false)
    trackEvent('exit_intent_popup_dismissed', { reportId, vin, dismiss_method: method })
    if (isBackButtonRef.current) {
      router.back()
    } else if (pendingHrefRef.current) {
      router.push(pendingHrefRef.current)
    }
  }

  const handleCTA = () => {
    trackEvent('exit_intent_popup_converted', { reportId, vin, discount_code: DISCOUNT_CODE })
    onSelectPlan(DISCOUNT_CODE)
    setVisible(false)
  }
```

Then update the two button call sites (lines 179 and 217) — the X close button:

```tsx
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
```

to:

```tsx
        <button
          onClick={() => handleDismiss('close_button')}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
```

and the "No thanks" link:

```tsx
          <button
            onClick={handleDismiss}
            className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
          >
            No thanks, I&apos;ll take what the insurance company offers
          </button>
```

to:

```tsx
          <button
            onClick={() => handleDismiss('decline_link')}
            className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
          >
            No thanks, I&apos;ll take what the insurance company offers
          </button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/ExitIntentPopup.test.tsx`
Expected: All tests in the file PASS (the 3 new ones plus every pre-existing test — none of the existing assertions check exact `trackEvent` call args, so none break from the added properties).

- [ ] **Step 5: Commit**

```bash
git add components/ExitIntentPopup.tsx __tests__/components/ExitIntentPopup.test.tsx
git commit -m "feat: track discount code on exit-intent conversion and dismiss method on decline"
```

---

### Task 5: Full regression check and PR

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: All tests pass, including the 4 new/updated suites from Tasks 1-4.

- [ ] **Step 2: Manual smoke check**

Start the dev server (`npm run dev`), open the pricing page for a real or test report at both a desktop width and a mobile width (browser dev tools device toolbar), and with the browser's network/PostHog debug console open:

1. Desktop width: click the "Full terms →" guarantee link — confirm a `button_clicked` event fires with `button: 'guarantee_full_terms_link', viewport: 'desktop'`.
2. Mobile width: open/close a couple of FAQ accordion items — confirm `button_clicked` fires each time with `button: 'pricing_faq_toggled'` and the correct `question`/`action`.
3. Mobile width: click "Full terms →" and "Purchase Now" in the mobile guarantee banner — confirm both fire (`guarantee_full_terms_link` with `viewport: 'mobile'`, and `guarantee_banner_purchase_now`), and that "Purchase Now" still scrolls to the Premium card.
4. Trigger the exit-intent popup (e.g. click an outbound link), dismiss it via the X button — confirm `exit_intent_popup_dismissed` fires with `dismiss_method: 'close_button'`. Reload, trigger it again, dismiss via "No thanks" — confirm `dismiss_method: 'decline_link'`. Reload, trigger it again, click "Get My Report — $15" — confirm `exit_intent_popup_converted` fires with `discount_code: 'STAY15'`.
5. Click any other button/link on the page not covered above — confirm a generic `$autocapture` event now fires (this is Task 1's fix; previously nothing fired here in production).

- [ ] **Step 3: Push branch and open PR**

Follow the standard workflow in the workspace `CLAUDE.md` (push branch, open PR, verify Vercel Preview before merging — do not merge to `main` without explicit confirmation). Reference BL-7 and the design spec (`docs/superpowers/specs/2026-08-09-analytics-agent-traffic-and-autocapture-design.md`) in the PR description.

- [ ] **Step 4: Post-merge follow-up (not part of this branch)**

After the PR merges and deploys, re-check `$autocapture` volume in PostHog over the following few days to confirm it's no longer near-zero on production hosts (per the design spec's testing section), then update BL-7 in `backlog.md` (workspace repo) from "in progress" to Delivered.
