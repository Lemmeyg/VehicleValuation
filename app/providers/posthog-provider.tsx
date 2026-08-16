'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

/**
 * Initialise PostHog.
 *
 * Called at module scope (below), deliberately NOT from a useEffect.
 *
 * React runs child effects before parent effects, so when this lived in the
 * provider's own useEffect every tracker that captured from a bare mount effect
 * — PurchaseCompleteTracker on /reports/[id]/view being the costly one — ran
 * while posthog.__loaded was still false. The `posthog.__loaded` guard in
 * lib/analytics/events.ts then discarded those events silently, with no error
 * anywhere. That is why payment_success only ever arrived from /success, whose
 * ReportReadyPoller fires from an async poll callback that lands after init,
 * and never from /view (BL-128).
 *
 * Module scope runs during bundle evaluation, before React renders or hydrates,
 * so PostHog is loaded before any component effect can capture.
 */
function initPostHog() {
  // Module scope also evaluates on the server during SSR — bail there.
  if (typeof window === 'undefined') return

  // Idempotent: Fast Refresh and repeated imports must not re-init.
  if (posthog.__loaded) return

  // Skip on Vercel preview deployments — prevents preview traffic polluting analytics.
  // Requires NEXT_PUBLIC_VERCEL_ENV=$VERCEL_ENV in Vercel project env settings.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'

  if (!posthogEnabled || !posthogKey || !posthogHost) {
    console.warn('PostHog is disabled or missing configuration')
    return
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: 'identified_only', // Only create profiles for identified users
    capture_pageview: false, // We'll capture pageviews manually in a layout
    capture_pageleave: true, // Track when users leave pages
    // Report unhandled errors to PostHog error tracking. Off by default in
    // posthog-js, which is why the error dashboard had never received a single
    // $exception despite being the primary source for the code-and-logs review
    // (BL-127) — "no errors found" actually meant "no errors collected".
    capture_exceptions: true,
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
    session_recording: {
      // Enable session recording for better debugging
      maskAllInputs: true, // Mask sensitive input fields
      maskTextSelector: '.sensitive', // Mask elements with 'sensitive' class
    },
    // Disable in development if needed
    loaded: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('PostHog initialized in development mode')
        // Optionally disable in development:
        // posthog.opt_out_capturing()
      }
    },
  })
}

initPostHog()

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>
}
