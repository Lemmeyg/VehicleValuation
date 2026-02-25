'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
}

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

export function ReportReadyPoller({ reportId }: Props) {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (timedOut) return

    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return

        const data = await res.json()
        if (data.ready) {
          router.push(`/reports/${reportId}/view`)
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
    // Kick off the first poll immediately
    poll()

    return () => clearInterval(timer)
  }, [reportId, router, timedOut])

  if (timedOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Taking Longer Than Expected</h1>
          <p className="text-slate-600 mb-6">
            Your report is being prepared. Check your email for a link, or try refreshing.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
            <p className="text-sm text-slate-500">
              Still having trouble?{' '}
              <a href="mailto:support@totallosstoolkit.com" className="text-emerald-600 underline">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Animated spinner */}
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
        <p className="text-slate-600 mb-2">Fetching your vehicle&apos;s valuation data&hellip;</p>
        <p className="text-sm text-slate-400">This takes about 10 seconds.</p>
      </div>
    </div>
  )
}
