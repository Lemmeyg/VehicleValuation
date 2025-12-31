# PostHog Analytics Integration Guide

PostHog has been successfully integrated into your Vehicle Valuation SaaS application! This guide shows you how to use it.

## 📋 Table of Contents

1. [Setup Checklist](#setup-checklist)
2. [Basic Usage](#basic-usage)
3. [Tracking Events](#tracking-events)
4. [User Identification](#user-identification)
5. [Feature Flags](#feature-flags)
6. [Example Implementations](#example-implementations)
7. [Dashboard Setup](#dashboard-setup)

---

## ✅ Setup Checklist

### 1. Get Your PostHog API Key

1. Sign up at [PostHog](https://posthog.com/) (free tier available)
2. Create a new project
3. Go to **Project Settings** → **Project API Key**
4. Copy your API key (starts with `phc_`)

### 2. Add to Environment Variables

Your `.env.local` file has been updated with PostHog configuration:

```env
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-api-key-here
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_ENABLED=true
```

**Replace `your-posthog-api-key-here` with your actual PostHog API key.**

### 3. Restart Development Server

```bash
npm run dev
```

---

## 🚀 Basic Usage

### In React Components (Recommended)

Use the `useAnalytics` hook for the easiest integration:

```tsx
'use client'

import { useAnalytics } from '@/lib/analytics'

export default function MyComponent() {
  const analytics = useAnalytics()

  const handleClick = () => {
    analytics.trackButtonClick('cta-button', {
      page: 'home',
      section: 'hero',
    })
  }

  return <button onClick={handleClick}>Get Started</button>
}
```

### Outside React Components

Import individual functions directly:

```ts
import { trackEvent, trackAPICall } from '@/lib/analytics'

// In an API route
export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    const data = await fetchData()

    trackAPICall('/api/vehicles', {
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
    })

    return Response.json(data)
  } catch (error) {
    trackAPICall('/api/vehicles', {
      method: 'GET',
      statusCode: 500,
      duration: Date.now() - startTime,
      error: error.message,
    })

    throw error
  }
}
```

---

## 📊 Tracking Events

### Vehicle Search Tracking

```tsx
import { useAnalytics } from '@/lib/analytics'

function VehicleSearchForm() {
  const analytics = useAnalytics()

  const handleSubmit = async formData => {
    // Track the search
    analytics.trackVehicleSearch({
      searchMethod: 'vin',
      vin: formData.vin,
      make: formData.make,
      model: formData.model,
      year: formData.year,
    })

    // ... continue with search logic
  }
}
```

### Report Generation Tracking

```tsx
import { useAnalytics } from '@/lib/analytics'

function GenerateReportButton() {
  const analytics = useAnalytics()

  const handleGenerate = async () => {
    const result = await generateReport(vehicleData)

    analytics.trackReportGeneration({
      reportType: 'total-loss',
      vin: vehicleData.vin,
      make: vehicleData.make,
      model: vehicleData.model,
      year: vehicleData.year,
      isPaid: true,
      estimatedValue: result.predictedPrice,
    })
  }
}
```

### Payment Tracking

```tsx
import { useAnalytics } from '@/lib/analytics'

function CheckoutButton() {
  const analytics = useAnalytics()

  const handleCheckout = async () => {
    // Track payment initiation
    analytics.trackPaymentInitiated({
      plan: 'premium',
      amount: 49,
      currency: 'USD',
      paymentProcessor: 'lemonsqueezy',
      variantId: '123456',
    })

    try {
      const result = await processPayment()

      // Track success
      analytics.trackPaymentSuccess({
        plan: 'premium',
        amount: 49,
        currency: 'USD',
        paymentProcessor: 'lemonsqueezy',
      })
    } catch (error) {
      // Track failure
      analytics.trackPaymentFailure({
        plan: 'premium',
        amount: 49,
        currency: 'USD',
        paymentProcessor: 'lemonsqueezy',
        error: error.message,
      })
    }
  }
}
```

### Form Submission Tracking

```tsx
import { useAnalytics } from '@/lib/analytics'

function ContactForm() {
  const analytics = useAnalytics()

  const handleSubmit = async formData => {
    try {
      await sendContact(formData)

      analytics.trackFormSubmission('contact-form', {
        success: true,
        fields: ['name', 'email', 'message'],
      })
    } catch (error) {
      analytics.trackFormSubmission('contact-form', {
        success: false,
        error: error.message,
      })
    }
  }
}
```

### Error Tracking

```tsx
import { useAnalytics } from '@/lib/analytics'

function MyComponent() {
  const analytics = useAnalytics()

  const handleAction = async () => {
    try {
      await riskyOperation()
    } catch (error) {
      analytics.trackError(error, {
        component: 'MyComponent',
        action: 'handleAction',
        metadata: {
          userId: user.id,
          timestamp: new Date().toISOString(),
        },
      })

      // Show error to user
      toast.error('Something went wrong')
    }
  }
}
```

---

## 👤 User Identification

### Identify Users After Login

```tsx
import { useAnalytics } from '@/lib/analytics'

function LoginPage() {
  const analytics = useAnalytics()

  const handleLogin = async credentials => {
    const user = await login(credentials)

    // Identify the user in PostHog
    analytics.identifyUser(user.id, {
      email: user.email,
      name: user.full_name,
      company: user.company,
      plan: user.subscription_plan,
      createdAt: user.created_at,
    })
  }
}
```

### Reset User on Logout

```tsx
import { useAnalytics } from '@/lib/analytics'

function LogoutButton() {
  const analytics = useAnalytics()

  const handleLogout = async () => {
    await logout()

    // Reset user identification
    analytics.resetUser()
  }
}
```

### Update User Properties

```tsx
import { useAnalytics } from '@/lib/analytics'

function UpgradePlanButton() {
  const analytics = useAnalytics()

  const handleUpgrade = async () => {
    await upgradePlan('premium')

    // Update user properties
    analytics.setUserProperties({
      plan: 'premium',
      upgradedAt: new Date().toISOString(),
    })
  }
}
```

---

## 🚩 Feature Flags

### Check if Feature is Enabled

```tsx
import { useAnalytics } from '@/lib/analytics'

function MyComponent() {
  const analytics = useAnalytics()

  const showNewFeature = analytics.isFeatureEnabled('new-dashboard-ui')

  return <div>{showNewFeature ? <NewDashboard /> : <OldDashboard />}</div>
}
```

### Get Feature Flag with Variants

```tsx
import { useAnalytics } from '@/lib/analytics'

function PricingPage() {
  const analytics = useAnalytics()

  const pricingVariant = analytics.getFeatureFlagValue('pricing-test')

  return (
    <div>
      {pricingVariant === 'variant-a' && <PricingA />}
      {pricingVariant === 'variant-b' && <PricingB />}
      {!pricingVariant && <DefaultPricing />}
    </div>
  )
}
```

---

## 💡 Example Implementations

### Example 1: Vehicle Search Page

```tsx
'use client'

import { useState } from 'react'
import { useAnalytics } from '@/lib/analytics'

export default function VehicleSearchPage() {
  const analytics = useAnalytics()
  const [vin, setVin] = useState('')

  const handleSearch = async () => {
    // Track the search
    analytics.trackVehicleSearch({
      searchMethod: 'vin',
      vin: vin,
    })

    try {
      const result = await fetch('/api/vehicles/search', {
        method: 'POST',
        body: JSON.stringify({ vin }),
      })

      const data = await result.json()

      // Track successful search
      analytics.trackEvent('vehicle_search_success', {
        vin: vin,
        make: data.make,
        model: data.model,
      })
    } catch (error) {
      // Track failed search
      analytics.trackError(error, {
        component: 'VehicleSearchPage',
        action: 'handleSearch',
      })
    }
  }

  return (
    <div>
      <input value={vin} onChange={e => setVin(e.target.value)} placeholder="Enter VIN" />
      <button onClick={handleSearch}>Search</button>
    </div>
  )
}
```

### Example 2: Report Download

```tsx
'use client'

import { useAnalytics } from '@/lib/analytics'

export default function ReportViewPage({ report }) {
  const analytics = useAnalytics()

  const handleDownloadPDF = async () => {
    analytics.trackReportDownload('pdf', report.id)

    // Download logic
    const blob = await generatePDF(report)
    downloadBlob(blob, `report-${report.id}.pdf`)
  }

  return (
    <div>
      <h1>Vehicle Report</h1>
      <button onClick={handleDownloadPDF}>Download PDF</button>
    </div>
  )
}
```

### Example 3: API Route with Tracking

```ts
// app/api/vehicles/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { trackAPICall } from '@/lib/analytics'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { vin } = await request.json()
    const vehicleData = await searchVehicle(vin)

    // Track successful API call
    trackAPICall('/api/vehicles/search', {
      method: 'POST',
      statusCode: 200,
      duration: Date.now() - startTime,
    })

    return NextResponse.json(vehicleData)
  } catch (error) {
    // Track failed API call
    trackAPICall('/api/vehicles/search', {
      method: 'POST',
      statusCode: 500,
      duration: Date.now() - startTime,
      error: error.message,
    })

    return NextResponse.json({ error: 'Failed to search vehicle' }, { status: 500 })
  }
}
```

---

## 📈 Dashboard Setup

### 1. Create Custom Events in PostHog

After deploying your app and generating some events, go to PostHog and create insights:

1. **Vehicle Searches Dashboard**
   - Event: `vehicle_search`
   - Breakdown by: `searchMethod`
   - Chart type: Line graph

2. **Report Generation Dashboard**
   - Event: `report_generated`
   - Breakdown by: `reportType`, `isPaid`
   - Chart type: Bar chart

3. **Payment Conversion Funnel**
   - Steps:
     1. `payment_initiated`
     2. `payment_success`
   - Group by: `plan`

4. **Error Monitoring**
   - Event: `error_occurred`
   - Breakdown by: `component`, `action`
   - Chart type: Table

### 2. Set Up Alerts

Create alerts for critical events:

- **Payment failures**: Alert when `payment_failed` > 5 in last hour
- **API errors**: Alert when `api_call` with `error` > 10 in last 30 minutes
- **High error rate**: Alert when `error_occurred` > 20 in last hour

### 3. Enable Session Recording

Session recordings are enabled by default. View them in PostHog under **Session Recordings**.

**Privacy Note**: Inputs are masked by default to protect sensitive data.

---

## 🔧 Advanced Configuration

### Disable PostHog in Development

Edit `.env.local`:

```env
NEXT_PUBLIC_POSTHOG_ENABLED=false
```

Or conditionally in code:

```tsx
// app/providers/posthog-provider.tsx
if (process.env.NODE_ENV === 'development') {
  posthog.opt_out_capturing()
}
```

### Custom Event Properties

Add global properties to all events:

```ts
import posthog from 'posthog-js'

posthog.register({
  app_version: '1.0.0',
  environment: process.env.NODE_ENV,
})
```

---

## 🎯 Key Metrics to Track

Here are the most important metrics for your Vehicle Valuation SaaS:

### User Acquisition

- Page views
- Sign-ups
- Magic link clicks

### Engagement

- Vehicle searches (by method: VIN vs manual)
- Report views
- Report downloads
- Time on site

### Revenue

- Payment initiated
- Payment success rate
- Payment failures
- Revenue by plan (basic vs premium)

### Product Quality

- API call success/failure rate
- Error rates by component
- Average report generation time
- User satisfaction (if you add surveys)

---

## 📝 Best Practices

1. **Track Everything Important** - Don't hesitate to add tracking to key user actions
2. **Use Descriptive Event Names** - Use lowercase with underscores: `vehicle_search_completed`
3. **Include Context** - Add relevant properties to events (user plan, page, feature, etc.)
4. **Respect Privacy** - Don't track sensitive data (SSN, credit cards, passwords)
5. **Monitor Dashboard** - Review your PostHog dashboard weekly to identify trends
6. **A/B Test** - Use feature flags to test new features with a subset of users
7. **Set Up Alerts** - Get notified of critical issues (payment failures, high error rates)

---

## 🐛 Troubleshooting

### Events Not Appearing in PostHog

1. **Check API Key**: Verify your `NEXT_PUBLIC_POSTHOG_KEY` is correct
2. **Check Console**: Look for PostHog initialization message in browser console
3. **Disable Ad Blockers**: Some ad blockers block PostHog
4. **Check Network Tab**: Verify requests to `app.posthog.com` are succeeding
5. **Wait 5 Minutes**: PostHog has a slight delay in showing events

### PostHog Not Loading

1. **Verify Environment Variables**: Make sure `NEXT_PUBLIC_POSTHOG_ENABLED=true`
2. **Restart Dev Server**: After changing `.env.local`, restart with `npm run dev`
3. **Check Browser Console**: Look for any JavaScript errors

---

## 📚 Additional Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog React Integration](https://posthog.com/docs/libraries/react)
- [PostHog Next.js Guide](https://posthog.com/docs/libraries/next-js)
- [Feature Flags](https://posthog.com/docs/feature-flags)
- [Session Recording](https://posthog.com/docs/session-replay)

---

## 🎉 You're All Set!

PostHog is now integrated into your Vehicle Valuation SaaS. Start tracking events and gain valuable insights into your users' behavior!

**Next Steps:**

1. ✅ Add your PostHog API key to `.env.local`
2. ✅ Restart your dev server
3. ✅ Add tracking to key user actions
4. ✅ Monitor your PostHog dashboard
5. ✅ Set up alerts for critical events

Happy tracking! 🚀
