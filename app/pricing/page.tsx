'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Check, CheckCircle2, Quote, ShieldCheck, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import ReportPreviewCondensed from '@/components/ReportPreviewCondensed'
import ExitIntentPopup from '@/components/ExitIntentPopup'
import {
  trackReportWorkflow,
  trackPaymentInitiated,
  trackButtonClick,
  trackCheckoutInitiated,
  trackCheckoutAbandoned,
  trackEvent,
} from '@/lib/analytics/events'
import { trackRedditViewContent, trackRedditAddToCart } from '@/lib/analytics/reddit-events'
import { getKBAttribution } from '@/lib/analytics/kb-attribution'
import { setDripAttribution, getDripAttribution } from '@/lib/analytics/drip-attribution'
import { getPersonalizedVehicleLabel } from '@/lib/personalization/vehicle-label'
import { PRICING_TIERS, TESTIMONIALS, WHATS_INCLUDED } from '@/lib/pricing/constants'
import MobilePricingView from '@/components/pricing/MobilePricingView'

interface Report {
  id: string
  vin: string
  mileage: number
  zip_code: string
  email?: string
  dealer_type: string
  vehicle_data: {
    year: number
    make: string
    model: string
    trim?: string
  }
  marketcheck_valuation: {
    predictedPrice: number
    priceRange: {
      low: number
      high: number
    }
    comparables: Array<{
      year: number
      make: string
      model: string
      trim: string
      mileage: number
      price: number
      location: {
        city: string
        state: string
        zipCode: string
      }
      distance: number
    }>
    totalComparablesFound: number
  }
}

function PricingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get data from URL params (legacy support for existing reportId flow)
  const reportId = searchParams?.get('reportId')

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alreadyPurchased, setAlreadyPurchased] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [showBetaModal, setShowBetaModal] = useState(false)
  const [showExistingUserModal, setShowExistingUserModal] = useState(false)
  const [showReportPreview, setShowReportPreview] = useState(false)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkError, setMagicLinkError] = useState('')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // Use ref to track initialization across StrictMode double-mounting
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    // Only initialize once, even in React StrictMode which mounts components twice
    if (hasInitializedRef.current) {
      console.log('[PricingPage] Already initialized, skipping duplicate initialization')
      return
    }

    console.log('[PricingPage] First initialization')
    hasInitializedRef.current = true
    initializePricingPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initializePricingPage = async () => {
    const utmSource = searchParams?.get('utm_source')
    const utmMedium = searchParams?.get('utm_medium')
    const utmContent = searchParams?.get('utm_content')
    if (utmSource && utmMedium && utmContent) {
      setDripAttribution(utmSource, utmMedium, utmContent)
    }

    // Option A: Existing reportId flow (authenticated users with existing report)
    if (reportId) {
      await fetchExistingReport(reportId)
      return
    }

    // Option B: report was already created server-side at form-submit time
    // (Hero.tsx / ArticleReportBar.tsx) — this is a same-tab sessionStorage
    // hand-off, not a fresh create-anonymous call.
    const pendingReport = sessionStorage.getItem('pending_report')
    if (pendingReport) {
      try {
        const rawReport = JSON.parse(pendingReport)
        sessionStorage.removeItem('pending_report')
        hydrateReportFromCreateResponse(rawReport)
        return
      } catch (err) {
        console.error('[PricingPage] pending_report parse error:', err)
      }
    }

    // No data found - redirect to homepage
    setError('No vehicle data found. Please submit the form on the homepage.')
    setLoading(false)
    setTimeout(() => {
      router.push('/')
    }, 3000)
  }

  const hydrateReportFromCreateResponse = (rawReport: {
    id: string
    vin: string
    mileage: number
    zip_code: string
    vehicle_data: { year: string | number; make: string; model: string; trim?: string } | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marketcheck_valuation: any
  }) => {
    // create-anonymous returns snake_case with a flat vehicle_data shape
    const reportData: Report = {
      id: rawReport.id,
      vin: rawReport.vin,
      mileage: rawReport.mileage,
      zip_code: rawReport.zip_code,
      dealer_type: 'private',
      vehicle_data: rawReport.vehicle_data
        ? {
            year: parseInt(String(rawReport.vehicle_data.year || '0')),
            make: rawReport.vehicle_data.make || '',
            model: rawReport.vehicle_data.model || '',
            trim: rawReport.vehicle_data.trim,
          }
        : { year: 0, make: '', model: '' },
      marketcheck_valuation: rawReport.marketcheck_valuation,
    }

    setReport(reportData)
    sessionStorage.setItem('current_report_id', reportData.id)

    trackReportWorkflow({
      step: 'report_created',
      reportId: reportData.id,
      vehicleYear: reportData.vehicle_data?.year,
      vehicleMake: reportData.vehicle_data?.make,
      vehicleModel: reportData.vehicle_data?.model,
    })
    const kbAttr = getKBAttribution()
    const dripAttr = getDripAttribution()
    trackReportWorkflow({
      step: 'pricing_viewed',
      reportId: reportData.id,
      ...(kbAttr && {
        kb_source_slug: kbAttr.slug,
        kb_source_title: kbAttr.title,
        kb_source_visited_at: kbAttr.visited_at,
      }),
      ...(dripAttr && {
        drip_utm_source: dripAttr.utm_source,
        drip_utm_medium: dripAttr.utm_medium,
        drip_utm_content: dripAttr.utm_content,
      }),
    })
    trackRedditViewContent()

    setLoading(false)
  }

  const fetchExistingReport = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/${id}/preview`)
      const data = await response.json()

      if (response.ok && data.alreadyPurchased) {
        setAlreadyPurchased(true)
      } else if (response.ok) {
        setReport(data.report)
        // Track pricing page view for existing report
        const kbAttr = getKBAttribution()
        const dripAttr = getDripAttribution()
        trackReportWorkflow({
          step: 'pricing_viewed',
          reportId: id,
          ...(kbAttr && {
            kb_source_slug: kbAttr.slug,
            kb_source_title: kbAttr.title,
            kb_source_visited_at: kbAttr.visited_at,
          }),
          ...(dripAttr && {
            drip_utm_source: dripAttr.utm_source,
            drip_utm_medium: dripAttr.utm_medium,
            drip_utm_content: dripAttr.utm_content,
          }),
        })
        trackRedditViewContent()
      } else {
        setError(data.error || 'Failed to load report')
      }
    } catch (err) {
      console.error('Error fetching report:', err)
      setError('An error occurred while loading the report')
    } finally {
      setLoading(false)
    }
  }

  const sendMagicLink = async () => {
    if (!report?.email) {
      console.error('No email available for magic link')
      return
    }

    setSendingMagicLink(true)
    setMagicLinkError('') // Clear previous errors

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: report.email,
          reportId: report.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMagicLinkSent(true)
        setMagicLinkError('')
      } else {
        console.error('Magic link error:', data.error)
        setMagicLinkError(data.error || 'Failed to send magic link')
        setMagicLinkSent(false)
      }
    } catch (err) {
      console.error('Failed to send magic link:', err)
      setMagicLinkError('Network error. Please check your connection.')
      setMagicLinkSent(false)
    } finally {
      setSendingMagicLink(false)
    }
  }

  /**
   * Fetch MarketCheck data when user confirms on pricing page
   */
  const fetchMarketCheckData = async () => {
    if (!report?.id) {
      toast.error('Report not found')
      return
    }

    const loadingToast = toast.loading('Fetching market valuation data...')

    try {
      const response = await fetch(`/api/reports/${report.id}/fetch-marketcheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch market data')
      }

      toast.success('Market valuation data fetched successfully!', {
        id: loadingToast,
      })

      // Update report state with new data
      if (report) {
        setReport({
          ...report,
          marketcheck_valuation: data.data,
          valuation_result: {
            predictedPrice: data.data.predictedPrice,
            lowValue: data.data.priceRange?.min || Math.round(data.data.predictedPrice * 0.9),
            averageValue: data.data.predictedPrice,
            highValue: data.data.priceRange?.max || Math.round(data.data.predictedPrice * 1.1),
            confidence: data.data.confidence,
            dataPoints: data.data.totalComparablesFound,
            dataSource: 'marketcheck',
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      }

      // Show success modal for beta users
      setShowBetaModal(true)
    } catch (error) {
      console.error('Error fetching MarketCheck data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch market data', {
        id: loadingToast,
      })
    }
  }

  const handleSelectPlan = async (tier: (typeof PRICING_TIERS)[0], discountCode?: string) => {
    if (!report) return

    // Track checkout initiation before any processing
    const kbAttrCheckout = getKBAttribution()
    const dripAttrCheckout = getDripAttribution()
    trackCheckoutInitiated({
      reportId: report.id,
      plan: tier.id.toLowerCase() as 'basic' | 'premium',
      price: tier.price,
      isBetaMode:
        !process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID ||
        process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID.includes('your-'),
      ...(kbAttrCheckout && {
        kb_source_slug: kbAttrCheckout.slug,
        kb_source_title: kbAttrCheckout.title,
        kb_source_visited_at: kbAttrCheckout.visited_at,
      }),
      ...(dripAttrCheckout && {
        drip_utm_source: dripAttrCheckout.utm_source,
        drip_utm_medium: dripAttrCheckout.utm_medium,
        drip_utm_content: dripAttrCheckout.utm_content,
      }),
    })

    // Track plan selection
    trackReportWorkflow({
      step: 'plan_selected',
      reportId: report.id,
      planType: tier.id.toLowerCase() as 'basic' | 'premium',
      vehicleYear: report.vehicle_data?.year,
      vehicleMake: report.vehicle_data?.make,
      vehicleModel: report.vehicle_data?.model,
    })
    trackButtonClick(`select_${tier.id.toLowerCase()}_plan`, {
      reportId: report.id,
      price: tier.price,
    })

    // Reddit Pixel: track plan selection as AddToCart
    trackRedditAddToCart({
      itemCount: 1,
      value: tier.price,
      currency: 'USD',
    })

    // BETA MODE: Skip payment and show beta modal
    // Check if variant IDs are placeholder values or missing
    const basicVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID
    const premiumVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID

    const isBetaMode =
      !basicVariantId ||
      !premiumVariantId ||
      basicVariantId.includes('your-') ||
      premiumVariantId.includes('your-') ||
      basicVariantId === 'your-basic-variant-id-here' ||
      premiumVariantId === 'your-premium-variant-id-here'

    if (isBetaMode) {
      console.log('[PricingPage] Beta mode detected')

      // Check if user is authenticated
      try {
        const sessionResponse = await fetch('/api/auth/session')
        const sessionData = await sessionResponse.json()

        console.log('[PricingPage] Session check:', {
          hasUser: !!sessionData.user,
          email: sessionData.user?.email,
          reportId: report.id,
        })

        // If user is authenticated (logged in existing user)
        if (sessionData.user) {
          console.log(
            '[PricingPage] Authenticated existing user - checking for existing MarketCheck data'
          )

          // FIX #1: Only fetch if data doesn't exist (prevents duplicate API calls)
          if (!report.marketcheck_valuation) {
            console.log('[PricingPage] No existing MarketCheck data, fetching from API')
            await fetchMarketCheckData()
          } else {
            console.log(
              '[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge'
            )
          }

          setShowExistingUserModal(true)
          return
        }

        // For anonymous users: Fetch MarketCheck data, then show beta modal with magic link
        console.log('[PricingPage] Anonymous user - checking for existing MarketCheck data')

        // FIX #2: Only fetch if data doesn't exist (prevents duplicate API calls)
        if (!report.marketcheck_valuation) {
          console.log('[PricingPage] No existing MarketCheck data, fetching from API')
          await fetchMarketCheckData()
        } else {
          console.log(
            '[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge'
          )
        }

        // Magic link is sent automatically after MarketCheck success
        sendMagicLink()
        return
      } catch (err) {
        console.error('[PricingPage] Error checking session:', err)

        // FIX #3: Only fetch if data doesn't exist (prevents duplicate API calls in error scenarios)
        if (!report.marketcheck_valuation) {
          console.log('[PricingPage] Error fallback - fetching MarketCheck data')
          await fetchMarketCheckData()
        } else {
          console.log(
            '[PricingPage] Error fallback - MarketCheck data already exists, skipping API call'
          )
        }

        sendMagicLink()
        return
      }
    }

    setProcessingPayment(true)

    // Track payment initiation
    const kbAttrPayment = getKBAttribution()
    const dripAttrPayment = getDripAttribution()
    trackPaymentInitiated({
      plan: tier.id.toLowerCase() as 'basic' | 'premium',
      amount: tier.price,
      currency: 'USD',
      paymentProcessor: 'lemonsqueezy',
      variantId: tier.variantId,
      ...(kbAttrPayment && {
        kb_source_slug: kbAttrPayment.slug,
        kb_source_title: kbAttrPayment.title,
        kb_source_visited_at: kbAttrPayment.visited_at,
      }),
      ...(dripAttrPayment && {
        drip_utm_source: dripAttrPayment.utm_source,
        drip_utm_medium: dripAttrPayment.utm_medium,
        drip_utm_content: dripAttrPayment.utm_content,
      }),
    })

    try {
      // Call Lemon Squeezy checkout endpoint
      const response = await fetch('/api/lemonsqueezy/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          reportType: tier.id,
          ...(discountCode ? { discountCode } : {}),
        }),
      })

      const data = await response.json()

      if (data.checkoutUrl) {
        // Redirect to Lemon Squeezy payment
        window.location.href = data.checkoutUrl
      } else {
        setError(data.error || 'Failed to create checkout session')
        setProcessingPayment(false)
        trackCheckoutAbandoned({
          reportId: report.id,
          plan: tier.id.toLowerCase() as 'basic' | 'premium',
          price: tier.price,
          step: 'api_error',
          error: data.error || 'No checkout URL returned',
        })
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError('An error occurred while processing payment')
      setProcessingPayment(false)
      trackCheckoutAbandoned({
        reportId: report.id,
        plan: tier.id.toLowerCase() as 'basic' | 'premium',
        price: tier.price,
        step: 'api_error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="sr-only">Get Your Total Loss Vehicle Valuation Report</h1>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading your vehicle data...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (alreadyPurchased) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="sr-only">Get Your Total Loss Vehicle Valuation Report</h1>
              <p className="text-slate-700 mb-4">
                You&apos;ve already purchased this report. Check your email for the download link.
              </p>
              <Button onClick={() => router.push('/')}>Return to Homepage</Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="sr-only">Get Your Total Loss Vehicle Valuation Report</h1>
              <p className="text-red-600 mb-4">{error || 'Report not found'}</p>
              <Button onClick={() => router.push('/')}>Return to Homepage</Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="hidden md:block">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero Headline */}
            <div className="text-center mb-6">
              {(() => {
                const vehicleLabel = getPersonalizedVehicleLabel(report.vehicle_data)
                return vehicleLabel ? (
                  <>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                      Your {vehicleLabel} may be undervalued by your insurer.
                    </h1>
                    <p className="text-slate-600 text-base max-w-xl mx-auto">
                      Industry data shows 9 out of 10 total-loss claims are undervalued by insurers
                      — most owners never push back. Our report gives you 10 real comparable sales
                      to dispute your carrier&apos;s number and recover what you&apos;re owed.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                      Get Paid What Your Vehicle Is Worth
                    </h1>
                    <p className="text-slate-600 text-base max-w-xl mx-auto">
                      Industry data shows 9 out of 10 total-loss claims are undervalued by insurers.
                      Our report gives you 10 real comparable sales to dispute the number and
                      recover what you&apos;re owed.
                    </p>
                  </>
                )
              })()}
            </div>

            {/* Stat Strip */}
            <div className="grid grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
                <p className="text-2xl font-bold text-primary-600">9/10</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Claims undervalued by insurers
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
                <p className="text-2xl font-bold text-primary-600">34%</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Average settlement increase
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
                <p className="text-2xl font-bold text-primary-600">90</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Days to dispute your offer
                </p>
              </div>
            </div>

            {/* Social Proof Quotes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {TESTIMONIALS.map((t, i) => (
                <blockquote
                  key={i}
                  className="bg-white border-l-4 border-primary-500 pl-5 py-4 pr-5 rounded-r-xl shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <Quote className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-700 italic text-sm leading-relaxed mb-2">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 not-italic">{t.attribution}</p>
                        <span className="text-sm font-bold text-emerald-600 not-italic ml-3 whitespace-nowrap">
                          {t.outcome}
                        </span>
                      </div>
                    </div>
                  </div>
                </blockquote>
              ))}
            </div>

            {/* What's Included */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-4 text-center">
                What&apos;s in your report
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WHATS_INCLUDED.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="mb-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                  Choose Your Report
                </h2>
                <p className="text-sm text-slate-500">
                  One-time payment · Instant access · 100% satisfaction guarantee
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Already have an account?{' '}
                  <a href="/auth" className="text-primary-600 hover:underline">
                    Sign in
                  </a>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PRICING_TIERS.map(tier => {
                  const isExpanded = expandedCard === tier.id
                  return (
                    <div
                      key={tier.id}
                      className={`relative rounded-2xl shadow-lg border-2 transition-all ${
                        tier.recommended
                          ? 'bg-gradient-to-br from-primary-50 to-emerald-50 border-primary-500 shadow-primary-100'
                          : 'bg-white border-slate-200 hover:border-primary-300'
                      }`}
                    >
                      {tier.recommended && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-primary-600 to-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg inline-block whitespace-nowrap">
                            Recommended
                          </span>
                        </div>
                      )}

                      {/* Card header — always visible */}
                      <div className="p-6 pb-4">
                        <div className="flex items-center justify-between md:justify-center md:flex-col md:text-center">
                          <div className="md:mb-3">
                            <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                            <div className="flex items-baseline gap-1 mt-1 md:justify-center">
                              <span className="text-4xl font-bold text-slate-900">
                                ${tier.price}
                              </span>
                              <span className="text-slate-400 text-sm">one-time</span>
                            </div>
                          </div>

                          {/* Mobile expand toggle */}
                          <button
                            className="md:hidden flex items-center gap-1 text-sm text-primary-600 font-medium"
                            onClick={() => setExpandedCard(isExpanded ? null : tier.id)}
                          >
                            {isExpanded ? 'Hide' : 'See'} details
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>

                        {/* CTA button — always visible */}
                        <Button
                          onClick={() => handleSelectPlan(tier)}
                          disabled={processingPayment}
                          className={`w-full mt-4 py-5 text-base font-semibold ${
                            tier.recommended
                              ? 'bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700'
                              : 'bg-slate-900 hover:bg-slate-800'
                          }`}
                        >
                          {processingPayment
                            ? 'Processing...'
                            : `Get ${tier.name} — $${tier.price}`}
                        </Button>
                      </div>

                      {/* Feature list — always visible on desktop, accordion on mobile */}
                      <div className={`px-6 pb-6 ${isExpanded ? 'block' : 'hidden'} md:block`}>
                        <ul className="space-y-2.5 pt-3 border-t border-slate-100">
                          {tier.features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                              <Check className="h-4 w-4 text-emerald-500 mr-2.5 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-600 text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {tier.recommended && (
                          <div className="mt-4 flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2.5">
                            <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                            <span className="text-sm font-semibold">Money-Back Guarantee</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Money-Back Guarantee Banner */}
            <div className="mb-8">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-shrink-0">
                  <ShieldCheck className="h-10 w-10 text-emerald-600" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-slate-900 text-base mb-1">
                    90-Day Money-Back Guarantee — Premium Report
                  </h3>
                  <p className="text-sm text-slate-600">
                    If your settlement offer doesn&apos;t increase after using our Premium Report,
                    we&apos;ll refund you in full — no questions asked within 90 days.
                  </p>
                </div>
                <a
                  href="/guarantee"
                  className="flex-shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors"
                >
                  Full terms →
                </a>
              </div>
            </div>

            {/* Report Preview Toggle */}
            <div className="mb-8">
              <button
                onClick={() => {
                  const next = !showReportPreview
                  setShowReportPreview(next)
                  if (next) {
                    trackEvent('report_preview_viewed', { reportId: report?.id })
                  }
                }}
                className="w-full flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-primary-300 hover:shadow-md transition-all group"
              >
                <span className="font-semibold text-slate-800 group-hover:text-primary-700 transition-colors">
                  See what&apos;s inside your report
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
                    showReportPreview ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showReportPreview && (
                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <ReportPreviewCondensed />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6">
          <MobilePricingView
            vehicleData={report.vehicle_data}
            tiers={PRICING_TIERS}
            onSelectPlan={handleSelectPlan}
            processingPayment={processingPayment}
          />
        </div>
      </main>

      <Footer />

      {/* Beta Mode Modal - For Anonymous Users */}
      {showBetaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowBetaModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 p-3">
                <svg
                  className="h-12 w-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Great News - This Report is FREE!
              </h2>
              <p className="text-lg text-slate-700 mb-4">
                We&apos;re currently in beta, so all reports are completely free. Get the same
                professional-grade valuation that increases settlements by 34% on average.
              </p>

              {/* Email Verification Notice */}
              {magicLinkError ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-left mb-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-900 mb-1">
                        Unable to Send Email
                      </p>
                      <p className="text-sm text-red-800">{magicLinkError}</p>
                      <button
                        onClick={sendMagicLink}
                        disabled={sendingMagicLink}
                        className="text-xs text-red-700 mt-2 underline hover:text-red-900 font-medium"
                      >
                        {sendingMagicLink ? 'Trying again...' : 'Try again'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-left mb-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        {magicLinkSent ? 'Check Your Email!' : 'Sending Verification Email...'}
                      </p>
                      <p className="text-sm text-blue-800">
                        {magicLinkSent ? (
                          <>
                            We&apos;ve sent a secure login link to <strong>{report?.email}</strong>.
                            Click the link in your email to verify your account and access your free
                            report.
                          </>
                        ) : (
                          'Please wait while we send your verification email...'
                        )}
                      </p>
                      {magicLinkSent && (
                        <p className="text-xs text-blue-700 mt-2">
                          Don&apos;t see the email? Check your spam folder or{' '}
                          <button
                            onClick={sendMagicLink}
                            disabled={sendingMagicLink}
                            className="underline hover:text-blue-900 font-medium"
                          >
                            {sendingMagicLink ? 'Sending...' : 'resend'}
                          </button>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded text-left">
                <p className="text-sm text-emerald-800">
                  <strong>Your independent valuation includes:</strong>
                </p>
                <ul className="text-sm text-emerald-800 mt-2 space-y-1 ml-4 list-disc">
                  <li>Dual independent price predictions (CarsXE + MarketCheck)</li>
                  <li>10 comparable vehicles with full market data</li>
                  <li>Complete vehicle history and specifications</li>
                  <li>Professional PDF report for insurance negotiations</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowBetaModal(false)}
                className="w-full py-4 px-6 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-slate-500 text-center mt-4">
              Help us improve by providing feedback on your experience
            </p>
          </div>
        </div>
      )}

      {/* Existing User Modal - For Authenticated Users */}
      {showExistingUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowExistingUserModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 p-3">
                <svg
                  className="h-12 w-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Congratulations - your Report is Free!
              </h2>
              <p className="text-lg text-slate-700 mb-4">
                While this tool is in Beta, your professional-grade independent valuation comes at
                no cost to you.
              </p>

              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded text-left">
                <p className="text-sm text-emerald-800">
                  <strong>Your independent valuation includes:</strong>
                </p>
                <ul className="text-sm text-emerald-800 mt-2 space-y-1 ml-4 list-disc">
                  <li>10 Comparable vehicles &quot;Comps&quot; listings</li>
                  <li>Market insights using all comps found within 100 miles</li>
                  <li>
                    Professional PDF Report with detailed guide for factors impacting your vehicle
                    value
                  </li>
                </ul>
                <p className="text-sm text-emerald-800 mt-3">
                  All items designed to help you with your insurance negotiations
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push(`/reports/${report.id}/view`)}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg"
              >
                View Report
              </button>
              <button
                onClick={() => setShowExistingUserModal(false)}
                className="w-full py-3 px-6 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-slate-500 text-center mt-4">
              Thank you for being a valued member!
            </p>
          </div>
        </div>
      )}
      <ExitIntentPopup
        vin={report.vin}
        reportId={report.id}
        vehicleYear={report.vehicle_data?.year}
        vehicleMake={report.vehicle_data?.make}
        vehicleModel={report.vehicle_data?.model}
        onSelectPlan={discountCode => handleSelectPlan(PRICING_TIERS[0], discountCode)}
      />
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  )
}
