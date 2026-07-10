'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from './ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import AuthModal from './AuthModal'
import { trackFormSubmission, trackReportWorkflow, trackEmailCapture } from '@/lib/analytics/events'
import { getKBAttribution } from '@/lib/analytics/kb-attribution'
import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'

const PRICING_TIERS = [
  {
    id: 'basic',
    name: 'Basic Report',
    price: 29,
    description: 'Essential valuation for standard vehicles',
    features: [
      'Market value analysis',
      'Comparable vehicles',
      'Professional PDF report',
      'Email delivery',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Report',
    price: 49,
    description: 'Comprehensive report with accident history',
    features: [
      'Everything in Basic',
      'Accident history report',
      'Diminished value analysis',
      'Market trend insights',
      'Priority support',
      '48-hour delivery guarantee',
    ],
    popular: true,
  },
]

export default function VehicleValuation() {
  const router = useRouter()
  const { user } = useAuth()

  // Form state
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [email, setEmail] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)

  const hasTrackedFormStart = useRef(false)

  useEffect(() => {
    trackEmailCapture({ form: 'bottom', action: 'shown' })
  }, [])

  const trackFormStart = () => {
    if (!hasTrackedFormStart.current) {
      hasTrackedFormStart.current = true
      trackReportWorkflow({ step: 'bottom_form_started' })
    }
  }

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
    const value = e.target.value.replace(/\D/g, '') // Only digits
    setMileage(value)
    setError('')
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    trackFormStart()
    const value = e.target.value.replace(/\D/g, '').slice(0, 5) // Only digits, max 5
    setZipCode(value)
    setError('')
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user) {
      setShowAuthModal(true)
      return
    }

    const sanitized = sanitizeVin(vin)
    const vinError = getVinValidationError(sanitized)
    if (vinError) {
      setError(vinError)
      trackFormSubmission('bottom_vehicle_form', { success: false, error: 'invalid_vin' })
      return
    }

    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum) || mileageNum < 0 || mileageNum > 999999) {
      setError('Please enter a valid mileage between 0 and 999,999')
      trackFormSubmission('bottom_vehicle_form', { success: false, error: 'invalid_mileage' })
      return
    }

    if (zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code')
      trackFormSubmission('bottom_vehicle_form', { success: false, error: 'invalid_zip' })
      return
    }

    const emailError = getEmailValidationError(email)
    if (emailError) {
      setError(emailError)
      trackFormSubmission('bottom_vehicle_form', { success: false, error: 'invalid_email' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: sanitized,
          mileage: mileageNum,
          zipCode: zipCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'RATE_LIMIT_EXCEEDED' && data.message) {
          setError(data.message)
        } else {
          setError(data.error || 'Failed to create report')
        }
        trackFormSubmission('bottom_vehicle_form', {
          success: false,
          error: data.error || 'api_error',
        })
        return
      }

      const kbAttr = getKBAttribution()
      trackFormSubmission('bottom_vehicle_form', { success: true })
      trackReportWorkflow({
        step: 'bottom_form_submitted',
        ...(kbAttr && {
          kb_source_slug: kbAttr.slug,
          kb_source_title: kbAttr.title,
          kb_source_visited_at: kbAttr.visited_at,
        }),
      })

      // Email capture — fire and forget, does not block navigation
      fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sanitizeEmail(email) }),
      }).catch(() => {})
      trackEmailCapture({ form: 'bottom', action: 'submitted' })

      router.push(`/pricing?reportId=${data.report.id}`)
    } catch (err) {
      console.error('Error creating report:', err)
      setError('An unexpected error occurred')
      trackFormSubmission('bottom_vehicle_form', { success: false, error: 'unexpected_error' })
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    // After successful auth, automatically submit the form
    if (vin.length === 17 && mileage && zipCode.length === 5 && !getEmailValidationError(email)) {
      handleSubmit(new Event('submit') as unknown as React.FormEvent)
    }
  }

  return (
    <section
      id="valuation"
      className="py-24 bg-gradient-to-br from-primary-50 via-emerald-50 to-blue-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Get Your Vehicle Valuation
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Enter your vehicle details to get comprehensive pricing analysis from multiple sources
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto mb-16">
          <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-4">
            {/* VIN Input */}
            <div className="flex-1">
              <label htmlFor="vin" className="block text-sm font-semibold text-slate-700 mb-2">
                VIN
              </label>
              <input
                type="text"
                id="vin"
                value={vin}
                onChange={handleVinChange}
                maxLength={17}
                placeholder="17-character VIN"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono text-sm"
                required
              />
              <p
                className={`text-sm mt-1 ${vin.length === 17 ? 'text-green-600' : 'text-slate-500'}`}
              >
                {vin.length}/17 characters
              </p>
            </div>

            {/* Mileage Input */}
            <div className="flex-1">
              <label htmlFor="mileage" className="block text-sm font-semibold text-slate-700 mb-2">
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
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                required
              />
              <p className="text-slate-500 text-sm mt-1">Odometer reading</p>
            </div>

            {/* ZIP Code Input */}
            <div className="flex-1">
              <label htmlFor="zipCode" className="block text-sm font-semibold text-slate-700 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                id="zipCode"
                value={zipCode}
                onChange={handleZipCodeChange}
                maxLength={5}
                placeholder="e.g., 90210"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono text-sm"
                required
              />
              <p
                className={`text-sm mt-1 ${zipCode.length === 5 ? 'text-green-600' : 'text-slate-500'}`}
              >
                {zipCode.length}/5 digits
              </p>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="vc-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="vc-email"
                value={email}
                onChange={handleEmailChange}
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex flex-col items-center">
            <p className="text-sm text-slate-600 mb-3 text-center">
              Reports from $19 — instant access, 90-day money-back guarantee
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={
                vin.length !== 17 ||
                !mileage ||
                zipCode.length !== 5 ||
                !!getEmailValidationError(email) ||
                loading
              }
              className="px-12"
            >
              {loading ? 'Creating Report...' : 'Get Your Valuation'}
            </Button>
            <p className="text-xs text-slate-500 mt-3 text-center">
              By submitting, you agree to receive occasional emails from TotalLossToolkit.com
            </p>
          </div>
        </form>

        {/* Pricing Tiers - Display Only */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {PRICING_TIERS.map(tier => (
            <div
              key={tier.id}
              className={`relative rounded-2xl p-8 ${
                tier.popular
                  ? 'border-2 border-primary-600 shadow-xl bg-white'
                  : 'border border-slate-200 shadow-md bg-white'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold bg-primary-600 text-white shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                <p className="text-slate-600">{tier.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-5xl font-bold text-slate-900">${tier.price}</span>
                  <span className="text-slate-600 ml-2">per report</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <CheckCircle2 className="flex-shrink-0 h-5 w-5 text-primary-600 mr-3 mt-0.5" />
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </section>
  )
}
