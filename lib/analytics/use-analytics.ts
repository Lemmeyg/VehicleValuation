'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback } from 'react'
import * as events from './events'

/**
 * Custom hook for accessing PostHog analytics
 * This provides a convenient wrapper around PostHog functionality
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const analytics = useAnalytics()
 *
 *   const handleClick = () => {
 *     analytics.trackButtonClick('cta-button', { page: 'home' })
 *   }
 *
 *   return <button onClick={handleClick}>Click me</button>
 * }
 * ```
 */
export function useAnalytics() {
  const posthog = usePostHog()

  const trackVehicleSearch = useCallback((properties: events.VehicleSearchEvent) => {
    events.trackVehicleSearch(properties)
  }, [])

  const trackReportGeneration = useCallback((properties: events.ReportGenerationEvent) => {
    events.trackReportGeneration(properties)
  }, [])

  const trackPaymentInitiated = useCallback((properties: events.PaymentEvent) => {
    events.trackPaymentInitiated(properties)
  }, [])

  const trackPaymentSuccess = useCallback((properties: events.PaymentEvent) => {
    events.trackPaymentSuccess(properties)
  }, [])

  const trackPaymentFailure = useCallback(
    (properties: events.PaymentEvent & { error?: string }) => {
      events.trackPaymentFailure(properties)
    },
    []
  )

  const trackAPICall = useCallback(
    (
      endpoint: string,
      properties?: {
        method?: string
        statusCode?: number
        duration?: number
        error?: string
      }
    ) => {
      events.trackAPICall(endpoint, properties)
    },
    []
  )

  const trackReportDownload = useCallback((format: 'pdf' | 'json', reportId?: string) => {
    events.trackReportDownload(format, reportId)
  }, [])

  const trackFeatureUsage = useCallback(
    (featureName: string, properties?: Record<string, unknown>) => {
      events.trackFeatureUsage(featureName, properties)
    },
    []
  )

  const trackError = useCallback(
    (
      error: Error | string,
      context?: {
        component?: string
        action?: string
        metadata?: Record<string, unknown>
      }
    ) => {
      events.trackError(error, context)
    },
    []
  )

  const trackButtonClick = useCallback(
    (buttonName: string, properties?: Record<string, unknown>) => {
      events.trackButtonClick(buttonName, properties)
    },
    []
  )

  const trackFormSubmission = useCallback(
    (
      formName: string,
      properties?: {
        success?: boolean
        error?: string
        fields?: string[]
      }
    ) => {
      events.trackFormSubmission(formName, properties)
    },
    []
  )

  const trackEvent = useCallback((eventName: string, properties?: Record<string, unknown>) => {
    events.trackEvent(eventName, properties)
  }, [])

  const identifyUser = useCallback((userId: string, properties?: Record<string, unknown>) => {
    events.identifyUser(userId, properties)
  }, [])

  const resetUser = useCallback(() => {
    events.resetUser()
  }, [])

  const setUserProperties = useCallback((properties: Record<string, unknown>) => {
    events.setUserProperties(properties)
  }, [])

  const isFeatureEnabled = useCallback((flagKey: string): boolean => {
    return events.isFeatureEnabled(flagKey)
  }, [])

  const getFeatureFlagValue = useCallback((flagKey: string): string | boolean | undefined => {
    return events.getFeatureFlagValue(flagKey)
  }, [])

  return {
    // PostHog instance (for advanced usage)
    posthog,

    // User identification
    identifyUser,
    resetUser,
    setUserProperties,

    // Custom events
    trackVehicleSearch,
    trackReportGeneration,
    trackPaymentInitiated,
    trackPaymentSuccess,
    trackPaymentFailure,
    trackAPICall,
    trackReportDownload,
    trackFeatureUsage,
    trackError,
    trackButtonClick,
    trackFormSubmission,
    trackEvent,

    // Feature flags
    isFeatureEnabled,
    getFeatureFlagValue,
  }
}
