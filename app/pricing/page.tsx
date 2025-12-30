'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Check, Car, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const PRICING_TIERS = [
  {
    id: 'BASIC',
    name: 'Basic Report',
    price: 29,
    variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID!,
    features: [
      'Complete Vehicle Specifications',
      'Independent Market Value Range',
      'Dual Price Predictions (CarsXE + MarketCheck)',
      'Essential Vehicle History',
      'Professional PDF Download',
      'Email Support',
    ],
  },
  {
    id: 'PREMIUM',
    name: 'Premium Report',
    price: 49,
    variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID!,
    features: [
      'Everything in Basic Report',
      'Comprehensive Market Analysis',
      '10 Comparable Vehicles with Full Details',
      'Complete Vehicle History Report',
      'Accident & Damage Documentation',
      'Full Service Records',
      'Priority Email & Phone Support',
      'Maximum Negotiation Leverage',
    ],
    recommended: true,
  },
]

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

  // Get data from multiple possible sources
  const reportId = searchParams?.get('reportId')
  const urlEmail = searchParams?.get('email')
  const urlVin = searchParams?.get('vin')
  const urlMileage = searchParams?.get('mileage')
  const urlZipCode = searchParams?.get('zipCode')

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [showBetaModal, setShowBetaModal] = useState(false)
  const [showExistingUserModal, setShowExistingUserModal] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkError, setMagicLinkError] = useState('')

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
    // Option A: Existing reportId flow (authenticated users)
    if (reportId) {
      await fetchExistingReport(reportId)
      return
    }

    // Option B: URL parameters from hero form (new anonymous flow)
    if (urlEmail && urlVin && urlMileage && urlZipCode) {
      await createAnonymousReport({
        email: urlEmail,
        vin: urlVin,
        mileage: parseInt(urlMileage),
        zipCode: urlZipCode,
      })
      return
    }

    // Option C: SessionStorage fallback
    const storedData = sessionStorage.getItem('hero_form_data')
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        await createAnonymousReport(data)
        return
      } catch (err) {
        console.error('SessionStorage parse error:', err)
      }
    }

    // No data found - redirect to homepage
    setError('No vehicle data found. Please submit the form on the homepage.')
    setLoading(false)
    setTimeout(() => {
      router.push('/')
    }, 3000)
  }

  const fetchExistingReport = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/${id}`)
      const data = await response.json()

      if (response.ok) {
        setReport(data.report)
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

  const createAnonymousReport = async (data: {
    email: string
    vin: string
    mileage: number
    zipCode: string
  }) => {
    setCreatingReport(true)
    setLoading(true)

    try {
      const response = await fetch('/api/reports/create-anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to create report')
        setLoading(false)
        setCreatingReport(false)
        return
      }

      setReport(result.report)

      // Store report ID for later reference
      sessionStorage.setItem('current_report_id', result.report.id)

      setLoading(false)
      setCreatingReport(false)
    } catch (err) {
      console.error('Create anonymous report error:', err)
      setError('An unexpected error occurred while creating your report')
      setLoading(false)
      setCreatingReport(false)
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
      })

      // Show success modal for beta users
      setShowBetaModal(true)
    } catch (error) {
      console.error('Error fetching MarketCheck data:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to fetch market data',
        { id: loadingToast }
      )
    }
  }

  const handleSelectPlan = async (tier: typeof PRICING_TIERS[0]) => {
    if (!report) return

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
          console.log('[PricingPage] Authenticated existing user - checking for existing MarketCheck data')

          // FIX #1: Only fetch if data doesn't exist (prevents duplicate API calls)
          if (!report.marketcheck_valuation) {
            console.log('[PricingPage] No existing MarketCheck data, fetching from API')
            await fetchMarketCheckData()
          } else {
            console.log('[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge')
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
          console.log('[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge')
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
          console.log('[PricingPage] Error fallback - MarketCheck data already exists, skipping API call')
        }

        sendMagicLink()
        return
      }
    }

    setProcessingPayment(true)

    try {
      // Call Lemon Squeezy checkout endpoint
      const response = await fetch('/api/lemonsqueezy/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          reportType: tier.id,
        }),
      })

      const data = await response.json()

      if (data.checkoutUrl) {
        // Redirect to Lemon Squeezy payment
        window.location.href = data.checkoutUrl
      } else {
        setError(data.error || 'Failed to create checkout session')
        setProcessingPayment(false)
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError('An error occurred while processing payment')
      setProcessingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-slate-600">
                {creatingReport ? 'Analyzing your vehicle...' : 'Loading your vehicle data...'}
              </p>
              {creatingReport && (
                <p className="text-sm text-slate-500 mt-2">
                  This may take a few moments as we gather market data
                </p>
              )}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">
              Your Vehicle Data is Ready
            </h1>
            <p className="text-lg text-slate-600">
              Get prepared with a professional-grade independent valuation before you settle
            </p>
          </div>

          {/* Vehicle Info Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center mb-6">
              <Car className="h-8 w-8 text-primary-600 mr-3" />
              <h2 className="text-2xl font-bold text-slate-900">
                {report.vehicle_data?.year} {report.vehicle_data?.make}{' '}
                {report.vehicle_data?.model}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* VIN */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">VIN</div>
                <div className="font-semibold text-slate-900 font-mono text-sm">{report.vin}</div>
              </div>

              {/* Mileage */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Mileage</div>
                <div className="font-semibold text-slate-900">
                  {report.mileage.toLocaleString()} miles
                </div>
              </div>

              {/* Location */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Location</div>
                <div className="font-semibold text-slate-900">ZIP {report.zip_code}</div>
              </div>
            </div>
          </div>

          {/* Why Independent Valuation? Section */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-lg p-8 md:p-12 mb-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-6">
                Why Independent Valuation?
              </h2>

              <p className="text-lg text-slate-700 text-center mb-8 leading-relaxed">
                Insurance adjusters undervalue 9 out of 10 total loss claims—by an average of 30%.
                Without independent verification, you're negotiating blind.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">100% Success Rate</h3>
                    <p className="text-slate-600">Every independent appraisal increases settlements</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">34% Average Increase</h3>
                    <p className="text-slate-600">Professional valuations recover significantly more</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Level Playing Field</h3>
                    <p className="text-slate-600">The same data adjusters use, now in your hands</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Time-Sensitive</h3>
                    <p className="text-slate-600">Most appraisals must be requested within 30-90 days of the initial offer</p>
                  </div>
                </div>
              </div>

              <p className="text-center text-slate-700 font-medium text-lg">
                Don't leave money on the table. Get prepared with professional-grade market data before you settle.
              </p>
            </div>
          </div>

          {/* Pricing Tiers Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Select Your Independent Valuation</h2>
              <p className="text-slate-600">One-time payment • Instant access • 100% satisfaction guarantee</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {PRICING_TIERS.map(tier => (
                <div
                  key={tier.id}
                  className={`relative bg-white rounded-2xl shadow-lg p-8 transition-all hover:shadow-2xl border-2 ${
                    tier.recommended
                      ? 'border-primary-500 transform md:scale-105'
                      : 'border-slate-200 hover:border-primary-300'
                  }`}
                >
                  {tier.recommended && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-primary-600 to-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                        Recommended
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                    <div className="flex items-baseline justify-center mb-4">
                      <span className="text-5xl font-bold text-slate-900">${tier.price}</span>
                    </div>
                    <p className="text-slate-600">One-time payment</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(tier)}
                    disabled={processingPayment}
                    className={`w-full py-6 text-lg font-semibold ${
                      tier.recommended
                        ? 'bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700'
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    {processingPayment ? 'Processing...' : `Select ${tier.name} - $${tier.price}`}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="text-center text-sm text-slate-600 space-y-2">
            <p>🔒 Secure payment processing via Lemon Squeezy</p>
            <p>📧 Instant access to your independent valuation</p>
            <p>💯 100% success rate - Every appraisal increases settlements</p>
          </div>
        </div>
      </main>

      <Footer />

      {/* Beta Mode Modal - For Anonymous Users */}
      {showBetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
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
                We're currently in beta, so all reports are completely free. Get the same professional-grade valuation that increases settlements by 34% on average.
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
                      <p className="text-sm text-red-800">
                        {magicLinkError}
                      </p>
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
                            We've sent a secure login link to <strong>{report?.email}</strong>.
                            Click the link in your email to verify your account and access your free report.
                          </>
                        ) : (
                          'Please wait while we send your verification email...'
                        )}
                      </p>
                      {magicLinkSent && (
                        <p className="text-xs text-blue-700 mt-2">
                          Don't see the email? Check your spam folder or{' '}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
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
                Welcome Back - Your Report is Ready!
              </h2>
              <p className="text-lg text-slate-700 mb-4">
                As an existing user, you have free access to your professional-grade independent valuation.
              </p>

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
