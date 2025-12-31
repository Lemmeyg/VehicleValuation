/**
 * Type definitions for PostHog analytics events
 * This provides autocomplete and type safety for all analytics events
 */

export interface BaseEventProperties {
  timestamp?: string
  [key: string]: unknown
}

export interface VehicleSearchEvent extends BaseEventProperties {
  vin?: string
  make?: string
  model?: string
  year?: number
  searchMethod: 'vin' | 'manual'
}

export interface ReportGenerationEvent extends BaseEventProperties {
  reportType: 'total-loss' | 'diminished-value' | 'market-analysis'
  vin?: string
  make?: string
  model?: string
  year?: number
  isPaid: boolean
  estimatedValue?: number
}

export interface PaymentEvent extends BaseEventProperties {
  plan: 'basic' | 'premium'
  amount: number
  currency: string
  paymentProcessor: 'lemonsqueezy' | 'stripe'
  variantId?: string
}

export interface UserIdentificationEvent extends BaseEventProperties {
  email?: string
  name?: string
  userId?: string
  plan?: string
  company?: string
  createdAt?: string
}

export interface APICallEvent extends BaseEventProperties {
  endpoint: string
  method?: string
  statusCode?: number
  duration?: number
  error?: string
}

export interface ErrorEvent extends BaseEventProperties {
  error: string
  stack?: string
  component?: string
  action?: string
  metadata?: Record<string, unknown>
}

export interface ReportDownloadEvent extends BaseEventProperties {
  format: 'pdf' | 'json'
  reportId?: string
}

export interface FeatureUsageEvent extends BaseEventProperties {
  feature: string
  [key: string]: unknown
}

export interface ButtonClickEvent extends BaseEventProperties {
  button: string
  page?: string
  section?: string
  [key: string]: unknown
}

export interface FormSubmissionEvent extends BaseEventProperties {
  form: string
  success?: boolean
  error?: string
  fields?: string[]
}

/**
 * All possible analytics event names
 */
export type AnalyticsEventName =
  | 'vehicle_search'
  | 'report_generated'
  | 'payment_initiated'
  | 'payment_success'
  | 'payment_failed'
  | 'api_call'
  | 'report_downloaded'
  | 'feature_used'
  | 'error_occurred'
  | 'button_clicked'
  | 'form_submitted'
  | '$pageview'
  | string // Allow custom event names

/**
 * Feature flag keys used in the application
 */
export type FeatureFlagKey =
  | 'new-dashboard-ui'
  | 'advanced-analytics'
  | 'premium-features'
  | 'beta-features'
  | string // Allow custom flags
