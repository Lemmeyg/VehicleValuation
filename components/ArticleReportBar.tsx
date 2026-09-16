'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import {
  trackEvent,
  trackFormSubmission,
  trackReportWorkflow,
  trackEmailCapture,
  getPostHogDistinctId,
} from '@/lib/analytics/events'
import { getKBAttribution } from '@/lib/analytics/kb-attribution'
import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'
import { MarketingConsentNotice } from '@/components/MarketingConsentNotice'

interface ArticleReportBarProps {
  articleSlug: string
  placement: 'post_toc' | 'post_faq_2' | 'fallback_mid'
}

export function ArticleReportBar({ articleSlug, placement }: ArticleReportBarProps) {
  const router = useRouter()

  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const hasTrackedFormStart = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasTrackedImpression = useRef(false)

  const trackFormStart = () => {
    if (!hasTrackedFormStart.current) {
      hasTrackedFormStart.current = true
      trackReportWorkflow({
        step: 'article_bar_form_started',
        kb_source_slug: articleSlug,
      })
    }
  }

  // Fire once when the bar first enters the viewport. Without this we can count
  // how many people typed in the form but not how many ever saw it, which makes
  // the KB-to-report conversion rate unmeasurable.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true
          trackEvent('kb_article_report_bar_viewed', {
            article_slug: articleSlug,
            placement,
          })
          observer.disconnect()
        }
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [articleSlug, placement])

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
    trackEmailCapture({ form: 'kb_article_bar', action: 'submitted' })

    // Create the report server-side now, at submit time — not later when the
    // pricing page happens to load. Same single write path as Hero.tsx.
    const phDistinctId = getPostHogDistinctId()

    try {
      const response = await fetch('/api/reports/create-anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: sanitized,
          mileage: mileageNum,
          zipCode,
          email: sanitizedEmail,
          source: 'kb_article',
          kbSourceSlug: articleSlug,
          // BL-125: lets the server-side download event find this same person
          ...(phDistinctId && { posthogDistinctId: phDistinctId }),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to create report. Please try again.')
        setLoading(false)
        return
      }

      sessionStorage.setItem('pending_report', JSON.stringify(result.report))
      router.push('/pricing')
    } catch (err) {
      console.error('[ArticleReportBar] Failed to create report:', err)
      setError('Failed to create report. Please try again.')
      setLoading(false)
    }
  }

  const isSubmittable =
    vin.length === 17 &&
    mileage.length > 0 &&
    zipCode.length === 5 &&
    !getEmailValidationError(email)

  return (
    <div ref={containerRef} className="my-8 rounded-2xl bg-primary-600 px-6 py-5">
      {/* Headline + subhead */}
      <div className="mb-3.5">
        <p className="text-[19px] font-bold leading-tight text-white">
          Now get your car&apos;s independent, evidence-backed valuation.
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-white/80">
          Enter your VIN to get your car&apos;s value based on a database of over 450M+ real
          listings, with 10 VIN-matched, geographically comparable listings to back up your
          valuation — in a report built to hand your adjuster.
        </p>
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
          <MarketingConsentNotice variant="dark" />
          <button
            type="submit"
            disabled={!isSubmittable || loading}
            className="flex h-[38px] flex-shrink-0 items-center gap-1.5 rounded-lg bg-white px-5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Starting...' : 'Get my valuation →'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && <p className="mt-2 text-sm font-medium text-white/90">{error}</p>}
    </div>
  )
}
