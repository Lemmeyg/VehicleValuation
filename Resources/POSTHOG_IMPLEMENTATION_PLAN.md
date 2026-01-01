# PostHog Analytics Implementation Plan
## Vehicle Valuation SaaS Platform

**Version:** 1.0
**Date:** December 19, 2025
**Priority Focus:** Vehicle Valuation Funnel (Detailed) + Knowledge Base & Directory (High-Level)

---

## Table of Contents

1. [Overview](#overview)
2. [Event Priority Categories](#event-priority-categories)
3. [PostHog Setup & Installation](#posthog-setup--installation)
4. [Vehicle Valuation Funnel - Detailed Analytics](#vehicle-valuation-funnel---detailed-analytics)
5. [Knowledge Base Analytics - High-Level](#knowledge-base-analytics---high-level)
6. [Directory Analytics - High-Level](#directory-analytics---high-level)
7. [Feature Flags Implementation](#feature-flags-implementation)
8. [Cohort Analysis Setup](#cohort-analysis-setup)
9. [Dashboard & Reports Configuration](#dashboard--reports-configuration)
10. [Implementation Checklist](#implementation-checklist)
11. [Testing Strategy](#testing-strategy)
12. [Maintenance & Monitoring](#maintenance--monitoring)

---

## Overview

### Goals
- **Primary:** Track complete Vehicle Valuation funnel from VIN input → Payment completion
- **Secondary:** Monitor Knowledge Base engagement and Directory exploration
- **Revenue:** Understand Basic vs Premium tier performance and payment provider comparison
- **Optimization:** Identify friction points, abandoned checkouts, and conversion opportunities

### Technology Stack
- **Analytics Platform:** PostHog (self-hosted or cloud)
- **Installation Method:** NPM package (`posthog-js`, `posthog-node`)
- **Framework:** Next.js 16 (App Router)
- **Authentication:** Supabase
- **Payment Providers:** Stripe & LemonSqueezy
- **Database:** Supabase (PostgreSQL)

### Key Metrics to Track
1. **Conversion Rates:** Each funnel stage conversion %
2. **Revenue Metrics:** AOV, tier preference, payment provider performance
3. **User Behavior:** Time to convert, abandonment points, feature usage
4. **Content Engagement:** KB article performance, Directory exploration
5. **Attribution:** Which content leads to conversions

---

## Event Priority Categories

### 🔴 MUST-HAVE (Phase 1 - Week 1)
**Critical path events that directly impact revenue understanding**

| Event | Purpose | Impact |
|-------|---------|--------|
| `page_viewed` | Track all page views with funnel stage | Funnel visualization |
| `vin_submitted` | VIN input completion (primary CTA) | Top of funnel conversion |
| `pricing_viewed` | User reached pricing page | Middle funnel engagement |
| `tier_selected` | User chose Basic or Premium | Tier preference analysis |
| `checkout_initiated` | Payment flow started | Bottom funnel conversion |
| `payment_completed` | Revenue event | Revenue tracking |
| `payment_failed` | Payment errors | Error rate monitoring |
| `user_identified` | Link events to users | User journey tracking |

**Estimated Effort:** 16-20 hours
**Files Modified:** 8-10 files
**Expected ROI:** Immediate funnel visibility

---

### 🟡 SHOULD-HAVE (Phase 2 - Week 2)
**Important events for optimization and user behavior understanding**

| Event | Purpose | Impact |
|-------|---------|--------|
| `checkout_abandoned` | User left checkout without paying | Recovery opportunity identification |
| `vin_validation_error` | VIN input errors | UX friction points |
| `auth_action` | Login/signup/logout | Auth funnel tracking |
| `report_downloaded` | Post-purchase engagement | Customer satisfaction |
| `kb_article_viewed` | Content engagement | Content performance |
| `directory_profile_viewed` | Professional exploration | Directory usage |
| `tier_comparison` | User toggled between tiers | Decision-making behavior |
| `form_field_focused` | Form interaction depth | Form UX analysis |

**Estimated Effort:** 12-16 hours
**Files Modified:** 6-8 files
**Expected ROI:** Optimization opportunities identified

---

### 🟢 NICE-TO-HAVE (Phase 3 - Week 3+)
**Advanced analytics for deep insights and attribution**

| Event | Purpose | Impact |
|-------|---------|--------|
| `kb_article_scroll_depth` | Reading engagement depth | Content quality metrics |
| `kb_article_read_time` | Time spent reading | Content engagement |
| `directory_filter_applied` | Filter usage (state, specialty) | Search behavior |
| `directory_carousel_navigation` | Carousel interaction | UI engagement |
| `feature_card_clicked` | Homepage feature engagement | Homepage optimization |
| `trust_indicator_viewed` | Security badges viewed | Trust signal impact |
| `rate_limit_hit` | User hit report creation limit | Pricing tier opportunity |
| `lead_attribution` | KB/Directory → VIN submission | Content ROI |
| `session_duration` | Time on site | Engagement depth |
| `exit_intent` | User about to leave | Intervention opportunity |

**Estimated Effort:** 16-20 hours
**Files Modified:** 10-12 files
**Expected ROI:** Advanced optimization insights

---

## PostHog Setup & Installation

### Step 1: Install PostHog Packages

**File:** `package.json`

```bash
npm install posthog-js posthog-node
```

**Updated dependencies:**
```json
{
  "dependencies": {
    "posthog-js": "^1.96.1",
    "posthog-node": "^4.0.1",
    // ... existing dependencies
  }
}
```

**Complexity:** ⭐ Easy
**Time:** 5 minutes

---

### Step 2: Environment Configuration

**File:** `.env.local`

```env
# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_PROJECT_API_KEY
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
# For self-hosted: NEXT_PUBLIC_POSTHOG_HOST=https://your-posthog-instance.com

# Server-side PostHog (for API routes)
POSTHOG_API_KEY=phc_YOUR_PROJECT_API_KEY

# Environment flag
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

**Security Notes:**
- `NEXT_PUBLIC_*` variables are exposed to the browser
- `POSTHOG_API_KEY` (without NEXT_PUBLIC_) is server-side only
- Never commit `.env.local` to git

**Complexity:** ⭐ Easy
**Time:** 5 minutes

---

### Step 3: Create PostHog Provider Component

**File:** `lib/posthog/PostHogProvider.tsx` (NEW FILE)

```tsx
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'
const ENABLE_ANALYTICS = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Only initialize in production or when explicitly enabled
    if (!ENABLE_ANALYTICS || !POSTHOG_KEY) {
      console.log('PostHog analytics disabled')
      return
    }

    // Initialize PostHog
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      loaded: posthog => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog loaded successfully')
        }
      },
      capture_pageview: false, // We'll manually capture pageviews
      capture_pageleave: true, // Track when users leave pages
      autocapture: false, // Disable autocapture for better control
      disable_session_recording: true, // Session replay disabled per requirements
    })
  }, [])

  useEffect(() => {
    // Track pageviews on route changes
    if (ENABLE_ANALYTICS && pathname) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')

      // Determine funnel stage from pathname
      let funnelStage = 'other'
      if (pathname === '/') funnelStage = 'homepage'
      else if (pathname === '/pricing') funnelStage = 'pricing'
      else if (pathname.startsWith('/reports/') && pathname.endsWith('/success')) funnelStage = 'success'
      else if (pathname.startsWith('/reports/')) funnelStage = 'report_details'
      else if (pathname === '/dashboard') funnelStage = 'dashboard'
      else if (pathname.startsWith('/knowledge-base')) funnelStage = 'knowledge_base'
      else if (pathname.startsWith('/directory')) funnelStage = 'directory'
      else if (pathname === '/login' || pathname === '/signup') funnelStage = 'authentication'

      posthog.capture('page_viewed', {
        url,
        pathname,
        funnel_stage: funnelStage,
        referrer: document.referrer,
      })
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
```

**Complexity:** ⭐⭐ Moderate
**Time:** 30 minutes

---

### Step 4: Create PostHog Utility Functions

**File:** `lib/posthog/analytics.ts` (NEW FILE)

```typescript
import posthog from 'posthog-js'

const ENABLE_ANALYTICS = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'

/**
 * Track custom event
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!ENABLE_ANALYTICS) return

  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Identify user (call after successful login/signup)
 */
export function identifyUser(userId: string, userProperties?: Record<string, any>) {
  if (!ENABLE_ANALYTICS) return

  posthog.identify(userId, {
    ...userProperties,
    identified_at: new Date().toISOString(),
  })
}

/**
 * Reset user identity (call on logout)
 */
export function resetUser() {
  if (!ENABLE_ANALYTICS) return
  posthog.reset()
}

/**
 * Track revenue event
 */
export function trackRevenue(amount: number, properties?: Record<string, any>) {
  if (!ENABLE_ANALYTICS) return

  posthog.capture('payment_completed', {
    ...properties,
    revenue: amount / 100, // Convert cents to dollars
    currency: 'USD',
  })
}

/**
 * Set user properties
 */
export function setUserProperties(properties: Record<string, any>) {
  if (!ENABLE_ANALYTICS) return
  posthog.people.set(properties)
}

/**
 * Track feature flag viewed
 */
export function trackFeatureFlag(flagKey: string, flagValue: boolean | string) {
  if (!ENABLE_ANALYTICS) return

  posthog.capture('feature_flag_viewed', {
    flag_key: flagKey,
    flag_value: flagValue,
  })
}

/**
 * Check if feature flag is enabled
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!ENABLE_ANALYTICS) return false
  return posthog.isFeatureEnabled(flagKey) || false
}

/**
 * Get feature flag variant
 */
export function getFeatureVariant(flagKey: string): string | boolean | undefined {
  if (!ENABLE_ANALYTICS) return undefined
  return posthog.getFeatureFlag(flagKey)
}
```

**Complexity:** ⭐⭐ Moderate
**Time:** 20 minutes

---

### Step 5: Server-Side Analytics for API Routes

**File:** `lib/posthog/server.ts` (NEW FILE)

```typescript
import { PostHog } from 'posthog-node'

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

let posthogClient: PostHog | null = null

/**
 * Get or initialize PostHog server client
 */
export function getPostHogClient(): PostHog | null {
  if (!POSTHOG_API_KEY) {
    console.warn('PostHog API key not configured for server-side analytics')
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
    })
  }

  return posthogClient
}

/**
 * Track server-side event
 */
export async function trackServerEvent(
  eventName: string,
  distinctId: string,
  properties?: Record<string, any>
) {
  const client = getPostHogClient()
  if (!client) return

  client.capture({
    distinctId,
    event: eventName,
    properties: {
      ...properties,
      server_side: true,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Identify user server-side
 */
export async function identifyUserServer(userId: string, properties?: Record<string, any>) {
  const client = getPostHogClient()
  if (!client) return

  client.identify({
    distinctId: userId,
    properties,
  })
}

/**
 * Shutdown PostHog client (call on server shutdown)
 */
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown()
  }
}
```

**Complexity:** ⭐⭐ Moderate
**Time:** 20 minutes

---

### Step 6: Add Provider to Root Layout

**File:** `app/layout.tsx`

**Current code** (approximate location):
```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

**Updated code:**
```tsx
import { PostHogProvider } from '@/lib/posthog/PostHogProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
```

**Complexity:** ⭐ Easy
**Time:** 5 minutes

---

## Vehicle Valuation Funnel - Detailed Analytics

### Funnel Overview

```
1. Homepage Landing → 2. VIN Input → 3. Pricing Page → 4. Tier Selection →
5. Authentication → 6. Checkout → 7. Payment → 8. Success → 9. Report Download
```

---

### Event 1: Homepage VIN Input

**Component:** `components/VehicleValuation.tsx`
**Lines:** ~43-82 (VIN input and validation)

**Event:** `vin_input_started`

```tsx
'use client'

import { trackEvent } from '@/lib/posthog/analytics'
import { useState, useEffect } from 'react'

export default function VehicleValuation() {
  const [vin, setVin] = useState('')
  const [vinInputStarted, setVinInputStarted] = useState(false)

  // Track when user starts typing VIN
  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setVin(value)

    // Track first character typed
    if (!vinInputStarted && value.length === 1) {
      setVinInputStarted(true)
      trackEvent('vin_input_started', {
        entry_point: 'homepage',
        location: 'vehicle_valuation_section',
      })
    }

    // Track validation errors
    if (value.length > 0 && value.length !== 17) {
      // Don't track every keystroke, just when they pause
      const timeoutId = setTimeout(() => {
        if (value.length > 0 && value.length < 17) {
          trackEvent('vin_validation_error', {
            entry_point: 'homepage',
            error_type: 'incomplete_vin',
            vin_length: value.length,
          })
        }
      }, 2000) // Wait 2 seconds after last keystroke

      return () => clearTimeout(timeoutId)
    }
  }

  // Existing validation and submit logic...
}
```

**Events Tracked:**
- ✅ `vin_input_started` - User begins typing VIN
- ✅ `vin_validation_error` - VIN format errors

**Properties Captured:**
- `entry_point`: "homepage" | "dashboard_new_report"
- `location`: Component location
- `error_type`: Error classification
- `vin_length`: Current VIN length

**Complexity:** ⭐⭐ Moderate
**Time:** 30 minutes

---

### Event 2: VIN Submitted Successfully

**Component:** `components/VehicleValuation.tsx`
**Lines:** ~70-82 (handlePricingCardClick function)

**Event:** `vin_submitted`

```tsx
const handlePricingCardClick = (tierId: string) => {
  if (!vin || vin.length !== 17) {
    setShowVinAlert(true)

    // Track failed tier selection due to missing VIN
    trackEvent('tier_selection_blocked', {
      tier_id: tierId,
      reason: 'missing_vin',
      vin_length: vin.length,
    })

    // Scroll to VIN input
    const vinInput = document.querySelector('input[type="text"]')
    if (vinInput) {
      vinInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(vinInput as HTMLInputElement).focus()
    }
    return
  }

  // Track successful VIN submission
  trackEvent('vin_submitted', {
    entry_point: 'homepage',
    vin_length: vin.length,
    selected_tier: tierId,
    validation_status: 'success',
  })

  // Track tier selection intent
  trackEvent('tier_selected', {
    tier_id: tierId,
    tier_name: tierId === 'basic' ? 'Basic Report' : 'Premium Report',
    amount: tierId === 'basic' ? 2900 : 4900,
    has_vin: true,
    source: 'homepage_pricing_card',
  })

  router.push(`/pricing?vin=${vin}&tier=${tierId}`)
}
```

**Events Tracked:**
- ✅ `vin_submitted` - Valid VIN entered
- ✅ `tier_selection_blocked` - Tier click without VIN
- ✅ `tier_selected` - Pricing tier chosen

**Properties Captured:**
- `entry_point`: Where VIN was submitted from
- `vin_length`: Always 17 for valid submissions
- `selected_tier`: "basic" | "premium"
- `validation_status`: "success" | "error"
- `tier_name`: Human-readable tier name
- `amount`: Price in cents

**Complexity:** ⭐⭐ Moderate
**Time:** 20 minutes

---

### Event 3: Pricing Page Viewed

**Page:** `app/pricing/page.tsx`
**Lines:** ~1-150 (entire component)

**Event:** `pricing_viewed`

```tsx
'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/posthog/analytics'

function PricingContent() {
  const searchParams = useSearchParams()
  const vin = searchParams?.get('vin') || ''
  const tier = searchParams?.get('tier') || ''

  useEffect(() => {
    // Track pricing page view
    trackEvent('pricing_viewed', {
      has_vin: !!vin,
      vin_length: vin.length,
      preselected_tier: tier || 'none',
      referrer: document.referrer,
    })

    // Fetch vehicle data and track results
    if (vin && vin.length === 17) {
      fetch('/api/vehicle/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            trackEvent('vehicle_lookup_failed', {
              vin_length: vin.length,
              error: data.error,
            })
          } else {
            trackEvent('vehicle_lookup_success', {
              vehicle_year: data.year,
              vehicle_make: data.make,
              vehicle_model: data.model,
              has_valuation_data: !!data.valuation,
            })
          }
        })
        .catch(error => {
          trackEvent('vehicle_lookup_error', {
            error_type: 'network_error',
            error_message: error.message,
          })
        })
    }
  }, [vin, tier])

  // Rest of component...
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PricingContent />
    </Suspense>
  )
}
```

**Events Tracked:**
- ✅ `pricing_viewed` - Pricing page loaded
- ✅ `vehicle_lookup_success` - VIN decoded successfully
- ✅ `vehicle_lookup_failed` - VIN decode failed
- ✅ `vehicle_lookup_error` - Network/API error

**Properties Captured:**
- `has_vin`: Boolean
- `vin_length`: Number
- `preselected_tier`: From URL parameter
- `vehicle_year`, `vehicle_make`, `vehicle_model`: Vehicle details
- `has_valuation_data`: Whether pricing data available

**Complexity:** ⭐⭐ Moderate
**Time:** 30 minutes

---

### Event 4: Tier Comparison & Selection

**Page:** `app/pricing/page.tsx`
**Lines:** ~100-120 (tier cards rendering)

**Event:** `tier_comparison`

```tsx
// Add state to track tier hovers
const [hoveredTier, setHoveredTier] = useState<string | null>(null)
const [tierHoverTimes, setTierHoverTimes] = useState<Record<string, number>>({})

const handleTierHover = (tierId: string, isEntering: boolean) => {
  if (isEntering) {
    setHoveredTier(tierId)
    setTierHoverTimes(prev => ({
      ...prev,
      [tierId]: Date.now(),
    }))
  } else {
    if (hoveredTier === tierId && tierHoverTimes[tierId]) {
      const hoverDuration = Date.now() - tierHoverTimes[tierId]

      // Track if user spent >2 seconds hovering (indicates consideration)
      if (hoverDuration > 2000) {
        trackEvent('tier_comparison', {
          tier_id: tierId,
          hover_duration_ms: hoverDuration,
          other_tier: tierId === 'basic' ? 'premium' : 'basic',
        })
      }
    }
    setHoveredTier(null)
  }
}

// In tier card rendering:
<div
  onMouseEnter={() => handleTierHover('basic', true)}
  onMouseLeave={() => handleTierHover('basic', false)}
  onClick={() => handleTierSelect('basic')}
  className="..."
>
  {/* Tier content */}
</div>
```

**Events Tracked:**
- ✅ `tier_comparison` - User comparing tiers (hover >2s)
- ✅ `tier_selected` - Final tier selection click

**Properties Captured:**
- `tier_id`: Selected tier
- `hover_duration_ms`: Time spent examining tier
- `other_tier`: Alternative tier for comparison

**Complexity:** ⭐⭐⭐ Complex
**Time:** 45 minutes

---

### Event 5: Checkout Initiated

**Page:** `app/pricing/page.tsx`
**Lines:** Tier selection → API call

**Event:** `checkout_initiated`

```tsx
const handleTierSelect = async (tierId: string) => {
  const selectedTier = tierId === 'basic' ? 'basic' : 'premium'
  const amount = tierId === 'basic' ? 2900 : 4900

  // Track tier selection
  trackEvent('tier_selected', {
    tier_id: selectedTier,
    tier_name: selectedTier === 'basic' ? 'Basic Report' : 'Premium Report',
    amount: amount,
    vin_length: vin.length,
    source: 'pricing_page',
  })

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // Show auth modal
    trackEvent('auth_required', {
      funnel_stage: 'checkout',
      tier_selected: selectedTier,
      amount: amount,
    })
    setShowAuthModal(true)
    return
  }

  // User is authenticated, initiate checkout
  trackEvent('checkout_initiated', {
    tier_id: selectedTier,
    amount: amount,
    user_id: session.user.id,
    payment_provider: 'stripe', // or 'lemonsqueezy' based on your logic
    vin_length: vin.length,
  })

  // Create checkout session
  try {
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tierId: selectedTier,
        amount: amount,
        vin: vin,
      }),
    })

    const data = await response.json()

    if (data.error) {
      trackEvent('checkout_creation_failed', {
        tier_id: selectedTier,
        error: data.error,
        payment_provider: 'stripe',
      })
      return
    }

    // Redirect to Stripe checkout
    trackEvent('checkout_redirect', {
      tier_id: selectedTier,
      payment_provider: 'stripe',
      checkout_session_id: data.sessionId,
    })

    window.location.href = data.url
  } catch (error) {
    trackEvent('checkout_error', {
      tier_id: selectedTier,
      error_type: 'network_error',
      error_message: error.message,
    })
  }
}
```

**Events Tracked:**
- ✅ `tier_selected` - Tier chosen on pricing page
- ✅ `auth_required` - Unauthenticated user blocked
- ✅ `checkout_initiated` - Checkout process started
- ✅ `checkout_creation_failed` - Checkout session creation failed
- ✅ `checkout_redirect` - Redirecting to payment provider
- ✅ `checkout_error` - Network or system error

**Properties Captured:**
- `tier_id`: "basic" | "premium"
- `amount`: Price in cents
- `user_id`: Supabase user ID
- `payment_provider`: "stripe" | "lemonsqueezy"
- `checkout_session_id`: Payment session ID

**Complexity:** ⭐⭐⭐ Complex
**Time:** 60 minutes

---

### Event 6: Payment Completed (Server-Side)

**API Route:** `app/api/stripe/webhook/route.ts`
**Lines:** ~30-80 (webhook handler)

**Event:** `payment_completed`

```typescript
import { trackServerEvent } from '@/lib/posthog/server'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Extract metadata
    const tierId = session.metadata?.tierId || 'unknown'
    const vin = session.metadata?.vin || 'unknown'
    const userId = session.metadata?.userId || session.client_reference_id || 'unknown'
    const amount = session.amount_total || 0

    // Track payment completion server-side
    await trackServerEvent('payment_completed', userId, {
      tier_id: tierId,
      amount: amount,
      currency: session.currency || 'usd',
      payment_provider: 'stripe',
      session_id: session.id,
      payment_intent: session.payment_intent,
      customer_email: session.customer_details?.email,
      vin_length: vin.length,
    })

    // Update report in database
    const { error } = await supabase
      .from('reports')
      .update({
        status: 'paid',
        payment_session_id: session.id,
        payment_provider: 'stripe',
        paid_at: new Date().toISOString(),
      })
      .eq('vin', vin)
      .eq('user_id', userId)

    if (error) {
      await trackServerEvent('payment_update_failed', userId, {
        error: error.message,
        session_id: session.id,
      })
    } else {
      await trackServerEvent('report_status_updated', userId, {
        status: 'paid',
        tier_id: tierId,
        session_id: session.id,
      })
    }
  }

  // Handle failed payment
  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent

    const userId = 'metadata' in session ? session.metadata?.userId : 'unknown'
    const tierId = 'metadata' in session ? session.metadata?.tierId : 'unknown'

    await trackServerEvent('payment_failed', userId || 'unknown', {
      tier_id: tierId,
      payment_provider: 'stripe',
      event_type: event.type,
      session_id: 'id' in session ? session.id : 'unknown',
      failure_reason: 'payment_intent' in session ? session.last_payment_error?.message : 'session_expired',
    })
  }

  return NextResponse.json({ received: true })
}
```

**Events Tracked:**
- ✅ `payment_completed` - Successful payment (SERVER-SIDE)
- ✅ `payment_failed` - Failed payment (SERVER-SIDE)
- ✅ `payment_update_failed` - Database update failed
- ✅ `report_status_updated` - Report marked as paid

**Properties Captured:**
- `tier_id`: Pricing tier
- `amount`: Payment amount in cents
- `currency`: "usd"
- `payment_provider`: "stripe" | "lemonsqueezy"
- `session_id`: Payment session ID
- `payment_intent`: Stripe payment intent ID
- `customer_email`: Buyer's email
- `failure_reason`: Error details for failed payments

**Complexity:** ⭐⭐⭐ Complex
**Time:** 60 minutes

**Note:** Repeat similar implementation for `app/api/lemonsqueezy/webhook/route.ts`

---

### Event 7: Checkout Abandonment Tracking

**Implementation:** Client-side timer + server-side confirmation

**File:** `app/pricing/page.tsx` (within tier selection)

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/posthog/analytics'

export default function PricingPage() {
  const checkoutStartedRef = useRef(false)
  const checkoutStartTimeRef = useRef<number | null>(null)

  // Track when user initiates checkout
  const handleCheckoutStart = (tierId: string) => {
    checkoutStartedRef.current = true
    checkoutStartTimeRef.current = Date.now()

    // Store in sessionStorage for cross-tab tracking
    sessionStorage.setItem('checkout_started', JSON.stringify({
      tier_id: tierId,
      started_at: checkoutStartTimeRef.current,
    }))

    // Proceed with checkout...
  }

  // Track abandonment on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const checkoutData = sessionStorage.getItem('checkout_started')

      if (checkoutData) {
        const { tier_id, started_at } = JSON.parse(checkoutData)
        const timeSpent = Date.now() - started_at

        // Only track if they spent >5 seconds (indicates real intent)
        if (timeSpent > 5000) {
          trackEvent('checkout_abandoned', {
            tier_id: tier_id,
            time_in_checkout_ms: timeSpent,
            funnel_stage: 'pricing_page',
          })
        }

        // Clear the flag
        sessionStorage.removeItem('checkout_started')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Clear abandonment flag on successful payment
  useEffect(() => {
    // Check URL for success parameter
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      sessionStorage.removeItem('checkout_started')
    }
  }, [])

  // Rest of component...
}
```

**Server-side Abandonment Detection:**

**File:** `app/api/checkout/check-abandonment/route.ts` (NEW FILE)

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackServerEvent } from '@/lib/posthog/server'

/**
 * Cron job endpoint to check for abandoned checkouts
 * Run every 30 minutes to identify users who started but didn't complete payment
 */
export async function POST(req: Request) {
  const supabase = await createClient()

  // Get reports created in last 24 hours that are still unpaid
  const { data: abandonedReports, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (error || !abandonedReports) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }

  // Track abandonment for each report
  for (const report of abandonedReports) {
    const timeSinceCreation = Date.now() - new Date(report.created_at).getTime()

    // If >30 minutes since creation and still unpaid, consider abandoned
    if (timeSinceCreation > 30 * 60 * 1000) {
      await trackServerEvent('checkout_abandoned_confirmed', report.user_id, {
        tier_id: report.tier,
        amount: report.price_paid,
        time_since_creation_ms: timeSinceCreation,
        vin_length: report.vin?.length || 0,
      })
    }
  }

  return NextResponse.json({ checked: abandonedReports.length })
}
```

**Events Tracked:**
- ✅ `checkout_abandoned` - User left during checkout (CLIENT-SIDE)
- ✅ `checkout_abandoned_confirmed` - Confirmed abandonment after 30min (SERVER-SIDE)

**Properties Captured:**
- `tier_id`: Intended tier
- `time_in_checkout_ms`: Duration before abandonment
- `funnel_stage`: Where abandonment occurred
- `time_since_creation_ms`: Server-side time elapsed

**Complexity:** ⭐⭐⭐⭐ Complex
**Time:** 90 minutes

---

### Event 8: Success Page & Report Download

**Page:** `app/reports/[id]/success/page.tsx`

**Event:** `success_page_viewed`

```tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/posthog/analytics'

export default function ReportSuccessPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get('session_id')

  useEffect(() => {
    // Track success page view
    trackEvent('success_page_viewed', {
      report_id: params.id,
      session_id: sessionId || 'unknown',
      funnel_stage: 'success',
    })

    // Clear checkout abandonment tracking
    sessionStorage.removeItem('checkout_started')
  }, [params.id, sessionId])

  const handleViewReport = () => {
    trackEvent('view_report_clicked', {
      report_id: params.id,
      source: 'success_page',
    })
  }

  const handleBackToDashboard = () => {
    trackEvent('back_to_dashboard_clicked', {
      report_id: params.id,
      source: 'success_page',
    })
  }

  return (
    <div>
      {/* Success content */}
      <button onClick={handleViewReport}>View Report Details</button>
      <button onClick={handleBackToDashboard}>Back to Dashboard</button>
    </div>
  )
}
```

**Page:** `app/reports/[id]/page.tsx`

**Event:** `report_downloaded`

```tsx
const handleDownload = async () => {
  trackEvent('report_download_initiated', {
    report_id: params.id,
    tier: report.tier,
  })

  try {
    const response = await fetch(`/api/reports/${params.id}/download`)

    if (response.ok) {
      trackEvent('report_downloaded', {
        report_id: params.id,
        tier: report.tier,
        file_size_bytes: response.headers.get('content-length'),
      })

      // Trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vehicle-report-${params.id}.pdf`
      a.click()
    } else {
      trackEvent('report_download_failed', {
        report_id: params.id,
        error: 'download_failed',
      })
    }
  } catch (error) {
    trackEvent('report_download_error', {
      report_id: params.id,
      error_type: 'network_error',
      error_message: error.message,
    })
  }
}
```

**Events Tracked:**
- ✅ `success_page_viewed` - User reached success page
- ✅ `view_report_clicked` - Clicked to view report details
- ✅ `back_to_dashboard_clicked` - Returned to dashboard
- ✅ `report_download_initiated` - Started download
- ✅ `report_downloaded` - Successfully downloaded PDF
- ✅ `report_download_failed` - Download failed
- ✅ `report_download_error` - Network error

**Properties Captured:**
- `report_id`: Report identifier
- `session_id`: Payment session ID
- `tier`: "basic" | "premium"
- `file_size_bytes`: PDF size
- `source`: Where action originated

**Complexity:** ⭐⭐ Moderate
**Time:** 45 minutes

---

### Event 9: Authentication Flow

**Component:** `components/AuthModal.tsx` (if exists) or auth pages

**Events:** `auth_action`

```tsx
'use client'

import { trackEvent } from '@/lib/posthog/analytics'
import { identifyUser } from '@/lib/posthog/analytics'

// Login
const handleLogin = async (email: string, password: string) => {
  trackEvent('auth_action', {
    action: 'login_attempted',
    funnel_stage: getCurrentFunnelStage(),
  })

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      trackEvent('auth_action', {
        action: 'login_failed',
        error_type: error.message,
      })
      return
    }

    // Identify user in PostHog
    identifyUser(data.user.id, {
      email: data.user.email,
      created_at: data.user.created_at,
    })

    trackEvent('auth_action', {
      action: 'login_succeeded',
      user_id: data.user.id,
    })
  } catch (error) {
    trackEvent('auth_action', {
      action: 'login_error',
      error_type: 'network_error',
    })
  }
}

// Signup
const handleSignup = async (email: string, password: string) => {
  trackEvent('auth_action', {
    action: 'signup_attempted',
    funnel_stage: getCurrentFunnelStage(),
  })

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      trackEvent('auth_action', {
        action: 'signup_failed',
        error_type: error.message,
      })
      return
    }

    // Identify new user
    identifyUser(data.user!.id, {
      email: data.user!.email,
      created_at: data.user!.created_at,
      signup_source: getCurrentFunnelStage(),
    })

    trackEvent('auth_action', {
      action: 'signup_succeeded',
      user_id: data.user!.id,
    })
  } catch (error) {
    trackEvent('auth_action', {
      action: 'signup_error',
      error_type: 'network_error',
    })
  }
}

// Logout
const handleLogout = async () => {
  trackEvent('auth_action', {
    action: 'logout',
  })

  await supabase.auth.signOut()
  resetUser() // Clear PostHog identity
}
```

**Events Tracked:**
- ✅ `auth_action` (action: "login_attempted" | "login_succeeded" | "login_failed")
- ✅ `auth_action` (action: "signup_attempted" | "signup_succeeded" | "signup_failed")
- ✅ `auth_action` (action: "logout")

**Properties Captured:**
- `action`: Specific auth action
- `funnel_stage`: Where auth was triggered
- `error_type`: Error details
- `user_id`: Supabase user ID
- `signup_source`: Funnel stage where signup occurred

**Complexity:** ⭐⭐ Moderate
**Time:** 45 minutes

---

## Knowledge Base Analytics - High-Level

### Event 1: KB Section Viewed (Homepage)

**Component:** `components/KnowledgeBase.tsx`

**Event:** `kb_section_viewed`

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/posthog/analytics'

export default function KnowledgeBase() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const hasTrackedView = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedView.current) {
            trackEvent('kb_section_viewed', {
              location: 'homepage',
              featured_article_count: 5,
            })
            hasTrackedView.current = true
          }
        })
      },
      { threshold: 0.5 } // Track when 50% visible
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="knowledge-base" className="...">
      {/* KB content */}
    </section>
  )
}
```

**Complexity:** ⭐⭐ Moderate
**Time:** 20 minutes

---

### Event 2: KB Article Clicked

**Component:** `components/KnowledgeBase.tsx`

**Event:** `kb_article_clicked`

```tsx
const handleArticleClick = (article: Article) => {
  trackEvent('kb_article_clicked', {
    article_slug: article.slug,
    article_title: article.title,
    article_category: article.category,
    source: 'homepage_featured',
    carousel_position: currentIndex,
  })
}

// In article card:
<Link
  href={`/knowledge-base/${article.slug}`}
  onClick={() => handleArticleClick(article)}
>
  {/* Article content */}
</Link>
```

**Complexity:** ⭐ Easy
**Time:** 15 minutes

---

### Event 3: KB Article Page View

**Page:** `app/knowledge-base/[slug]/page.tsx`

**Event:** `kb_article_viewed`

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { trackEvent } from '@/lib/posthog/analytics'

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const [scrollDepth, setScrollDepth] = useState(0)
  const [maxScrollDepth, setMaxScrollDepth] = useState(0)
  const startTimeRef = useRef(Date.now())
  const hasTrackedRead = useRef(false)

  useEffect(() => {
    // Track article view
    trackEvent('kb_article_viewed', {
      article_slug: params.slug,
      // Add article metadata if available
    })

    // Track scroll depth
    const handleScroll = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY
      const depth = Math.round((scrollTop / (documentHeight - windowHeight)) * 100)

      setScrollDepth(depth)
      setMaxScrollDepth(prev => Math.max(prev, depth))

      // Track "read" if scrolled >75% and spent >30 seconds
      const timeSpent = Date.now() - startTimeRef.current
      if (depth > 75 && timeSpent > 30000 && !hasTrackedRead.current) {
        trackEvent('kb_article_read', {
          article_slug: params.slug,
          scroll_depth: depth,
          time_spent_ms: timeSpent,
        })
        hasTrackedRead.current = true
      }
    }

    window.addEventListener('scroll', handleScroll)

    // Track when user leaves
    return () => {
      window.removeEventListener('scroll', handleScroll)

      const timeSpent = Date.now() - startTimeRef.current

      trackEvent('kb_article_exit', {
        article_slug: params.slug,
        max_scroll_depth: maxScrollDepth,
        time_spent_ms: timeSpent,
        completed_read: maxScrollDepth > 75 && timeSpent > 30000,
      })
    }
  }, [params.slug, maxScrollDepth])

  // Rest of component...
}
```

**Events Tracked:**
- ✅ `kb_article_viewed` - Article page loaded
- ✅ `kb_article_read` - Article fully read (>75% scroll + >30s)
- ✅ `kb_article_exit` - User left article

**Properties Captured:**
- `article_slug`: Article identifier
- `scroll_depth`: Current scroll percentage
- `max_scroll_depth`: Maximum scroll reached
- `time_spent_ms`: Time on article
- `completed_read`: Boolean indicating full read

**Complexity:** ⭐⭐⭐ Complex
**Time:** 60 minutes

---

### Event 4: KB to VIN Submission Attribution

**Implementation:** Track referrer when VIN submitted

**Component:** `components/VehicleValuation.tsx`

```tsx
const handleVinSubmit = () => {
  // Check if user came from KB article
  const referrer = document.referrer
  const fromKB = referrer.includes('/knowledge-base/')

  trackEvent('vin_submitted', {
    entry_point: 'homepage',
    vin_length: vin.length,
    // Attribution
    came_from_kb: fromKB,
    referrer_url: referrer,
    // Extract article slug if from KB
    kb_article_slug: fromKB ? referrer.split('/knowledge-base/')[1] : null,
  })
}
```

**Complexity:** ⭐ Easy
**Time:** 10 minutes

---

## Directory Analytics - High-Level

### Event 1: Directory Section Viewed (Homepage)

**Component:** `components/Directory.tsx`
**Lines:** ~83-196

**Event:** `directory_section_viewed`

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/posthog/analytics'

export default function Directory() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const hasTrackedView = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedView.current) {
            trackEvent('directory_section_viewed', {
              location: 'homepage',
              professional_count: PROFESSIONALS.length,
              initial_professional: PROFESSIONALS[0].name,
            })
            hasTrackedView.current = true
          }
        })
      },
      { threshold: 0.5 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="directory" className="...">
      {/* Directory content */}
    </section>
  )
}
```

**Complexity:** ⭐⭐ Moderate
**Time:** 20 minutes

---

### Event 2: Directory Carousel Navigation

**Component:** `components/Directory.tsx`
**Lines:** ~74-80 (handlePrevious, handleNext)

**Event:** `directory_carousel_navigation`

```tsx
const handlePrevious = () => {
  const newIndex = currentIndex === 0 ? PROFESSIONALS.length - 1 : currentIndex - 1

  trackEvent('directory_carousel_navigation', {
    direction: 'previous',
    from_index: currentIndex,
    to_index: newIndex,
    from_professional: PROFESSIONALS[currentIndex].name,
    to_professional: PROFESSIONALS[newIndex].name,
    location: 'homepage',
  })

  setCurrentIndex(newIndex)
}

const handleNext = () => {
  const newIndex = currentIndex === PROFESSIONALS.length - 1 ? 0 : currentIndex + 1

  trackEvent('directory_carousel_navigation', {
    direction: 'next',
    from_index: currentIndex,
    to_index: newIndex,
    from_professional: PROFESSIONALS[currentIndex].name,
    to_professional: PROFESSIONALS[newIndex].name,
    location: 'homepage',
  })

  setCurrentIndex(newIndex)
}
```

**Complexity:** ⭐ Easy
**Time:** 15 minutes

---

### Event 3: Professional Profile Clicked

**Component:** `components/Directory.tsx`
**Lines:** ~159-164 (View Profile button)

**Event:** `directory_profile_clicked`

```tsx
const handleProfileClick = (professional: Professional) => {
  trackEvent('directory_profile_clicked', {
    professional_id: professional.id,
    professional_name: professional.name,
    professional_role: professional.role,
    professional_location: professional.location,
    professional_rating: professional.rating,
    source: 'homepage_carousel',
    carousel_position: currentIndex,
  })
}

// In button:
<Button
  variant="primary"
  className="w-full"
  onClick={() => handleProfileClick(PROFESSIONALS[currentIndex])}
>
  View Profile
</Button>
```

**Complexity:** ⭐ Easy
**Time:** 10 minutes

---

### Event 4: Directory Page - Filter Usage

**Page:** `app/directory/page.tsx`

**Event:** `directory_filter_applied`

```tsx
'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/posthog/analytics'

export default function DirectoryPage() {
  const [filters, setFilters] = useState({
    state: '',
    serviceType: '',
    specialty: '',
  })

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }))

    trackEvent('directory_filter_applied', {
      filter_type: filterType,
      filter_value: value,
      current_filters: { ...filters, [filterType]: value },
    })
  }

  // Rest of component...
}
```

**Complexity:** ⭐ Easy
**Time:** 15 minutes

---

### Event 5: Directory to VIN Submission Attribution

**Component:** `components/VehicleValuation.tsx`

```tsx
const handleVinSubmit = () => {
  const referrer = document.referrer
  const fromDirectory = referrer.includes('/directory/')

  trackEvent('vin_submitted', {
    entry_point: 'homepage',
    vin_length: vin.length,
    // Attribution
    came_from_directory: fromDirectory,
    referrer_url: referrer,
    // Extract professional slug if from directory
    directory_professional_slug: fromDirectory ? referrer.split('/directory/')[1] : null,
  })
}
```

**Complexity:** ⭐ Easy
**Time:** 10 minutes

---

## Feature Flags Implementation

### Use Case 1: A/B Test Pricing Tiers

**Test:** Show different pricing ($29/$49 vs $24/$44) to compare conversion

**File:** `app/pricing/page.tsx`

```tsx
import { useEffect, useState } from 'react'
import { getFeatureVariant, trackFeatureFlag } from '@/lib/posthog/analytics'

export default function PricingPage() {
  const [pricingVariant, setPricingVariant] = useState<'control' | 'discounted'>('control')

  useEffect(() => {
    const variant = getFeatureVariant('pricing_test_2025_q1')
    const selectedVariant = variant === 'discounted' ? 'discounted' : 'control'

    setPricingVariant(selectedVariant)

    trackFeatureFlag('pricing_test_2025_q1', selectedVariant)
  }, [])

  const prices = pricingVariant === 'discounted'
    ? { basic: 2400, premium: 4400 }
    : { basic: 2900, premium: 4900 }

  return (
    <div>
      <h2>Basic Report: ${prices.basic / 100}</h2>
      <h2>Premium Report: ${prices.premium / 100}</h2>
    </div>
  )
}
```

**PostHog Dashboard Setup:**
1. Go to Feature Flags
2. Create flag: `pricing_test_2025_q1`
3. Set variants:
   - `control` (50%)
   - `discounted` (50%)
4. Enable for all users
5. Track conversion by variant in Insights

**Complexity:** ⭐⭐ Moderate
**Time:** 30 minutes

---

### Use Case 2: Show/Hide Money-Back Guarantee

**Test:** Does guarantee increase or decrease conversion?

**File:** `components/VehicleValuation.tsx`

```tsx
const [showGuarantee, setShowGuarantee] = useState(false)

useEffect(() => {
  const guaranteeEnabled = isFeatureEnabled('show_money_back_guarantee')
  setShowGuarantee(guaranteeEnabled)

  if (guaranteeEnabled) {
    trackFeatureFlag('show_money_back_guarantee', true)
  }
}, [])

// Conditionally render guarantee
{showGuarantee && (
  <div className="mt-12 text-center">
    <p className="text-sm text-slate-600">
      💯 <span className="font-semibold">100% Money-Back Guarantee</span>
    </p>
  </div>
)}
```

**Complexity:** ⭐ Easy
**Time:** 15 minutes

---

## Cohort Analysis Setup

### Cohort 1: VIN Submitted But Didn't Purchase

**Purpose:** Target users for re-engagement campaigns

**PostHog Setup:**
1. Go to Cohorts
2. Create new cohort: "VIN Submitted - No Purchase"
3. Conditions:
   - Performed event: `vin_submitted`
   - Did NOT perform event: `payment_completed`
   - In last 7 days

**Use Case:** Email campaign offering 10% discount

---

### Cohort 2: Premium Tier Buyers

**Purpose:** Identify high-value customers

**Conditions:**
- Performed event: `payment_completed`
- Where: `tier_id` = "premium"
- In last 30 days

**Use Case:** Upsell to additional services, gather testimonials

---

### Cohort 3: Abandoned After Tier Selection

**Purpose:** Recover lost revenue

**Conditions:**
- Performed event: `tier_selected`
- Did NOT perform event: `payment_completed`
- In last 24 hours

**Use Case:** Retargeting ads, urgency emails

---

### Cohort 4: Knowledge Base Readers Who Convert

**Purpose:** Identify which content drives conversions

**Conditions:**
- Performed event: `kb_article_read`
- Also performed: `payment_completed`
- In last 30 days

**Use Case:** Optimize content strategy, promote top-performing articles

---

## Dashboard & Reports Configuration

### Dashboard 1: Conversion Funnel Overview

**Metrics:**
1. **Funnel Visualization:**
   - Homepage views → VIN submitted → Pricing viewed → Tier selected → Checkout initiated → Payment completed

2. **Conversion Rates:**
   - Overall funnel conversion %
   - Drop-off at each stage

3. **Time to Convert:**
   - Average time from homepage to purchase
   - Median time to purchase

**PostHog Setup:**
```
1. Go to Insights → Funnels
2. Create funnel:
   - Step 1: page_viewed (funnel_stage = homepage)
   - Step 2: vin_submitted
   - Step 3: pricing_viewed
   - Step 4: tier_selected
   - Step 5: checkout_initiated
   - Step 6: payment_completed
3. Set conversion window: 7 days
4. Save to dashboard: "Conversion Funnel Overview"
```

---

### Dashboard 2: Revenue Analytics

**Metrics:**
1. **Total Revenue** (last 30 days)
2. **Revenue by Tier** (Basic vs Premium split)
3. **Revenue by Payment Provider** (Stripe vs LemonSqueezy)
4. **Average Order Value** (AOV)
5. **Revenue Trend** (daily/weekly)

**PostHog Setup:**
```
1. Insights → Trends
2. Event: payment_completed
3. Property: amount (sum)
4. Breakdown by: tier_id
5. Breakdown by: payment_provider
6. Add to dashboard: "Revenue Analytics"
```

---

### Dashboard 3: Tier Preference Analysis

**Metrics:**
1. **Basic vs Premium Selection %**
2. **Tier Hover Time** (comparison behavior)
3. **Tier Switch Rate** (users who changed mind)

**PostHog Setup:**
```
1. Insights → Trends
2. Events: tier_selected
3. Breakdown by: tier_id
4. Add pie chart showing %
5. Add trend chart showing daily selections
```

---

### Dashboard 4: Payment Provider Performance

**Metrics:**
1. **Conversion Rate by Provider** (Stripe vs LemonSqueezy)
2. **Failed Payment Rate** (by provider)
3. **Average Payment Processing Time**

**PostHog Setup:**
```
1. Funnel: checkout_initiated → payment_completed
2. Breakdown by: payment_provider
3. Add formula: (payment_failed / checkout_initiated) * 100
```

---

### Dashboard 5: Content Engagement

**Metrics:**
1. **KB Articles - Most Viewed**
2. **KB Articles - Highest Completion Rate** (scroll >75%)
3. **Directory Profiles - Most Clicked**
4. **Content → VIN Submission Rate**

**PostHog Setup:**
```
1. Insights → Trends
2. Event: kb_article_viewed
3. Breakdown by: article_slug
4. Order by: event count (descending)
5. Add retention: kb_article_viewed → vin_submitted
```

---

### Dashboard 6: Abandonment Recovery

**Metrics:**
1. **Checkout Abandonment Rate**
2. **Time in Checkout Before Abandonment**
3. **Most Common Abandonment Point**

**PostHog Setup:**
```
1. Event: checkout_abandoned
2. Cohort: Users who abandoned in last 7 days
3. Funnel drop-off visualization
4. Property analysis: time_in_checkout_ms
```

---

## Implementation Checklist

### Phase 1: Must-Have Events (Week 1)

**Setup & Configuration**
- [ ] Install `posthog-js` and `posthog-node` packages
- [ ] Create `.env.local` with PostHog credentials
- [ ] Create `lib/posthog/PostHogProvider.tsx`
- [ ] Create `lib/posthog/analytics.ts` utility functions
- [ ] Create `lib/posthog/server.ts` for server-side tracking
- [ ] Add PostHogProvider to `app/layout.tsx`
- [ ] Test PostHog initialization in development

**Homepage - VIN Input**
- [ ] Track `vin_input_started` in VehicleValuation component
- [ ] Track `vin_validation_error` for invalid VINs
- [ ] Track `vin_submitted` on successful VIN entry
- [ ] Track `tier_selection_blocked` when VIN missing

**Pricing Page**
- [ ] Track `pricing_viewed` with VIN and preselected tier
- [ ] Track `vehicle_lookup_success/failed` from API
- [ ] Track `tier_selected` when user clicks tier
- [ ] Track `auth_required` when unauthenticated

**Checkout & Payment**
- [ ] Track `checkout_initiated` when payment flow starts
- [ ] Track `checkout_creation_failed` for API errors
- [ ] Track `checkout_redirect` before leaving to payment provider
- [ ] Server-side: Track `payment_completed` in Stripe webhook
- [ ] Server-side: Track `payment_failed` in Stripe webhook
- [ ] Repeat for LemonSqueezy webhook

**Success & Report**
- [ ] Track `success_page_viewed` on success page load
- [ ] Track `view_report_clicked` and `back_to_dashboard_clicked`
- [ ] Track `report_downloaded` when PDF downloaded

**User Identification**
- [ ] Call `identifyUser()` after successful login
- [ ] Call `identifyUser()` after successful signup
- [ ] Call `resetUser()` on logout
- [ ] Set user properties (email, created_at, tier_purchased)

**Testing**
- [ ] Verify all events appear in PostHog debugger
- [ ] Test complete funnel end-to-end
- [ ] Verify user identification works
- [ ] Check event properties are captured correctly

---

### Phase 2: Should-Have Events (Week 2)

**Checkout Abandonment**
- [ ] Implement client-side abandonment tracking (sessionStorage)
- [ ] Track `checkout_abandoned` on page unload
- [ ] Create `/api/checkout/check-abandonment` cron endpoint
- [ ] Server-side: Track `checkout_abandoned_confirmed` for reports unpaid >30min
- [ ] Test abandonment tracking across different scenarios

**Tier Comparison**
- [ ] Track hover duration on pricing tiers
- [ ] Track `tier_comparison` when user hovers >2s
- [ ] Track tier switches (if user changes selection)

**Authentication**
- [ ] Track `auth_action` for login attempts (success/failure)
- [ ] Track `auth_action` for signup attempts (success/failure)
- [ ] Track `auth_action` for logout
- [ ] Track auth errors by type

**Knowledge Base**
- [ ] Track `kb_section_viewed` on homepage (intersection observer)
- [ ] Track `kb_article_clicked` from homepage carousel
- [ ] Track `kb_article_viewed` on article page load
- [ ] Track `kb_article_read` when >75% scroll + >30s
- [ ] Track `kb_article_exit` with scroll depth and time

**Directory**
- [ ] Track `directory_section_viewed` on homepage
- [ ] Track `directory_carousel_navigation` (prev/next clicks)
- [ ] Track `directory_profile_clicked` from carousel
- [ ] Track `directory_filter_applied` on full directory page

**Attribution**
- [ ] Add KB article attribution to `vin_submitted`
- [ ] Add Directory professional attribution to `vin_submitted`
- [ ] Track referrer URLs for all conversions

**Testing**
- [ ] Test abandonment tracking thoroughly
- [ ] Verify scroll depth tracking accuracy
- [ ] Test attribution flows (KB → VIN, Directory → VIN)
- [ ] Check all new events in PostHog

---

### Phase 3: Nice-to-Have Events (Week 3+)

**Advanced Content Tracking**
- [ ] Track reading time for KB articles
- [ ] Track scroll depth at 25%, 50%, 75%, 100% milestones
- [ ] Track article shares (if social sharing added)
- [ ] Track related article clicks

**Directory Deep Insights**
- [ ] Track which specialties are most viewed (total loss, diminished value, etc.)
- [ ] Track professional rating influence on clicks
- [ ] Track location-based filtering patterns
- [ ] Track carousel auto-rotation vs manual navigation

**Homepage Engagement**
- [ ] Track `feature_card_clicked` in FeatureCards component
- [ ] Track hero CTA clicks
- [ ] Track trust indicator visibility (intersection observer)
- [ ] Track footer link clicks

**Advanced Abandonment**
- [ ] Track `exit_intent` (mouse leaving viewport)
- [ ] Track session duration by funnel stage
- [ ] Track rage clicks (rapid clicking indicating frustration)
- [ ] Track form field errors by field name

**Rate Limiting**
- [ ] Track `rate_limit_hit` when user hits 1 report/7 days
- [ ] Track user retry timing after rate limit
- [ ] Identify users who would purchase additional reports

**Testing**
- [ ] Comprehensive QA of all events
- [ ] Performance testing (ensure tracking doesn't slow site)
- [ ] Cross-browser testing
- [ ] Mobile vs desktop tracking comparison

---

### Phase 4: Dashboards & Optimization (Ongoing)

**PostHog Dashboard Setup**
- [ ] Create "Conversion Funnel Overview" dashboard
- [ ] Create "Revenue Analytics" dashboard
- [ ] Create "Tier Preference Analysis" dashboard
- [ ] Create "Payment Provider Performance" dashboard
- [ ] Create "Content Engagement" dashboard
- [ ] Create "Abandonment Recovery" dashboard

**Feature Flags**
- [ ] Set up pricing A/B test feature flag
- [ ] Set up guarantee visibility feature flag
- [ ] Test feature flag distribution (50/50 split)
- [ ] Monitor conversion by variant

**Cohort Creation**
- [ ] Create "VIN Submitted - No Purchase" cohort
- [ ] Create "Premium Tier Buyers" cohort
- [ ] Create "Abandoned After Tier Selection" cohort
- [ ] Create "KB Readers Who Convert" cohort

**Analysis & Iteration**
- [ ] Weekly review of funnel conversion rates
- [ ] Identify biggest drop-off points
- [ ] A/B test solutions to friction points
- [ ] Monthly revenue analysis (tier mix, provider performance)
- [ ] Content performance analysis (which KB articles drive conversions)

---

## Testing Strategy

### Unit Testing Analytics Functions

**File:** `__tests__/analytics.test.ts` (NEW FILE)

```typescript
import { trackEvent, identifyUser, resetUser } from '@/lib/posthog/analytics'
import posthog from 'posthog-js'

jest.mock('posthog-js')

describe('PostHog Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should track events with correct properties', () => {
    trackEvent('test_event', { foo: 'bar' })

    expect(posthog.capture).toHaveBeenCalledWith('test_event', {
      foo: 'bar',
      timestamp: expect.any(String),
    })
  })

  it('should identify users correctly', () => {
    identifyUser('user-123', { email: 'test@example.com' })

    expect(posthog.identify).toHaveBeenCalledWith('user-123', {
      email: 'test@example.com',
      identified_at: expect.any(String),
    })
  })

  it('should reset user identity on logout', () => {
    resetUser()

    expect(posthog.reset).toHaveBeenCalled()
  })
})
```

---

### Integration Testing Full Funnel

**File:** `__tests__/e2e/valuation-funnel.spec.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Vehicle Valuation Funnel with Analytics', () => {
  test('should track complete funnel from VIN to payment', async ({ page }) => {
    // Intercept PostHog calls
    const events: string[] = []
    await page.route('**/decide/*', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/e/*', route => {
      const postData = route.request().postData()
      if (postData) {
        const data = JSON.parse(postData)
        events.push(data.event)
      }
      route.fulfill({ status: 200 })
    })

    // Navigate to homepage
    await page.goto('/')
    expect(events).toContain('page_viewed')

    // Enter VIN
    await page.fill('input[type="text"]', '1HGBH41JXMN109186')
    expect(events).toContain('vin_input_started')

    // Select tier
    await page.click('text=Get Basic Report')
    expect(events).toContain('vin_submitted')
    expect(events).toContain('tier_selected')

    // Verify pricing page
    await expect(page).toHaveURL(/\/pricing\?vin=/)
    expect(events).toContain('pricing_viewed')

    // Continue with checkout (mock auth)
    // ... rest of funnel
  })
})
```

---

### Manual Testing Checklist

**Before Production Deployment:**

- [ ] Open browser DevTools → Network tab
- [ ] Filter for PostHog requests (`/e/`, `/decide/`)
- [ ] Complete full funnel manually
- [ ] Verify each event fires with correct properties
- [ ] Check PostHog dashboard for live events
- [ ] Test in incognito (new user flow)
- [ ] Test with existing user (returning user flow)
- [ ] Test abandonment scenarios
- [ ] Verify feature flags work correctly
- [ ] Test on mobile device
- [ ] Test on different browsers (Chrome, Firefox, Safari)

---

## Maintenance & Monitoring

### Weekly Tasks
- [ ] Review PostHog dashboard for anomalies
- [ ] Check for event tracking errors (missing properties, failed captures)
- [ ] Monitor conversion rates for significant changes
- [ ] Review abandonment cohorts for recovery opportunities

### Monthly Tasks
- [ ] Analyze funnel performance trends
- [ ] Review feature flag experiment results
- [ ] Update cohorts based on new user behavior patterns
- [ ] Archive old/unused events
- [ ] Review and optimize slow-performing analytics code

### Quarterly Tasks
- [ ] Deep dive into tier preference analysis
- [ ] Compare payment provider performance
- [ ] Content audit (KB articles and Directory profiles)
- [ ] ROI analysis on analytics-driven changes
- [ ] Update event taxonomy if needed

---

## Summary

### Total Implementation Estimate

| Phase | Effort | Timeline |
|-------|--------|----------|
| Phase 1 (Must-Have) | 20 hours | Week 1 |
| Phase 2 (Should-Have) | 16 hours | Week 2 |
| Phase 3 (Nice-to-Have) | 20 hours | Week 3-4 |
| Phase 4 (Dashboards) | 8 hours | Ongoing |
| **Total** | **64 hours** | **1 month** |

### Files to Create
1. `lib/posthog/PostHogProvider.tsx`
2. `lib/posthog/analytics.ts`
3. `lib/posthog/server.ts`
4. `app/api/checkout/check-abandonment/route.ts`
5. `__tests__/analytics.test.ts`
6. `__tests__/e2e/valuation-funnel.spec.ts`

### Files to Modify
1. `app/layout.tsx` - Add PostHogProvider
2. `components/VehicleValuation.tsx` - VIN tracking
3. `app/pricing/page.tsx` - Pricing and checkout tracking
4. `app/api/stripe/webhook/route.ts` - Payment tracking
5. `app/api/lemonsqueezy/webhook/route.ts` - Payment tracking
6. `app/reports/[id]/success/page.tsx` - Success tracking
7. `app/reports/[id]/page.tsx` - Report download tracking
8. `components/KnowledgeBase.tsx` - KB section tracking
9. `app/knowledge-base/[slug]/page.tsx` - Article tracking
10. `components/Directory.tsx` - Directory tracking
11. `app/directory/page.tsx` - Directory filters tracking
12. `components/AuthModal.tsx` or auth pages - Auth tracking

### Expected Outcomes
- **Complete funnel visibility** from homepage to payment
- **Revenue attribution** by tier, provider, and source
- **Abandonment recovery** through targeted cohorts
- **Content optimization** based on engagement and conversion data
- **A/B testing capability** for pricing and features
- **User behavior insights** for product improvements

---

**Next Steps:**
1. Review this plan and confirm approach
2. Set up PostHog account (cloud or self-hosted)
3. Begin Phase 1 implementation
4. Test thoroughly in development
5. Deploy to production with analytics enabled
6. Monitor dashboards and iterate

---

**Document Version:** 1.0
**Last Updated:** December 19, 2025
**Status:** Ready for Implementation
