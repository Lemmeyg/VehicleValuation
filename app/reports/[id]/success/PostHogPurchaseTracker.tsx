'use client'

import { useEffect, useRef } from 'react'
import { trackReportWorkflow, trackPaymentSuccess, identifyUser } from '@/lib/analytics/events'

interface Props {
  reportId: string
  planType: 'basic' | 'premium'
  amountCents: number
  transactionId?: string
  email?: string
  vin?: string
}

export function PostHogPurchaseTracker({
  reportId,
  planType,
  amountCents,
  transactionId,
  email,
  vin,
}: Props) {
  const tracked = useRef(false)

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

    if (email) {
      identifyUser(email, { email, vin, plan: planType })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fires once — tracked.current prevents double-fire; props are stable on a success page

  return null
}
