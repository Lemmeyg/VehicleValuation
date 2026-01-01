# PostHog Integration Architecture

This document explains how PostHog analytics is integrated into your Vehicle Valuation SaaS application.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│                     (app/layout.tsx)                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           PostHogProvider (Client-Side)               │ │
│  │         (app/providers/posthog-provider.tsx)          │ │
│  │                                                       │ │
│  │  • Initializes PostHog SDK                           │ │
│  │  • Configures autocapture                            │ │
│  │  • Enables session recording                         │ │
│  │  • Provides PostHog context to all components        │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │      PostHogPageView Component                  │ │ │
│  │  │   (app/providers/posthog-pageview.tsx)          │ │ │
│  │  │                                                 │ │ │
│  │  │  • Tracks pageviews automatically              │ │ │
│  │  │  • Monitors route changes                      │ │ │
│  │  │  • Captures URL parameters                     │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │           Your App Components                   │ │ │
│  │  │                                                 │ │ │
│  │  │  React Components using useAnalytics() hook    │ │ │
│  │  │  or direct event tracking functions             │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Track Events
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Analytics Library (lib/analytics/)             │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │   events.ts      │  │  use-analytics.ts│               │
│  │                  │  │                  │               │
│  │  • Core tracking │  │  • React hook    │               │
│  │    functions     │  │  • Wraps events  │               │
│  │  • Type-safe API │  │  • Easy to use   │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │    types.ts      │  │    index.ts      │               │
│  │                  │  │                  │               │
│  │  • Event types   │  │  • Centralized   │               │
│  │  • Type defs     │  │    exports       │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostHog Cloud Service                     │
│                  (https://app.posthog.com)                  │
│                                                             │
│  • Event ingestion and processing                          │
│  • User identification and profiles                        │
│  • Session recording storage                               │
│  • Feature flags management                                │
│  • Analytics dashboards                                    │
│  • Insights and reports                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Initialization (App Startup)

```
User visits app
      │
      ▼
app/layout.tsx renders
      │
      ▼
PostHogProvider initializes
      │
      ├─→ Reads NEXT_PUBLIC_POSTHOG_KEY from env
      ├─→ Initializes posthog-js SDK
      ├─→ Configures autocapture settings
      ├─→ Enables session recording
      └─→ Provides context to children
      │
      ▼
PostHogPageView component mounts
      │
      └─→ Tracks initial pageview
```

### 2. Event Tracking (User Action)

```
User clicks button
      │
      ▼
Component calls analytics.trackButtonClick()
      │
      ▼
useAnalytics hook forwards to events.trackButtonClick()
      │
      ├─→ Checks if window is available (client-side)
      ├─→ Checks if PostHog is loaded
      ├─→ Adds timestamp to event
      └─→ Calls posthog.capture()
      │
      ▼
posthog-js sends event to PostHog Cloud
      │
      ├─→ Batches multiple events
      ├─→ Compresses payload
      └─→ Sends via HTTPS
      │
      ▼
PostHog processes and stores event
```

### 3. User Identification (Login)

```
User logs in
      │
      ▼
Login component calls analytics.identifyUser()
      │
      ├─→ Passes userId and user properties
      └─→ Calls posthog.identify()
      │
      ▼
PostHog creates/updates user profile
      │
      ├─→ Associates all future events with this user
      ├─→ Merges anonymous events with identified user
      └─→ Enables cohort analysis and user journeys
```

### 4. Pageview Tracking (Navigation)

```
User navigates to new page
      │
      ▼
Next.js router updates
      │
      ▼
PostHogPageView useEffect triggers
      │
      ├─→ usePathname() detects route change
      ├─→ useSearchParams() captures query params
      └─→ posthog.capture('$pageview')
      │
      ▼
PostHog records pageview with full URL
```

---

## Component Hierarchy

```
RootLayout (app/layout.tsx)
│
├─ PostHogProvider (Client Component)
│  │
│  ├─ PostHog SDK Initialization
│  │  ├─ API Key from env
│  │  ├─ Autocapture config
│  │  └─ Session recording config
│  │
│  └─ PostHog React Context
│     │
│     ├─ Suspense Boundary
│     │  └─ PostHogPageView (Client Component)
│     │     ├─ usePathname()
│     │     ├─ useSearchParams()
│     │     └─ usePostHog()
│     │
│     └─ Your App Pages
│        │
│        ├─ Page Components
│        │  └─ useAnalytics() hook
│        │     └─ usePostHog() context
│        │
│        └─ API Routes
│           └─ Direct event imports
│              └─ posthog.capture()
```

---

## File Structure

```
vehicle-valuation-saas/
│
├─ app/
│  ├─ layout.tsx                    ← Wraps app with PostHogProvider
│  │
│  └─ providers/
│     ├─ posthog-provider.tsx       ← Initializes PostHog SDK
│     └─ posthog-pageview.tsx       ← Tracks pageviews
│
├─ lib/
│  └─ analytics/
│     ├─ index.ts                   ← Main exports
│     ├─ events.ts                  ← Event tracking functions
│     ├─ use-analytics.ts           ← React hook
│     └─ types.ts                   ← TypeScript definitions
│
├─ .env.local                       ← PostHog configuration
│  ├─ NEXT_PUBLIC_POSTHOG_KEY
│  ├─ NEXT_PUBLIC_POSTHOG_HOST
│  └─ NEXT_PUBLIC_POSTHOG_ENABLED
│
└─ Documentation
   ├─ POSTHOG_USAGE_GUIDE.md        ← How to use
   ├─ POSTHOG_SETUP_SUMMARY.md      ← What was installed
   └─ POSTHOG_ARCHITECTURE.md       ← This file
```

---

## Event Types & Functions

### Predefined Event Tracking Functions

| Function                  | Event Name          | Use Case                  |
| ------------------------- | ------------------- | ------------------------- |
| `trackVehicleSearch()`    | `vehicle_search`    | User searches for vehicle |
| `trackReportGeneration()` | `report_generated`  | Report is generated       |
| `trackPaymentInitiated()` | `payment_initiated` | User starts checkout      |
| `trackPaymentSuccess()`   | `payment_success`   | Payment completes         |
| `trackPaymentFailure()`   | `payment_failed`    | Payment fails             |
| `trackAPICall()`          | `api_call`          | API request made          |
| `trackReportDownload()`   | `report_downloaded` | User downloads report     |
| `trackFeatureUsage()`     | `feature_used`      | Feature is used           |
| `trackError()`            | `error_occurred`    | Error happens             |
| `trackButtonClick()`      | `button_clicked`    | Button clicked            |
| `trackFormSubmission()`   | `form_submitted`    | Form submitted            |
| `trackEvent()`            | Custom              | Any custom event          |

### User Management Functions

| Function              | Purpose                            |
| --------------------- | ---------------------------------- |
| `identifyUser()`      | Associate events with user ID      |
| `resetUser()`         | Clear user identification (logout) |
| `setUserProperties()` | Update user properties             |

### Feature Flag Functions

| Function                | Purpose                  |
| ----------------------- | ------------------------ |
| `isFeatureEnabled()`    | Check if flag is enabled |
| `getFeatureFlagValue()` | Get flag value/variant   |

---

## Environment Variables

```env
# PostHog API Key (required)
# Get from: https://app.posthog.com/project/settings
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxx

# PostHog API Host (default: https://app.posthog.com)
# Use custom host if self-hosting PostHog
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Enable/Disable PostHog (default: true)
# Set to false to disable analytics
NEXT_PUBLIC_POSTHOG_ENABLED=true
```

**Important**: All variables use `NEXT_PUBLIC_` prefix because they need to be accessible in the browser (client-side).

---

## Privacy & Security

### Data Protection

1. **Input Masking**: All form inputs are masked by default in session recordings
2. **Sensitive Class**: Elements with class `sensitive` are automatically masked
3. **No PII by Default**: We don't track personally identifiable information unless explicitly added
4. **User Control**: Users can opt-out of tracking at any time

### Security Best Practices

1. **API Key**: PostHog API key is public and safe to expose (read-only)
2. **Environment Variables**: Use `.env.local` which is gitignored
3. **Rate Limiting**: PostHog handles rate limiting automatically
4. **HTTPS Only**: All communication with PostHog is encrypted

### GDPR Compliance

1. **Consent Management**: Implement cookie consent before initializing PostHog
2. **Data Export**: PostHog supports user data export
3. **Data Deletion**: PostHog supports user data deletion (GDPR right to erasure)
4. **Anonymization**: Track anonymous users before identification

---

## Performance Considerations

### Optimization Strategies

1. **Event Batching**: PostHog automatically batches events
2. **Lazy Loading**: PostHog provider uses client-side only rendering
3. **Async Initialization**: PostHog initializes asynchronously
4. **Compression**: Events are compressed before sending

### Bundle Size Impact

- **posthog-js**: ~30KB gzipped
- **posthog-node**: Server-side only, no client impact
- **Analytics Library**: ~5KB (custom code)

**Total Client Bundle Impact**: ~35KB gzipped

---

## Advanced Features

### Session Recording

- **Enabled by default** in production
- **Privacy-safe**: Inputs and sensitive data masked
- **Replay user sessions** to debug issues
- **See exactly what users see**

### Feature Flags

- **A/B testing**: Test features with subset of users
- **Progressive rollout**: Gradually enable features
- **User targeting**: Show features to specific users
- **Kill switch**: Instantly disable problematic features

### Autocapture

- **Automatic click tracking** on buttons and links
- **Form submission tracking**
- **Page scrolling depth**
- **Rage clicks** (frustrated user clicks)

### Cohorts & Funnels

- **User cohorts**: Group users by behavior
- **Conversion funnels**: Track multi-step processes
- **Retention analysis**: See user retention over time
- **Path analysis**: Visualize user journeys

---

## Monitoring & Debugging

### Development Mode

PostHog logs initialization status in development:

```
PostHog initialized in development mode
```

### Production Mode

PostHog runs silently in production unless errors occur.

### Debugging Tips

1. **Check Network Tab**: Look for requests to `app.posthog.com`
2. **Console Logs**: PostHog logs errors to console
3. **PostHog Debug Mode**: Add `?posthog_debug=true` to URL
4. **Verify API Key**: Check `.env.local` for correct key

---

## Scaling Considerations

### Free Tier Limits

- **1 million events/month** (PostHog free tier)
- **3 months data retention**
- **Unlimited users**

### Paid Tier Benefits

- **50 million+ events/month**
- **Unlimited data retention**
- **Priority support**
- **Custom data retention policies**

### Self-Hosting Option

PostHog can be self-hosted for:

- **Complete data control**
- **No event limits**
- **Compliance requirements**
- **Cost optimization at scale**

---

## Testing Strategy

### Unit Tests

Test analytics functions without PostHog:

```ts
jest.mock('posthog-js')

test('trackVehicleSearch calls posthog.capture', () => {
  trackVehicleSearch({ searchMethod: 'vin', vin: '123' })
  expect(posthog.capture).toHaveBeenCalledWith('vehicle_search', ...)
})
```

### Integration Tests

Test PostHog provider integration:

```tsx
render(
  <PostHogProvider>
    <TestComponent />
  </PostHogProvider>
)

// Verify PostHog context is available
```

### E2E Tests

Use Playwright to verify events:

```ts
// Intercept PostHog requests
await page.route('**/decide/*', route => route.fulfill())
await page.route('**/e/*', route => route.fulfill())

// Perform action
await page.click('button')

// Verify event was sent
expect(requests).toContainEvent('button_clicked')
```

---

## Troubleshooting

### Common Issues

| Issue                | Cause                | Solution                      |
| -------------------- | -------------------- | ----------------------------- |
| Events not appearing | Wrong API key        | Check `.env.local`            |
| PostHog not loading  | Ad blocker           | Disable ad blocker            |
| Type errors          | Missing imports      | Import from `@/lib/analytics` |
| Events delayed       | Batching             | Wait 5-10 seconds             |
| Provider error       | Missing dependencies | Run `npm install`             |

### Debug Checklist

- [ ] PostHog API key is correct
- [ ] `.env.local` has `NEXT_PUBLIC_POSTHOG_KEY`
- [ ] Dev server was restarted after env changes
- [ ] No ad blockers are active
- [ ] Browser console shows no errors
- [ ] Network tab shows requests to PostHog
- [ ] PostHog project is active (not archived)

---

## Next Steps

1. **Add Tracking**: Implement event tracking in key components
2. **Create Dashboards**: Build custom dashboards in PostHog
3. **Set Alerts**: Configure alerts for critical events
4. **A/B Testing**: Use feature flags for experiments
5. **User Feedback**: Track user satisfaction
6. **Performance**: Monitor API and page performance

---

## Additional Resources

- [PostHog Documentation](https://posthog.com/docs)
- [React Integration Guide](https://posthog.com/docs/libraries/react)
- [Next.js Integration Guide](https://posthog.com/docs/libraries/next-js)
- [Feature Flags Guide](https://posthog.com/docs/feature-flags)
- [Session Recording Guide](https://posthog.com/docs/session-replay)
- [Privacy & Compliance](https://posthog.com/docs/privacy)

---

**Last Updated**: December 2024
**Version**: 1.0.0
