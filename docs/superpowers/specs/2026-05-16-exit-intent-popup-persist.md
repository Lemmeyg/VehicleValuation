# Spec: Exit-Intent Popup — Persist Until User Acts

**Date:** 2026-05-16  
**Status:** Approved

---

## Problem

The exit-intent popup on the pricing page appears when a user clicks a non-CTA link, but the destination URL loads within a few seconds regardless, preventing the user from reading or acting on the offer.

**Root cause:** The click listener is registered in the default bubbling phase. React/Next.js App Router attaches its own synthetic event handlers at the React root container, which fire before the event bubbles to `document`. By the time `e.preventDefault()` is called in `handleClick`, Next.js has already initiated the navigation.

---

## Solution

Two changes to `components/ExitIntentPopup.tsx` only.

### 1. Switch click listener to capture phase

```ts
// Before
document.addEventListener('click', handleClick)
document.removeEventListener('click', handleClick)

// After
document.addEventListener('click', handleClick, { capture: true })
document.removeEventListener('click', handleClick, { capture: true })
```

Capture phase fires top-down — `document` receives the event before any React handler, so `e.preventDefault()` blocks navigation before Next.js can act on it.

### 2. Make backdrop inert

Remove `onClick={handleDismiss}` from the outer backdrop `<div>` (the `fixed inset-0` overlay).

The only ways to close the popup become:

- **X button** — dismisses and navigates to the pending URL (or `router.back()` for back-button)
- **"Get My Report — $19" CTA** — converts and closes, no navigation

The card's existing `e.stopPropagation()` is unchanged.

---

## Files Affected

| File                             | Change                                             |
| -------------------------------- | -------------------------------------------------- |
| `components/ExitIntentPopup.tsx` | Capture-phase listener + remove backdrop `onClick` |

No changes to `app/pricing/page.tsx`, props, analytics events, or copy.

---

## Out of Scope

- Popup copy or styling changes
- Adding a "No thanks" explicit reject button
- Any changes to session gating logic
