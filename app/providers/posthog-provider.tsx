'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
    const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'

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
            // Automatically capture click events on buttons, links, and forms
            dom_event_allowlist: ['click', 'change', 'submit'],
            url_allowlist: ['localhost', 'vehicle-valuation'], // Adjust based on your domain
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
