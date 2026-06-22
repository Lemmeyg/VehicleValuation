'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/Button'
import { ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import ReportPreviewCondensed from './ReportPreviewCondensed'
import { Shield } from 'lucide-react'
import {
  trackVehicleSearch,
  trackFormSubmission,
  trackReportWorkflow,
} from '@/lib/analytics/events'
import { getKBAttribution } from '@/lib/analytics/kb-attribution'
import { trackRedditLead } from '@/lib/analytics/reddit-events'
import { isEmailCaptureEnabled } from '@/lib/feature-flags'
import { trackEmailCapture } from '@/lib/analytics/events'

export default function Hero() {
  const router = useRouter()

  // Form state (VIN, mileage, ZIP — email collected at LemonSqueezy checkout)
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showVinTooltip, setShowVinTooltip] = useState(false)

  const emailCaptureEnabled = isEmailCaptureEnabled()
  const [email, setEmail] = useState('')

  // Track form engagement
  const hasTrackedFormStart = useRef(false)

  useEffect(() => {
    if (isEmailCaptureEnabled()) {
      trackEmailCapture({ form: 'hero', action: 'shown' })
    }
  }, [])

  // Track when user starts filling out the form (first field interaction)
  const trackFormStart = () => {
    if (!hasTrackedFormStart.current) {
      hasTrackedFormStart.current = true
      trackReportWorkflow({ step: 'hero_form_started' })
    }
  }

  // VIN validation
  const validateVin = (vin: string): string | null => {
    if (!vin) return 'VIN is required'
    const sanitized = sanitizeVin(vin)
    return getVinValidationError(sanitized)
  }

  // Mileage validation
  const validateMileage = (mileage: string): string | null => {
    if (!mileage) return 'Mileage is required'
    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum)) return 'Please enter a valid number'
    if (mileageNum < 0) return 'Mileage cannot be negative'
    if (mileageNum > 999999) return 'Mileage must be less than 1,000,000'
    return null
  }

  // ZIP code validation
  const validateZipCode = (zipCode: string): string | null => {
    if (!zipCode) return 'ZIP code is required'
    if (zipCode.length !== 5) return 'ZIP code must be 5 digits'
    if (!/^\d{5}$/.test(zipCode)) return 'ZIP code must contain only numbers'
    return null
  }

  // Handle field changes
  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      if (errors.vin) {
        setErrors(prev => ({ ...prev, vin: '' }))
      }
    }
  }

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    const value = e.target.value.replace(/\D/g, '')
    setMileage(value)
    if (errors.mileage) {
      setErrors(prev => ({ ...prev, mileage: '' }))
    }
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipCode(value)
    if (errors.zipCode) {
      setErrors(prev => ({ ...prev, zipCode: '' }))
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    const newErrors: Record<string, string> = {}

    const vinError = validateVin(vin)
    if (vinError) newErrors.vin = vinError

    const mileageError = validateMileage(mileage)
    if (mileageError) newErrors.mileage = mileageError

    const zipCodeError = validateZipCode(zipCode)
    if (zipCodeError) newErrors.zipCode = zipCodeError

    // If any errors, show them and stop
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      // Track form validation failure
      trackFormSubmission('hero_vehicle_form', {
        success: false,
        error: 'validation_failed',
        fields: Object.keys(newErrors),
      })
      return
    }

    setLoading(true)

    // Track successful form submission attempt
    trackFormSubmission('hero_vehicle_form', {
      success: true,
      fields: ['vin', 'mileage', 'zipCode'],
    })

    // Track vehicle search
    trackVehicleSearch({
      vin: sanitizeVin(vin),
      searchMethod: 'vin',
    })

    // Track report workflow step, enriched with KB last-touch attribution if present
    const kbAttr = getKBAttribution()
    trackReportWorkflow({
      step: 'hero_form_submitted',
      ...(kbAttr && {
        kb_source_slug: kbAttr.slug,
        kb_source_title: kbAttr.title,
        kb_source_visited_at: kbAttr.visited_at,
      }),
    })

    // Reddit Pixel: track as Lead conversion
    trackRedditLead()

    // Email capture — fire and forget, non-blocking
    if (emailCaptureEnabled && email.trim()) {
      fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {})
      trackEmailCapture({ form: 'hero', action: 'submitted' })
    } else if (emailCaptureEnabled) {
      trackEmailCapture({ form: 'hero', action: 'skipped' })
    }

    // Store form data in localStorage for pricing page
    const formData = {
      vin: sanitizeVin(vin),
      mileage: parseInt(mileage),
      zipCode,
    }
    localStorage.setItem('hero_form_data', JSON.stringify(formData))
    console.log('[Hero] Form data stored in localStorage:', formData)

    // Redirect directly to pricing — no auth required before purchase
    console.log('[Hero] Redirecting to pricing page')
    router.push('/pricing')
  }

  return (
    <section className="relative min-h-[90vh] bg-slate-900 pt-20 pb-16 overflow-hidden">
      {/* Background Gradient Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[120px] animate-blob" />
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-900/40 rounded-full blur-[100px] animate-blob"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-blue-900/20 rounded-full blur-[80px] animate-blob"
          style={{ animationDelay: '4s' }}
        />
      </div>

      {/* Full-width Title - spans entire page width */}
      <div className="w-full relative z-10 mb-10 overflow-hidden">
        <h1 className="text-[4.2vw] font-bold text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] animate-fade-in-up text-center whitespace-nowrap px-2">
          Secure Fair Value for Your Totaled Vehicle
        </h1>
      </div>

      {/* Subheader text - full width above the grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full mb-8">
        <div className="max-w-2xl">
          <p className="text-xl md:text-2xl text-slate-200 mb-4 font-semibold animate-fade-in-up">
            Owners Gain 34% Higher Settlements with Independent Appraisals
          </p>

          <p className="text-lg text-slate-300 mb-6 leading-relaxed animate-fade-in-up">
            Insurance Adjusters Undervalue 90% of Claims—Verify Your Vehicle&apos;s Accurate Market
            Value Before Accepting an Offer.
          </p>

          {/* Trust Indicators Row */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-slate-300 text-sm animate-fade-in-up">
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-2 text-primary-400" />
              34% Avg Settlement Increase*
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        {/* Top Row: Value Points (left) + Report Preview (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-10">
          {/* Left Column: Report Value Points */}
          <div className="animate-fade-in-up">
            <h3 className="text-2xl font-bold text-white mb-6">What You Get in Your Report:</h3>
            <ul className="space-y-4 text-slate-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Accurate Market Value</strong> — Based on real-time
                  comparable sales in your area
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Comparable Vehicle Listings</strong> — Evidence to
                  counter lowball offers
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">VIN Based Results</strong> — Return the data most
                  relevant to your own vehicle
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Market Analysis</strong> — Regional pricing data
                  and confidence scoring
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Further Pricing Factors</strong> — Complete list of
                  factors that could further increase the vehicle valuation
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Most Recent Data</strong> — Free updates available
                  to keep the report as accurate as possible
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Negotiation Ready</strong> — Professional format
                  for credibility with carriers
                </span>
              </li>
            </ul>
            <p className="text-xs text-slate-400 mt-6">*Texas Department of Insurance (2024)</p>
          </div>

          {/* Right Column: Report Preview Visual */}
          <div className="hidden lg:block relative">
            <p className="text-sm text-slate-300 font-medium mb-3">Vehicle Valuation Report</p>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 max-h-[500px] overflow-y-auto">
              <ReportPreviewCondensed />

              {/* 90-Day Money Back Guarantee Badge */}
              <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full p-3 shadow-2xl border-4 border-white z-20">
                <div className="flex flex-col items-center justify-center">
                  <Shield className="h-6 w-6 mb-1" />
                  <div className="text-[10px] font-bold text-center leading-tight">
                    90-DAY
                    <br />
                    GUARANTEE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width Form Section */}
        <div className="animate-fade-in-up">
          <form
            id="hero-form"
            onSubmit={handleSubmit}
            className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-2xl"
          >
            {/* Form fields grid — 4 cols when email capture enabled, 3 cols otherwise */}
            <div
              className={`grid grid-cols-1 gap-4 mb-6 ${emailCaptureEnabled ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
            >
              {/* VIN Field */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="vin" className="block text-sm font-semibold text-slate-900">
                    VIN
                  </label>
                  <button
                    type="button"
                    onMouseEnter={() => setShowVinTooltip(true)}
                    onMouseLeave={() => setShowVinTooltip(false)}
                    onFocus={() => setShowVinTooltip(true)}
                    onBlur={() => setShowVinTooltip(false)}
                    className="text-slate-600 hover:text-slate-800"
                    aria-label="VIN help"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <input
                  type="text"
                  id="vin"
                  value={vin}
                  onChange={handleVinChange}
                  maxLength={17}
                  placeholder="1HGCM82633A123456"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono text-sm text-slate-900 ${
                    errors.vin ? 'border-red-400' : 'border-slate-200'
                  }`}
                  aria-required="true"
                  aria-describedby="vin-helper vin-error"
                />
                {errors.vin && (
                  <p id="vin-error" className="text-sm text-red-600 mt-1" role="alert">
                    {errors.vin}
                  </p>
                )}

                {/* VIN Tooltip */}
                {showVinTooltip && (
                  <div className="absolute z-20 mt-2 p-4 bg-slate-800 text-white text-sm rounded-lg shadow-xl max-w-xs right-0">
                    <p className="font-semibold mb-2">Your VIN is located:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• On your dashboard (visible through windshield)</li>
                      <li>• On driver-side door frame</li>
                      <li>• On your vehicle registration</li>
                      <li>• On your insurance card</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Mileage Field */}
              <div>
                <label
                  htmlFor="mileage"
                  className="block text-sm font-semibold text-slate-900 mb-2"
                >
                  Mileage
                </label>
                <input
                  type="number"
                  id="mileage"
                  value={mileage}
                  onChange={handleMileageChange}
                  min="0"
                  max="999999"
                  placeholder="e.g., 42000"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 ${
                    errors.mileage ? 'border-red-400' : 'border-slate-200'
                  }`}
                  aria-required="true"
                  aria-describedby="mileage-helper mileage-error"
                />
                {errors.mileage && (
                  <p id="mileage-error" className="text-sm text-red-600 mt-1" role="alert">
                    {errors.mileage}
                  </p>
                )}
              </div>

              {/* ZIP Code Field */}
              <div>
                <label
                  htmlFor="zipCode"
                  className="block text-sm font-semibold text-slate-900 mb-2"
                >
                  ZIP Code
                </label>
                <input
                  type="text"
                  id="zipCode"
                  value={zipCode}
                  onChange={handleZipCodeChange}
                  maxLength={5}
                  placeholder="e.g., 90210"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono text-sm text-slate-900 ${
                    errors.zipCode ? 'border-red-400' : 'border-slate-200'
                  }`}
                  aria-required="true"
                  aria-describedby="zipcode-helper zipcode-error"
                />
                {errors.zipCode && (
                  <p id="zipcode-error" className="text-sm text-red-600 mt-1" role="alert">
                    {errors.zipCode}
                  </p>
                )}
              </div>

              {/* Email capture — feature flagged, 4th column */}
              {emailCaptureEnabled && (
                <div>
                  <label
                    htmlFor="hero-email"
                    className="block text-sm font-semibold text-slate-900 mb-2"
                  >
                    Email <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    id="hero-email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 text-sm rounded">
                {errors.submit}
              </div>
            )}

            {/* Submit Button Row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-base text-slate-600">
                Takes 60 seconds • Instant results
                {emailCaptureEnabled && ' • Reports from $19'}
              </p>
              <div className="flex flex-col items-center w-full md:w-auto">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full md:w-auto px-8 group"
                  disabled={loading || vin.length !== 17 || !mileage || zipCode.length !== 5}
                >
                  {loading ? 'Processing...' : 'Get My Independent Valuation'}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                {emailCaptureEnabled && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    By submitting, you agree to receive occasional emails from TotalLossToolkit.com
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
