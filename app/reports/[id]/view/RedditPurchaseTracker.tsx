'use client'

import { useEffect, useRef } from 'react'
import { trackRedditPurchase } from '@/lib/analytics/reddit-events'

export function RedditPurchaseTracker({
  value,
  currency,
  transactionId,
}: {
  value: number
  currency: string
  transactionId?: string
}) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true

    trackRedditPurchase({
      value,
      currency,
      transactionId,
      itemCount: 1,
    })
  }, [value, currency, transactionId])

  return null
}
