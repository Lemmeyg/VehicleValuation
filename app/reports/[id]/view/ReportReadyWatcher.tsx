'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

export function ReportReadyWatcher({ reportId }: Props) {
  const router = useRouter()
  const attemptsRef = useRef(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.ready) {
          // router.refresh() re-fetches the server component; token in URL is preserved
          router.refresh()
          return
        }
      } catch {
        // Network error — keep polling
      }

      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_POLLS) {
        setTimedOut(true)
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    poll()
    return () => clearInterval(timer)
  }, [reportId, router])

  if (timedOut) {
    return (
      <p className="mt-4 text-sm text-amber-700 text-center">
        Still generating — refresh the page in a moment.
      </p>
    )
  }

  return null
}
