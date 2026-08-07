'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/events'
import { getPersonalizedVehicleLabel } from '@/lib/personalization/vehicle-label'

interface ExitIntentPopupProps {
  vin: string
  reportId: string
  vehicleYear?: number
  vehicleMake?: string
  vehicleModel?: string
  onSelectPlan: (discountCode: string) => void
}

// Hardcoded rather than env-var-driven on purpose: this must always match a real,
// active LemonSqueezy coupon (currently STAY15, Basic-tier only). A misconfigured
// or stale env var previously pointed this at a nonexistent code ("Stay19"),
// silently breaking every discounted checkout attempt with a 422 from LemonSqueezy
// that the user never saw any feedback for.
const DISCOUNT_CODE = 'STAY15'

export default function ExitIntentPopup({
  vin,
  reportId,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  onSelectPlan,
}: ExitIntentPopupProps) {
  const [visible, setVisible] = useState(false)
  const pendingHrefRef = useRef<string | null>(null)
  const isBackButtonRef = useRef(false)
  const hasTriggeredRef = useRef(false)
  const router = useRouter()

  const vehicleLabel =
    vehicleYear && vehicleMake && vehicleModel
      ? getPersonalizedVehicleLabel({ year: vehicleYear, make: vehicleMake, model: vehicleModel })
      : null

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
      // stopPropagation in capture phase prevents the event reaching React entirely,
      // so Next.js Link's onClick (which calls router.push()) never fires.
      e.stopPropagation()
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

    // Classic desktop exit-intent: the cursor leaving through the top of the
    // viewport (toward the tab bar / address bar / window close button) is the
    // strongest available signal of "about to leave," and doesn't depend on the
    // user happening to click an internal link first. clientY <= 0 catches the
    // cursor crossing the top edge; !relatedTarget confirms it left the document
    // entirely rather than moving onto a child element (mouseout fires for both).
    // No mobile equivalent exists — touch devices have no hover cursor to leave
    // "toward," so the click/back-button triggers above remain the only signal there.
    const handleMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) {
        pendingHrefRef.current = null
        isBackButtonRef.current = false
        showPopup()
      }
    }

    document.addEventListener('click', handleClick, { capture: true })
    document.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('popstate', handlePopState)
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
      document.removeEventListener('mouseout', handleMouseOut)
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
          {vehicleLabel ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Before you go — your {vehicleLabel} may be undervalued by your insurer.
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Industry data shows 9 out of 10 total-loss claims are undervalued. Our report gives
                you 10 comparable sales to fight back.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Before you go — your insurance company doesn&apos;t want you to have this.
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                The average settlement gap is $2,800. Don&apos;t leave without the data to fight
                back.
              </p>
            </>
          )}

          <button
            onClick={handleCTA}
            className="w-full py-4 px-6 bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700 text-white rounded-xl font-semibold text-base transition-all shadow-lg"
          >
            Get My Report — $15
          </button>

          <button
            onClick={handleDismiss}
            className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
          >
            No thanks, I&apos;ll take what the insurance company offers
          </button>
        </div>
      </div>
    </div>
  )
}
