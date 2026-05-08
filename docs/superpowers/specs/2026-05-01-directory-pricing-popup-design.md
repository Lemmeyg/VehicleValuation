# Design Spec: Directory Auth Removal + Pricing Popup Updates

**Date:** 2026-05-01  
**Status:** Approved

---

## Overview

Three focused UI changes:

1. Remove the login requirement from the directory "Request a Service" form
2. Change the pricing page "don't go" popup trigger from mouse-leave to link/navigation click interception
3. Update the popup copy with higher-converting verbiage

---

## Change 1: Remove Login Gate from Directory ContactUsDialog

### Current Behaviour

`components/directory/ContactUsDialog.tsx` — `handleOpen()` checks `isAuthenticated`. If false, redirects to `/login?redirect=/directory`. The form never opens for unauthenticated users. Name and email fields are read-only, pre-populated from the user session.

### New Behaviour

- Remove the `if (!isAuthenticated)` redirect from `handleOpen()` — the dialog opens for all users
- Name and email fields become standard editable inputs (remove `readOnly`)
- If the user is authenticated, still pre-populate name/email from props for convenience
- If unauthenticated, fields start empty; user fills them in manually
- Client-side validation: name and email required before submit
- No API changes — `/api/suppliers/service-request` already accepts `contactName` and `contactEmail` in the request body

### Component Interface

The component currently receives `isAuthenticated`, `userName`, and `userEmail` as props. These remain — `isAuthenticated` is no longer used for gating but can be dropped from the interface in a follow-up cleanup. For this change, simply stop acting on it.

---

## Change 2: Pricing Page Popup — Trigger Replacement

### Current State

`ExitIntentPopup` component exists in the unmerged `feat/exit-intent-popup` branch. It triggers on `mouseleave` when the cursor exits the top of the browser window. It is not yet on `main`.

### New Trigger: Link/Navigation Click Interception

Cherry-pick `components/ExitIntentPopup.tsx` from `feat/exit-intent-popup` into the new feature branch, then replace the trigger logic entirely.

**Click interception logic:**

```
document click listener (attached on mount, removed on unmount)
  → walk up DOM from e.target to find nearest <a> tag or nav button
  → if found AND element is not the buy/CTA button:
      e.preventDefault()
      store destination href
      show popup (if not already shown this session)
```

**Back button interception:**

```
on mount: history.pushState(null, '', window.location.href)  // add state to intercept
window popstate listener:
  → if popup not yet shown this session:
      history.pushState(null, '', window.location.href)  // re-push to stay on page
      show popup
```

**After popup appears:**

- User clicks **"Get My Report — $19"** → calls `onSelectPlan(DISCOUNT_CODE)` → proceeds to checkout
- User clicks **X or backdrop** → navigate to stored destination (`router.push(href)` or `router.back()` for back-button case)

**Session gating:** `sessionStorage.getItem('exit_popup_shown')` — show once per session. Set the flag immediately on show, not on dismiss.

### What Does NOT Trigger the Popup

- The "Get My Report" / "Get Basic" / "Get Premium" buy CTA buttons (identified by a `data-buy-cta` attribute added to each)
- Clicks within the popup itself
- Clicks on non-navigating elements (FAQ accordions, testimonials, report preview toggle)

### Props (unchanged from feature branch)

```ts
interface ExitIntentPopupProps {
  vin: string
  reportId: string
  onSelectPlan: (discountCode: string) => void
}
```

The pricing page already has all three values available.

---

## Change 3: Popup Copy Update

Replace the existing copy in `ExitIntentPopup.tsx`:

| Element    | Before                                 | After                                                                               |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| Headline   | "Wait — get your report for $19 today" | "Before you go — your insurance company doesn't want you to have this."             |
| Subtext    | "One-time offer. This session only."   | "The average settlement gap is $2,800. Don't leave without the data to fight back." |
| CTA button | "Get My Report — $19"                  | "Get My Report — $19" _(unchanged)_                                                 |

---

## Files Affected

| File                                       | Change                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `components/directory/ContactUsDialog.tsx` | Remove auth gate; make name/email editable                                                         |
| `components/ExitIntentPopup.tsx`           | New file on main (cherry-picked + trigger replaced + copy updated)                                 |
| `app/pricing/page.tsx`                     | Mount `ExitIntentPopup`; add `data-buy-cta` to buy buttons; pass `vin`, `reportId`, `onSelectPlan` |

---

## Out of Scope

- Restyling the popup or form
- Changes to the `/api/suppliers/service-request` endpoint
- Any changes to the admin directory upload tool
