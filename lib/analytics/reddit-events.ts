/**
 * Reddit Pixel Conversion Tracking
 *
 * Type-safe wrapper functions for Reddit's rdt() pixel API.
 * Each function maps to a Reddit standard conversion event.
 */

declare global {
  interface Window {
    rdt?: (...args: unknown[]) => void
  }
}

function rdt(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.rdt) {
    window.rdt(...args)
  }
}

/** Track VIN form submission as a Lead event */
export function trackRedditLead(properties?: { customEventName?: string }) {
  rdt('track', 'Lead', properties)
}

/** Track new user signup */
export function trackRedditSignUp(properties?: { customEventName?: string }) {
  rdt('track', 'SignUp', properties)
}

/** Track pricing page view */
export function trackRedditViewContent() {
  rdt('track', 'ViewContent')
}

/** Track plan selection (add to cart) */
export function trackRedditAddToCart(properties?: {
  itemCount?: number
  value?: number
  currency?: string
}) {
  rdt('track', 'AddToCart', properties)
}

/** Track completed purchase */
export function trackRedditPurchase(properties?: {
  value?: number
  currency?: string
  transactionId?: string
  itemCount?: number
}) {
  rdt('track', 'Purchase', properties)
}
