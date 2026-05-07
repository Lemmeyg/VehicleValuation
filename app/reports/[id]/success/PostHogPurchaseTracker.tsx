'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { trackReportWorkflow, trackPaymentSuccess } from '@/lib/analytics/events'

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

    if (email && typeof window !== 'undefined' && posthog.__loaded) {
      posthog.identify(email, { email, vin, plan: planType })
    }
  }, [reportId, planType, amountCents, transactionId, email, vin])

  return null
}
