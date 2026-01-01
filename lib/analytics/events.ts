/**
 * Analytics Event Tracking Utilities
 *
 * This module provides type-safe event tracking for PostHog analytics.
 * Use these functions throughout your app to track user interactions.
 */

import posthog from 'posthog-js'

// ============================================
// Event Types & Properties
// ============================================

export type VehicleSearchEvent = {
  vin?: string
  make?: string
  model?: string
  year?: number
  searchMethod: 'vin' | 'manual'
}

export type ReportGenerationEvent = {
  reportType: 'total-loss' | 'diminished-value' | 'market-analysis'
  vin?: string
  make?: string
  model?: string
  year?: number
  isPaid: boolean
  estimatedValue?: number
}

export type PaymentEvent = {
  plan: 'basic' | 'premium'
  amount: number
  currency: string
  paymentProcessor: 'lemonsqueezy' | 'stripe'
  variantId?: string
}

export type UserIdentificationEvent = {
  email?: string
  name?: string
  userId?: string
}

// ============================================
// Core Analytics Functions
// ============================================

/**
 * Identify a user in PostHog
 * Call this after a user signs up or logs in
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.identify(userId, properties)
  }
}

/**
 * Reset user identification (call on logout)
 */
export function resetUser() {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.reset()
  }
}

/**
 * Set user properties (without identifying)
 */
export function setUserProperties(properties: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.setPersonProperties(properties)
  }
}

// ============================================
// Custom Event Tracking Functions
// ============================================

/**
 * Track vehicle search event
 */
export function trackVehicleSearch(properties: VehicleSearchEvent) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('vehicle_search', {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track report generation
 */
export function trackReportGeneration(properties: ReportGenerationEvent) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('report_generated', {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track payment initiation
 */
export function trackPaymentInitiated(properties: PaymentEvent) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('payment_initiated', {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track successful payment
 */
export function trackPaymentSuccess(properties: PaymentEvent) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('payment_success', {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track payment failure
 */
export function trackPaymentFailure(properties: PaymentEvent & { error?: string }) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('payment_failed', {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track API call (for monitoring usage)
 */
export function trackAPICall(
  endpoint: string,
  properties?: {
    method?: string
    statusCode?: number
    duration?: number
    error?: string
  }
) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('api_call', {
      endpoint,
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track report download
 */
export function trackReportDownload(format: 'pdf' | 'json', reportId?: string) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('report_downloaded', {
      format,
      reportId,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(featureName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('feature_used', {
      feature: featureName,
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track errors
 */
export function trackError(
  error: Error | string,
  context?: {
    component?: string
    action?: string
    metadata?: Record<string, unknown>
  }
) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    posthog.capture('error_occurred', {
      error: errorMessage,
      stack: errorStack,
      ...context,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track button clicks
 */
export function trackButtonClick(buttonName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('button_clicked', {
      button: buttonName,
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track form submissions
 */
export function trackFormSubmission(
  formName: string,
  properties?: {
    success?: boolean
    error?: string
    fields?: string[]
  }
) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('form_submitted', {
      form: formName,
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Generic event tracking function
 * Use this for custom events not covered by specific functions
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  }
}

// ============================================
// Feature Flags
// ============================================

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    return posthog.isFeatureEnabled(flagKey) ?? false
  }
  return false
}

/**
 * Get feature flag value with variant
 */
export function getFeatureFlagValue(flagKey: string): string | boolean | undefined {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    return posthog.getFeatureFlag(flagKey)
  }
  return undefined
}
