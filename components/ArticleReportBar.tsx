'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import { trackEvent } from '@/lib/analytics/events'
import AuthModal from './AuthModal'

interface ArticleReportBarProps {
  articleSlug: string
  placement: 'post_toc' | 'post_faq_2'
}

const VALUE_PROPS = [
  '10 Real Comps — Verified, Local, Same Year / Make / Model',
  'Save hours searching sites for "close enough" listings',
  '100% Money Back Guarantee',
  "Professional Report to counter your carrier's lowball offer",
  'Hundreds of thousands of comparable vehicles in our database',
]

const TICKER_INTERVAL = 3500

export function ArticleReportBar({ articleSlug, placement }: ArticleReportBarProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [tickerIndex, setTickerIndex] = useState(0)

  // Keep form values accessible inside the auth success callback
  const formRef = useRef({ vin, mileage, zipCode })
  useEffect(() => {
    formRef.current = { vin, mileage, zipCode }
  }, [vin, mileage, zipCode])

  // Ticker animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex(i => (i + 1) % VALUE_PROPS.length)
    }, TICKER_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      setError('')
    }
  }

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMileage(e.target.value.replace(/\D/g, ''))
    setError('')
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))
    setError('')
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')

    if (!user) {
      setShowAuthModal(true)
      return
    }

    const { vin: currentVin, mileage: currentMileage, zipCode: currentZip } = formRef.current

    const sanitized = sanitizeVin(currentVin)
    const vinError = getVinValidationError(sanitized)
    if (vinError) {
      setError(vinError)
      return
    }

    const mileageNum = parseInt(currentMileage)
    if (isNaN(mileageNum) || mileageNum < 0 || mileageNum > 999999) {
      setError('Please enter a valid mileage between 0 and 999,999')
      return
    }

    if (currentZip.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code')
      return
    }

    setLoading(true)

    trackEvent('kb_article_report_bar_clicked', {
      article_slug: articleSlug,
      placement,
    })

    try {
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: sanitized, mileage: mileageNum, zipCode: currentZip }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create report')
        return
      }

      router.push(`/pricing?reportId=${data.report.id}`)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    const { vin: v, mileage: m, zipCode: z } = formRef.current
    if (v.length === 17 && m && z.length === 5) {
      handleSubmit()
    }
  }

  const isSubmittable = vin.length === 17 && mileage.length > 0 && zipCode.length === 5

  return (
    <div className="my-8 rounded-2xl bg-primary-600 px-6 py-5">
      {/* Value prop ticker */}
      <div className="mb-3 overflow-hidden" style={{ height: '28px' }}>
        <div
          className="flex flex-col transition-transform duration-500 ease-in-out"
          style={{ transform: `translateY(-${tickerIndex * 28}px)` }}
        >
          {VALUE_PROPS.map((prop, i) => (
            <div key={i} className="flex items-center gap-2.5" style={{ height: '28px' }}>
              <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/50" />
              <span className="text-[17px] font-bold leading-none text-white">{prop}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="mb-3 flex gap-1.5">
        {VALUE_PROPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
              i === tickerIndex ? 'scale-125 bg-white/90' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2.5">
        <div className="min-w-[110px] flex-1">
          <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-white/80">
            VIN
          </label>
          <input
            type="text"
            value={vin}
            onChange={handleVinChange}
            placeholder="1HGCM82633A123456"
            maxLength={17}
            className="w-full rounded-lg border-none bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
        <div className="min-w-[110px] flex-1">
          <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-white/80">
            Mileage
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={mileage}
            onChange={handleMileageChange}
            placeholder="e.g., 42,000"
            className="w-full rounded-lg border-none bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
        <div className="min-w-[110px] flex-1">
          <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-white/80">
            ZIP Code
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={zipCode}
            onChange={handleZipCodeChange}
            placeholder="e.g., 90210"
            maxLength={5}
            className="w-full rounded-lg border-none bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
        <button
          type="submit"
          disabled={!isSubmittable || loading}
          className="flex h-[38px] flex-shrink-0 items-center gap-1.5 self-end rounded-lg bg-white px-5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Starting...' : 'Get My Independent Valuation →'}
        </button>
      </form>

      {/* Error */}
      {error && <p className="mt-2 text-sm font-medium text-white/90">{error}</p>}

      {/* Footnote */}
      <p className="mt-2.5 text-[11px] text-white/55">
        Takes 60 seconds &bull; Independent of your insurer &bull; Professional PDF report
      </p>

      {/* Auth modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
}
