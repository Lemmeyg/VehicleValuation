'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_ATTEMPTS = 30
const POLL_INTERVAL_MS = 2000

export function AuthenticatedPaymentPoller({ reportId }: Props) {
  const router = useRouter()
  const attemptsRef = useRef(0)

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null
    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.ready) {
          if (timerId) clearInterval(timerId)
          router.refresh()
          return
        }
      } catch {
        // keep polling
      }
      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_ATTEMPTS && timerId) {
        clearInterval(timerId)
      }
    }

    poll()
    timerId = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      if (timerId) clearInterval(timerId)
    }
  }, [reportId, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6">
          <svg
            className="animate-spin w-16 h-16 text-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-600 mb-2">Confirming your payment…</p>
        <p className="text-sm text-slate-400">This takes about 10 seconds.</p>
      </div>
    </div>
  )
}
