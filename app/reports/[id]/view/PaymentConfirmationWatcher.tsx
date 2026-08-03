'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

/**
 * Polls for a succeeded payment and refreshes the (server-rendered) page
 * once found. Never redirects — the payment gate on the parent page used
 * to redirect back to /reports/[id] here, which bounced straight back to
 * /view and created an infinite loop (see
 * docs/superpowers/plans/2026-08-01-report-view-payment-gate-redirect-loop.md).
 */
export function PaymentConfirmationWatcher({ reportId }: Props) {
  const router = useRouter()
  const attemptsRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/payment-status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.confirmed) {
          if (timerRef.current) clearInterval(timerRef.current)
          router.refresh()
          return
        }
      } catch {
        // Network error — keep polling
      }

      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_POLLS) {
        if (timerRef.current) clearInterval(timerRef.current)
        setTimedOut(true)
      }
    }

    timerRef.current = setInterval(poll, POLL_INTERVAL_MS)
    poll()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [reportId, router])

  if (timedOut) {
    return (
      <p className="mt-4 text-sm text-amber-700 text-center">
        Still confirming — this is taking longer than usual.
      </p>
    )
  }

  return null
}
