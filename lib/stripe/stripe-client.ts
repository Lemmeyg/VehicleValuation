/**
 * Stripe Client Configuration
 *
 * Server-side Stripe client for payment processing.
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

/**
 * Stripe client instance
 * Uses the secret key for server-side operations
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})

/**
 * Report pricing tiers (in cents)
 */
export const REPORT_PRICES = {
  BASIC: 2900, // $29.00
  PREMIUM: 4900, // $49.00
} as const

export type ReportType = keyof typeof REPORT_PRICES

/**
 * Get price for a report type
 */
export function getReportPrice(type: ReportType): number {
  return REPORT_PRICES[type]
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
