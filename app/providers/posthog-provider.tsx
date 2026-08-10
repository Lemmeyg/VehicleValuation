'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
    const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'

    // Skip on Vercel preview deployments — prevents preview traffic polluting analytics.
    // Requires NEXT_PUBLIC_VERCEL_ENV=$VERCEL_ENV in Vercel project env settings.
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return

    // Only initialize if PostHog is enabled and we have the required credentials
    if (posthogEnabled && posthogKey && posthogHost) {
      // Check if PostHog is already initialized
      if (!posthog.__loaded) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          person_profiles: 'identified_only', // Only create profiles for identified users
          capture_pageview: false, // We'll capture pageviews manually in a layout
          capture_pageleave: true, // Track when users leave pages
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
          loaded: posthog => {
            if (process.env.NODE_ENV === 'development') {
              console.log('PostHog initialized in development mode')
              // Optionally disable in development:
              // posthog.opt_out_capturing()
            }
          },
        })
      }
    } else {
      console.warn('PostHog is disabled or missing configuration')
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
