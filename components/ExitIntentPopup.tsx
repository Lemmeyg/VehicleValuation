'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/events'

interface ExitIntentPopupProps {
  vin: string
  reportId: string
  onSelectPlan: (discountCode: string) => void
}

const DISCOUNT_CODE = process.env.NEXT_PUBLIC_EXIT_INTENT_DISCOUNT_CODE ?? 'STAY19'

export default function ExitIntentPopup({ vin, reportId, onSelectPlan }: ExitIntentPopupProps) {
  const [visible, setVisible] = useState(false)
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    const handleMouseLeave = async (e: MouseEvent) => {
      if (e.clientY > 0) return
      if (hasTriggeredRef.current) return
      if (sessionStorage.getItem('exit_popup_shown')) return

      hasTriggeredRef.current = true

      try {
        const res = await fetch(`/api/reports/check-vin-count?vin=${encodeURIComponent(vin)}`)
        const data = await res.json()
        if (data.count === 1) {
          sessionStorage.setItem('exit_popup_shown', 'true')
          setVisible(true)
          trackEvent('exit_intent_popup_shown', { reportId, vin })
        }
      } catch {
        // silently fail — never interrupt the user experience
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [vin, reportId])

  const handleDismiss = () => {
    setVisible(false)
    trackEvent('exit_intent_popup_dismissed', { reportId, vin })
  }

  const handleCTA = () => {
    trackEvent('exit_intent_popup_converted', { reportId, vin })
    onSelectPlan(DISCOUNT_CODE)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Wait — get your report for $19 today
          </h2>
          <p className="text-slate-500 text-sm mb-6">One-time offer. This session only.</p>

          <button
            onClick={handleCTA}
            className="w-full py-4 px-6 bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700 text-white rounded-xl font-semibold text-base transition-all shadow-lg"
          >
            Get My Report — $19
          </button>
        </div>
      </div>
    </div>
  )
}
