'use client'

import { useEffect, useRef } from 'react'
import { trackReportWorkflow, trackPaymentSuccess } from '@/lib/analytics/events'

interface Props {
  reportId: string
  planType: 'basic' | 'premium'
  amountCents: number
  transactionId?: string
}

export function PostHogPurchaseTracker({ reportId, planType, amountCents, transactionId }: Props) {
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
    })
  }, [reportId, planType, amountCents, transactionId])

  return null
}
