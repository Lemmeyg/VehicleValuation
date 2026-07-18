'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trackCheckoutAbandoned } from '@/lib/analytics/events'
import { ReportReadyWatcher } from './ReportReadyWatcher'

interface Props {
  reportId: string
  token?: string
  plan: 'basic' | 'premium'
  price: number
  initialCancelled: boolean
}

function storageKey(reportId: string) {
  return `checkout_cancelled_${reportId}`
}

export function NotReadySection({ reportId, token, plan, price, initialCancelled }: Props) {
  const router = useRouter()
  const [showPurchaseState, setShowPurchaseState] = useState(initialCancelled)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const key = storageKey(reportId)
    const alreadySeen = sessionStorage.getItem(key) === 'true'

    if (initialCancelled && !alreadySeen) {
      sessionStorage.setItem(key, 'true')
      setShowPurchaseState(true)
      setShowBanner(true)

      trackCheckoutAbandoned({ reportId, plan, price, step: 'lemon_squeezy_cancel' })

      const cleanPath = `/reports/${reportId}/view${token ? `?token=${token}` : ''}`
      router.replace(cleanPath)
    } else if (alreadySeen) {
      setShowPurchaseState(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, initialCancelled])

  return (
    <>
      {showPurchaseState ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Your report is on hold</h2>
          <p className="text-slate-600 mb-6">
            You didn&apos;t complete checkout, so your valuation hasn&apos;t been generated yet.
          </p>
          <Link
            href={`/pricing?reportId=${reportId}`}
            className="inline-flex items-center px-8 py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-lg text-lg"
          >
            Complete Your Purchase
          </Link>
        </div>
      ) : (
        <>
          <ReportReadyWatcher reportId={reportId} />
          <div data-testid="report-skeleton">
            {/* Skeleton for value cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm animate-pulse"
                >
                  <div className="h-3 bg-slate-200 rounded w-24 mb-3" />
                  <div className="h-10 bg-slate-200 rounded w-32 mb-2" />
                  <div className="h-2 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
            {/* Skeleton for market analysis panel */}
            <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-64 mb-4" />
              <div className="h-4 bg-slate-100 rounded w-48 mb-8" />
              <div className="h-48 bg-slate-100 rounded w-full" />
            </div>
            {/* Skeleton for comparables table */}
            <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-48 mb-6" />
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4 py-4 border-b border-slate-100">
                  <div className="w-24 h-16 bg-slate-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-40" />
                    <div className="h-3 bg-slate-100 rounded w-24" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showBanner && (
        <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-2xl bg-amber-50 border border-amber-300 rounded-xl shadow-lg px-5 py-4 flex items-center gap-3"
            role="alert"
          >
            <div className="flex-1 text-sm text-amber-900">
              <span className="font-semibold">Welcome back.</span> Your report is saved and ready
              whenever you are — pick up right where you left off.
            </div>
            <button
              onClick={() => setShowBanner(false)}
              aria-label="Dismiss"
              className="text-amber-700 hover:text-amber-900 text-xl leading-none font-bold px-1"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
