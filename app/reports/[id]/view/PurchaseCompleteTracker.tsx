'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { trackReportWorkflow, trackPaymentSuccess, identifyUser } from '@/lib/analytics/events'

interface Props {
  reportId: string
  planType: 'basic' | 'premium'
  amountCents: number
  transactionId?: string
  email?: string
  vin?: string
  userId?: string
}

/**
 * Fires payment_success for anonymous buyers returning from LemonSqueezy checkout
 * to /reports/[id]/view (the token-access route — authenticated buyers land on
 * /success instead, where PostHogPurchaseTracker already handles this).
 *
 * Only rendered when the page is loaded with the checkout=complete marker.
 * Strips that marker via router.replace() after firing so a bookmarked/reopened
 * report link doesn't re-fire payment_success on a later visit.
 */
export function PurchaseCompleteTracker({
  reportId,
  planType,
  amountCents,
  transactionId,
  email,
  vin,
  userId,
}: Props) {
  const tracked = useRef(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true

    trackReportWorkflow({
      step: 'report_created',
      reportId,
      planType,
    })

    trackPaymentSuccess({
      plan: planType,
      amount: amountCents / 100,
      currency: 'USD',
      paymentProcessor: 'lemonsqueezy',
      variantId: transactionId,
      email,
      vin,
    })

    if (userId) {
      identifyUser(userId, { email, vin, plan: planType })
    }

    // usePathname() returns only the path, with no query string — replacing
    // with it directly (as this used to) drops every query param, including
    // `token`. For anonymous (token-access) buyers, the very next server
    // render of this page sees no token and redirects to /auth, since the
    // page can no longer tell they're the report's paying owner. Only the
    // `checkout` marker is meant to be removed; every other param, especially
    // `token`, must survive the replace.
    const params = new URLSearchParams(window.location.search)
    params.delete('checkout')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
