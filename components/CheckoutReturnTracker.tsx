'use client'

import { useEffect } from 'react'
import { trackCheckoutAbandoned } from '@/lib/analytics/events'
import { readCheckoutHandoff, clearCheckoutHandoff } from '@/lib/analytics/checkout-return'

/**
 * Detects a visitor coming back from LemonSqueezy without having bought.
 *
 * Mounted once in the root layout so it runs on whatever page they land on.
 * The pricing page leaves a marker at the moment it hands off; if that marker
 * is still here on any later pageview, they came back. The only exception is a
 * successful purchase, which returns to /reports/[id]/view?checkout=complete —
 * that clears the marker without reporting anything.
 *
 * This exists because we could not previously tell "bounced off the pricing
 * page" apart from "reached the payment page and backed out" (BL-85, BL-1).
 */
export function CheckoutReturnTracker() {
  useEffect(() => {
    const handoff = readCheckoutHandoff()
    if (!handoff) return

    // A completed purchase is not an abandonment. Parse the query param
    // rather than substring-matching the raw search string — a substring
    // check would also match an unrelated param like `other_checkout=complete`.
    const hasCompleteParam =
      new URLSearchParams(window.location.search).get('checkout') === 'complete'

    // Defence in depth: a visitor who abandoned checkout does not land on
    // their own report's pages — someone who bought does. This covers
    // /success, /view, /print and /action-plan in one rule, and survives
    // even if a future return URL is built without the checkout=complete
    // param at all.
    const ownReportMatch = window.location.pathname.match(/^\/reports\/([^/]+)(?:\/|$)/)
    const isOwnReportPage = !!ownReportMatch && ownReportMatch[1] === handoff.reportId

    if (hasCompleteParam || isOwnReportPage) {
      clearCheckoutHandoff()
      return
    }

    // Clear before capturing: if the capture throws, we must not report twice
    // on the next pageview.
    clearCheckoutHandoff()

    trackCheckoutAbandoned({
      reportId: handoff.reportId,
      plan: handoff.plan,
      price: handoff.price,
      step: 'returned_without_purchase',
    })
  }, [])

  return null
}
