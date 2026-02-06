# Auth Flow Redesign: Google-First Authentication

**Date:** 2026-02-05
**Status:** Approved

## Summary

Remove email field from homepage form and implement a Google-first authentication flow with email fallback.

## Current Flow

```
Homepage (Email + VIN + Mileage + ZIP)
    ↓
Check Email API (/api/reports/check-email)
    ↓
Auth Page (shows login or signup based on email check)
    ↓
Pricing Page (with URL params)
```

## New Flow

```
Homepage (VIN + Mileage + ZIP only)
    ↓
Auth Page (Google-first with email fallback)
    ↓
Pricing Page (reads sessionStorage)
```

## Changes Required

### 1. Hero.tsx (Homepage Form)

- Remove email input field
- Remove email validation logic
- Remove `/api/reports/check-email` API call
- Store only VIN, Mileage, ZIP in sessionStorage as `hero_form_data`
- Redirect to `/auth?returnUrl=/pricing` after form submission

### 2. Auth Page (`/app/auth/page.tsx`)

**New Layout:**

```
┌─────────────────────────────────────┐
│     Get Your Vehicle Report         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🔵 Continue with Google    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ──────── or ────────              │
│                                     │
│  ▼ Continue with email             │
│    (expands to show email form)    │
│                                     │
└─────────────────────────────────────┘
```

**Email Flow (when expanded):**

1. User enters email → clicks "Continue"
2. System checks if account exists via `/api/reports/check-email`
3. Shows appropriate form:
   - Returning user: Password field + "Forgot password?" link
   - New user: Password + Confirm Password + Terms checkbox

**Google Flow:**

1. User clicks "Continue with Google"
2. Supabase OAuth redirects to Google
3. After auth, redirects to `/auth/callback?next=/pricing`
4. Callback page redirects to pricing

### 3. Pricing Page (`/app/pricing/page.tsx`)

- Remove URL parameter reading for email/vin/mileage/zipCode
- Read form data exclusively from sessionStorage
- User is guaranteed to be authenticated on arrival
- Create report immediately with authenticated user

### 4. Auth Callback (`/app/auth/callback/page.tsx`)

- Ensure `next` parameter is respected for Google OAuth redirects
- Default redirect remains `/dashboard` for direct logins

## Data Flow

| Step                    | Data Location                        |
| ----------------------- | ------------------------------------ |
| Homepage form submitted | sessionStorage: `hero_form_data`     |
| Auth page               | Reads returnUrl from URL params      |
| After authentication    | Redirects to returnUrl (/pricing)    |
| Pricing page            | Reads sessionStorage, creates report |

## sessionStorage Schema

```json
{
  "hero_form_data": {
    "vin": "string",
    "mileage": "number",
    "zipCode": "string"
  }
}
```

## Success Criteria

1. Homepage form has only VIN, Mileage, ZIP fields
2. Auth page shows Google button prominently
3. Email fallback works with smart new/returning detection
4. After any auth method, user lands on pricing page
5. Pricing page creates report using sessionStorage data
6. Existing direct login/signup flows continue to work
