'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import {
  trackEvent,
  trackFormSubmission,
  trackReportWorkflow,
  trackEmailCapture,
} from '@/lib/analytics/events'
import { getKBAttribution } from '@/lib/analytics/kb-attribution'
import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'

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

  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tickerIndex, setTickerIndex] = useState(0)

  const hasTrackedFormStart = useRef(false)

  const trackFormStart = () => {
    if (!hasTrackedFormStart.current) {
      hasTrackedFormStart.current = true
      trackReportWorkflow({
        step: 'article_bar_form_started',
        kb_source_slug: articleSlug,
      })
    }
  }

  // Ticker animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex(i => (i + 1) % VALUE_PROPS.length)
    }, TICKER_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      setError('')
    }
  }

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    setMileage(e.target.value.replace(/\D/g, ''))
    setError('')
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))
    setError('')
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setError('')
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')

    const sanitized = sanitizeVin(vin)
    const vinError = getVinValidationError(sanitized)
    if (vinError) {
      setError(vinError)
      trackFormSubmission('article_report_bar', { success: false, error: 'invalid_vin' })
      return
    }

    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum) || mileageNum < 0 || mileageNum > 999999) {
      setError('Please enter a valid mileage between 0 and 999,999')
      trackFormSubmission('article_report_bar', { success: false, error: 'invalid_mileage' })
      return
    }

    if (zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code')
      trackFormSubmission('article_report_bar', { success: false, error: 'invalid_zip' })
      return
    }

    const emailError = getEmailValidationError(email)
    if (emailError) {
      setError(emailError)
      trackFormSubmission('article_report_bar', { success: false, error: 'invalid_email' })
      return
    }

    setLoading(true)

    trackEvent('kb_article_report_bar_clicked', {
      article_slug: articleSlug,
      placement,
    })

    const kbAttr = getKBAttribution()
    trackFormSubmission('article_report_bar', { success: true })
    trackReportWorkflow({
      step: 'article_bar_form_submitted',
      kb_source_slug: articleSlug,
      ...(kbAttr && {
        kb_source_title: kbAttr.title,
        kb_source_visited_at: kbAttr.visited_at,
      }),
    })

    const sanitizedEmail = sanitizeEmail(email)

    // Email capture — fire and forget, non-blocking
    fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sanitizedEmail, source: 'KB report form' }),
    })
    trackEmailCapture({ form: 'kb_article_bar', action: 'submitted' })

    // Store form data for pricing page — same pattern as Hero form, no auth required before purchase
    localStorage.setItem(
      'hero_form_data',
      JSON.stringify({ vin: sanitized, mileage: mileageNum, zipCode, email: sanitizedEmail })
    )
    router.push('/pricing')
  }

  const isSubmittable =
    vin.length === 17 &&
    mileage.length > 0 &&
    zipCode.length === 5 &&
    !getEmailValidationError(email)

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
      <form onSubmit={handleSubmit}>
        {/* Input fields row */}
        <div className="flex flex-wrap gap-2.5 mb-2.5">
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
          <div className="min-w-[140px] flex-1">
            <label
              htmlFor="article-bar-email"
              className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-white/80"
            >
              Email
            </label>
            <input
              type="email"
              id="article-bar-email"
              value={email}
              onChange={handleEmailChange}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full rounded-lg border-none bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        {/* Button + disclaimer row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/55">
            By submitting, you agree to receive occasional emails from TotalLossToolkit.com
          </p>
          <button
            type="submit"
            disabled={!isSubmittable || loading}
            className="flex h-[38px] flex-shrink-0 items-center gap-1.5 rounded-lg bg-white px-5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Starting...' : 'Get My Independent Valuation →'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && <p className="mt-2 text-sm font-medium text-white/90">{error}</p>}
    </div>
  )
}
