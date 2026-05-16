'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const pendingHrefRef = useRef<string | null>(null)
  const isBackButtonRef = useRef(false)
  const hasTriggeredRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    history.pushState(null, '', window.location.href)

    const showPopup = () => {
      if (hasTriggeredRef.current) return
      if (sessionStorage.getItem('exit_popup_shown')) return
      hasTriggeredRef.current = true
      sessionStorage.setItem('exit_popup_shown', 'true')
      setVisible(true)
      trackEvent('exit_intent_popup_shown', { reportId, vin })
    }

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      let target = e.target as HTMLElement | null
      while (target && target.tagName !== 'A') {
        target = target.parentElement
      }
      if (!target) return
      const anchor = target as HTMLAnchorElement
      if (anchor.closest('[data-buy-cta]')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      e.preventDefault()
      pendingHrefRef.current = href
      isBackButtonRef.current = false
      showPopup()
    }

    const handlePopState = () => {
      isBackButtonRef.current = true
      pendingHrefRef.current = null
      history.pushState(null, '', window.location.href)
      showPopup()
    }

    document.addEventListener('click', handleClick, { capture: true })
    window.addEventListener('popstate', handlePopState)
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
      window.removeEventListener('popstate', handlePopState)
    }
  }, [vin, reportId])

  const handleDismiss = () => {
    setVisible(false)
    trackEvent('exit_intent_popup_dismissed', { reportId, vin })
    if (isBackButtonRef.current) {
      router.back()
    } else if (pendingHrefRef.current) {
      router.push(pendingHrefRef.current)
    }
  }

  const handleCTA = () => {
    trackEvent('exit_intent_popup_converted', { reportId, vin })
    onSelectPlan(DISCOUNT_CODE)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      data-testid="popup-backdrop"
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
            Before you go — your insurance company doesn&apos;t want you to have this.
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            The average settlement gap is $2,800. Don&apos;t leave without the data to fight back.
          </p>

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
