# Analytics data quality: agent-traffic filtering + autocapture repair

**Date:** 2026-08-09
**Backlog items:** BL-4 (filter Claude/agent traffic), BL-7 (near-zero autocapture click data)
**Status:** Approved

## Problem

Two related PostHog data-quality gaps were flagged by the session-replay review on 2026-08-08:

1. **BL-4** — 4 sessions / 23 events over 4 days carry a `Claude/` or `Electron` user agent (AI browsing agents, not real visitors), polluting analytics.
2. **BL-7** — `$autocapture` fires 0–1 times per session across all 5 reviewed sessions, despite autocapture being enabled project-wide. This starves both this kind of manual analysis and PostHog's rage-click/dead-click detection.

## Root cause findings

**BL-4:** PostHog already computes a traffic classification from the user agent — `$virt_is_bot` (boolean) and `$virt_traffic_type` (`Regular` / `Bot` / `AI Agent` / `Automation` / ...). Querying real events confirmed the flagged Claude Desktop sessions come back with `$virt_traffic_type = 'AI Agent'` and `$virt_is_bot = true`, computed automatically — no manual UA regex needed.

**BL-7:** `app/providers/posthog-provider.tsx` configures autocapture with:
```js
autocapture: {
  dom_event_allowlist: ['click', 'change', 'submit'],
  url_allowlist: ['localhost', 'vehicle-valuation'],
  element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea'],
},
```
`url_allowlist` is a regex allowlist — pages only get autocapture if their URL contains one of those substrings. Production is `www.totallosstoolkit.com`, which matches neither. Querying 30 days of `$autocapture` events confirmed this: the overwhelming majority came from `*.vercel.app` preview-deployment URLs (subdomain contains "vehicle-valuation") plus one production KB article whose slug happens to contain the literal string "vehicle-valuation" (67 events). Nearly every other production page got zero. This is a stale leftover from the project's early working name, not a capacity/sampling issue.

Also found: PostHog's `capture_dead_clicks` project setting (rage/dead-click detection) is currently `false` — off, not just data-starved.

Also found, **out of scope for this work** (filed separately as BL-103): the `NEXT_PUBLIC_VERCEL_ENV === 'preview'` guard meant to stop PostHog from loading on Vercel preview deployments isn't effectively working — most `$autocapture` volume in the last 30 days came from preview URLs, meaning the SDK initializes there despite the guard.

## Design

### BL-4: PostHog project settings (no code change)

Add one condition to the project's `test_account_filters` (Project Settings → "Filter out internal and test users"), alongside the existing `$host` localhost filter. These filters apply literally as "keep this" conditions when the toggle is on (confirmed via PostHog docs — not an inverted/negated group), matching the existing entry's pattern:

```
key: $virt_is_bot
type: event
operator: is_not
value: ["true"]
```

Applied via the PostHog MCP (`project-settings-update`), verified by re-querying the previously-flagged Claude Desktop session with `filter_test_accounts` semantics and confirming it's excluded.

No git changes. `backlog.md` moves BL-4 to Delivered once verified.

### BL-7: website code changes (feature branch + PR)

All in the `Vehicle Comparison Site` repo, on a new branch off `main`:

1. **`app/providers/posthog-provider.tsx`** — remove the `url_allowlist` key from the `autocapture` config entirely (unset = capture on all URLs, per posthog-js default). `dom_event_allowlist` and `element_allowlist` continue to scope which DOM events/elements get captured.
2. **PostHog project setting** — set `capture_dead_clicks: true` via the MCP (same settings object BL-4 touches, different field). Not a code change.
3. **Pricing page interactive elements** — the real mobile layout lives in `components/pricing/MobilePricingView.tsx` (rendered below `md`), not inline in `app/pricing/page.tsx`; the desktop layout (`app/pricing/page.tsx`, inside its `hidden md:block` wrapper) is separate markup. A "Mobile expand toggle" button found inline in `page.tsx` turns out to be dead code — it sits inside the `hidden md:block` wrapper *and* carries its own `md:hidden` class, so it's unreachable at every viewport width; skipped rather than instrumented. Corrected: `MobilePricingView.tsx` already has a live 6-item FAQ accordion (`FAQ_ITEMS` / `openFaqIndex` state) that's completely untracked — this is the literal "FAQ" surface BL-7's description asks for, not something that needs building first (BL-32 remains about something else — reviewing/expanding the FAQ *content*, not adding the tracking). Adding, via the existing `trackButtonClick()` helper from `lib/analytics/events.ts` — no new tracking pattern:
   - FAQ accordion item toggle (`MobilePricingView.tsx`): `trackButtonClick('pricing_faq_toggled', { question: item.question, action: isOpen ? 'close' : 'open' })`
   - Guarantee "Full terms →" link, desktop (`page.tsx`) and mobile (`MobilePricingView.tsx`) versions, each: `trackButtonClick('guarantee_full_terms_clicked', { viewport: 'desktop' | 'mobile' })`
   - Mobile guarantee banner's "Purchase Now" scroll-to-premium-card button (`MobilePricingView.tsx`, mobile only): `trackButtonClick('guarantee_purchase_now_clicked')`

   The main "Get Basic/Premium Report" CTA is already tracked via `checkout_initiated` in `handleSelectPlan` — no change needed there.

   **Discovered during implementation:** `components/ExitIntentPopup.tsx` installs a `document`-level capture-phase `click` listener that calls `stopPropagation()` on nearly every `<a href>` click on this page (to intercept it and show the discount popup before navigating) — including these two guarantee links, since they're plain anchors. Per DOM event order, that stops a bubble-phase `onClick` from ever firing — real in production, not a test artifact. Resolved: the two "Full terms" links track on `onMouseDown` instead (guarded to the primary button, `e.button === 0`, matching `ExitIntentPopup.tsx`'s own guard), which fires before the interceptor's `click` handler runs. Accepted trade-off: this misses keyboard-only (Enter-key) activation of the link. `ExitIntentPopup.tsx` itself is untouched — changing its interception behavior would be a real product decision, not a tracking fix. The "Purchase Now" `<button>` is unaffected (the interceptor only walks up to `<a>` ancestors) and uses a plain `onClick`.

4. **`components/ExitIntentPopup.tsx`** — this component (the "don't leave" discount popup, related to open item BL-5) already fires `exit_intent_popup_shown` / `_dismissed` / `_converted` via `trackEvent`. Two gaps found while reviewing it, added to the same PR:
   - `exit_intent_popup_converted` doesn't record which discount code was applied — add `discount_code: DISCOUNT_CODE` to its properties.
   - Both the X close button and the "No thanks, I'll take what the insurance company offers" link call the same `handleDismiss`, so both fire an identical `exit_intent_popup_dismissed` with no way to tell them apart — add a `dismiss_method: 'close_button' | 'decline_link'` property, threaded through `handleDismiss(method)`.

### Testing

- Unit/existing test suite (`npm run test:ci`) must still pass — no behavior change to component logic beyond adding tracking calls and removing a config key.
- Manual verification: load the production Vercel preview for the branch, open browser dev tools network tab, confirm `$autocapture` events fire on click for elements outside "vehicle-valuation"-containing URLs, and confirm the two new `button_clicked` events fire with correct properties.
- Post-merge: re-check `$autocapture` volume in PostHog over the following few days to confirm it's no longer nearly zero on production hosts.

### Reading the new data: a caveat for future analysis

`guarantee_full_terms_clicked` records intent to visit `/guarantee`, not confirmed arrival — it fires on `mousedown`, so a press-and-drag-away still counts (accepted; this is an intent metric, not a completion metric). More importantly: `ExitIntentPopup.tsx`'s `showPopup()` early-returns once the popup has already been shown once in the session (`sessionStorage.exit_popup_shown`), but its click-interceptor still unconditionally calls `preventDefault()`/`stopPropagation()` first — so on a second-or-later "Full terms" click in the same session, the click is silently swallowed with no popup shown and no navigation happening at all. This is a **pre-existing bug in `ExitIntentPopup.tsx`, on `main` before this branch**, out of scope here per the constraint above; filed as a new backlog item. Practical effect: whoever analyzes `guarantee_full_terms_clicked` volume against `/guarantee` pageviews should expect a real, structural gap between the two — not evidence users are bouncing off the guarantee page itself.

Also note: `dismiss_method` (`exit_intent_popup_dismissed`) and `discount_code` (`exit_intent_popup_converted`) are new snake_case properties added alongside the event's existing camelCase `reportId`/`vin` properties — intentional, since renaming the existing keys would break historical PostHog insights built on them.

### Out of scope

- BL-103 (new): fix the non-working `NEXT_PUBLIC_VERCEL_ENV` preview guard so PostHog stops initializing on Vercel preview deployments. Filed to `backlog.md`, not implemented here.
- BL-32 (existing, open): reviewing/expanding the FAQ *content* (which questions are included) — separate from this work, which only adds click tracking to the FAQ accordion that already exists in `MobilePricingView.tsx`.
- New (filed as BL-104, discovered during this work): the `ExitIntentPopup.tsx` swallowed-click-after-first-show bug described above. Not fixed here — it's a product-behavior change to `ExitIntentPopup.tsx`'s interception logic, which this plan's Global Constraints explicitly kept out of scope.
