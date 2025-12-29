'use client'

/**
 * Value Propositions & CTA Section
 *
 * Displays key benefits of independent vehicle appraisals
 * and includes a form for users to request their valuation report.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'

interface ValueProp {
  id: number
  title: string
  description: string
}

const VALUE_PROPOSITIONS: ValueProp[] = [
  {
    id: 1,
    title: 'Higher average settlements',
    description:
      'Independent appraisals increase payouts by an average of over 20% across 2023-2025 total loss cases.',
  },
  {
    id: 2,
    title: 'Median gains for typical claims',
    description:
      'Policyholders see a median increase of over 30% proving ROI and value of an independent vehicle appraisal.',
  },
  {
    id: 3,
    title: 'Faster resolutions',
    description: 'Informed disputes with independent data cut negotiation times by over 20%.',
  },
  {
    id: 4,
    title: 'Pre-litigation leverage',
    description:
      'Invoking appraisal often prompts insurers to raise offers before formal process, avoiding court.',
  },
  {
    id: 5,
    title: 'Binding neutral outcome',
    description:
      'Appraisal clauses provide enforceable third-party decisions (appraiser + umpire) in 30-90 days, standard in most U.S. policies.',
  },
  {
    id: 6,
    title: 'Rising dispute relevance',
    description:
      'With total losses at 22.6% of claims (up 0.9 pts YoY) and used values falling to $13,445, total losses are more frequent than ever before.',
  },
  {
    id: 7,
    title: 'Regional market accuracy',
    description:
      'Independent appraisers factor local trends potentially ignored by national models utilized by carriers.',
  },
  {
    id: 8,
    title: 'Empowers negotiation',
    description:
      'Provides documented evidence to counter initial offers, often settling pre-appraisal.',
  },
]

export default function Testimonials() {
  const router = useRouter()

  // Form state
  const [email, setEmail] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showVinTooltip, setShowVinTooltip] = useState(false)

  // Validation functions
  const validateEmail = (email: string): string | null => {
    if (!email) return 'Email address is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    const disposableDomains = [
      'tempmail.com',
      'guerrillamail.com',
      '10minutemail.com',
      'throwaway.email',
    ]
    const domain = email.split('@')[1]?.toLowerCase()
    if (disposableDomains.includes(domain)) return 'Please use a permanent email address'
    return null
  }

  const validateVin = (vin: string): string | null => {
    if (!vin) return 'VIN is required'
    const sanitized = sanitizeVin(vin)
    return getVinValidationError(sanitized)
  }

  const validateMileage = (mileage: string): string | null => {
    if (!mileage) return 'Mileage is required'
    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum)) return 'Please enter a valid number'
    if (mileageNum < 0) return 'Mileage cannot be negative'
    if (mileageNum > 999999) return 'Mileage must be less than 1,000,000'
    return null
  }

  const validateZipCode = (zipCode: string): string | null => {
    if (!zipCode) return 'ZIP code is required'
    if (zipCode.length !== 5) return 'ZIP code must be 5 digits'
    if (!/^\d{5}$/.test(zipCode)) return 'ZIP code must contain only numbers'
    return null
  }

  // Handle field changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (errors.email) setErrors(prev => ({ ...prev, email: '' }))
  }

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      if (errors.vin) setErrors(prev => ({ ...prev, vin: '' }))
    }
  }

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    setMileage(value)
    if (errors.mileage) setErrors(prev => ({ ...prev, mileage: '' }))
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipCode(value)
    if (errors.zipCode) setErrors(prev => ({ ...prev, zipCode: '' }))
  }

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}

    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError

    const vinError = validateVin(vin)
    if (vinError) newErrors.vin = vinError

    const mileageError = validateMileage(mileage)
    if (mileageError) newErrors.mileage = mileageError

    const zipCodeError = validateZipCode(zipCode)
    if (zipCodeError) newErrors.zipCode = zipCodeError

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const checkEmailResponse = await fetch('/api/reports/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const checkEmailData = await checkEmailResponse.json()

      if (checkEmailData.hasReports) {
        const formData = {
          email,
          vin: sanitizeVin(vin),
          mileage: parseInt(mileage),
          zipCode,
        }
        sessionStorage.setItem('hero_form_data', JSON.stringify(formData))
        sessionStorage.setItem('existing_user_message', 'true')

        const returnUrl = `/pricing?email=${encodeURIComponent(email)}&vin=${encodeURIComponent(sanitizeVin(vin))}&mileage=${mileage}&zipCode=${zipCode}`
        router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}&existingUser=true`)
        return
      }

      const formData = {
        email,
        vin: sanitizeVin(vin),
        mileage: parseInt(mileage),
        zipCode,
      }
      sessionStorage.setItem('hero_form_data', JSON.stringify(formData))

      const params = new URLSearchParams({
        email,
        vin: sanitizeVin(vin),
        mileage: mileage,
        zipCode: zipCode,
      })

      router.push(`/pricing?${params.toString()}`)
    } catch (error) {
      console.error('[ValueProps] Form submission error:', error)
      setErrors({ submit: 'An unexpected error occurred. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Independent Appraisals are Essential for Vehicle Owners
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Data-backed advantages that put you in control of your settlement
          </p>
        </div>

        {/* Two Column Layout: Value Props + Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left Column: Value Propositions List */}
          <div className="space-y-6">
            {VALUE_PROPOSITIONS.map(prop => (
              <div key={prop.id} className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{prop.title}</h3>
                  <p className="text-slate-300 leading-relaxed">{prop.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Form */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Get Your Valuation Report</h3>
              <p className="text-slate-600 mb-6">Start with your vehicle information</p>

              <form onSubmit={handleSubmit}>
                {/* Email Field */}
                <div className="mb-4">
                  <label
                    htmlFor="cta-email"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    id="cta-email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                      errors.email ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                </div>

                {/* VIN Field */}
                <div className="mb-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="cta-vin" className="block text-sm font-semibold text-slate-700">
                      Vehicle Identification Number (VIN)
                    </label>
                    <button
                      type="button"
                      onMouseEnter={() => setShowVinTooltip(true)}
                      onMouseLeave={() => setShowVinTooltip(false)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    id="cta-vin"
                    value={vin}
                    onChange={handleVinChange}
                    maxLength={17}
                    placeholder="1HGCM82633A123456"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono text-sm ${
                      errors.vin ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    17 characters, no spaces. {vin.length}/17
                  </p>
                  {errors.vin && <p className="text-sm text-red-600 mt-1">{errors.vin}</p>}

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
                <div className="mb-4">
                  <label
                    htmlFor="cta-mileage"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Mileage
                  </label>
                  <input
                    type="number"
                    id="cta-mileage"
                    value={mileage}
                    onChange={handleMileageChange}
                    min="0"
                    max="999999"
                    placeholder="e.g., 42000"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                      errors.mileage ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {errors.mileage && <p className="text-sm text-red-600 mt-1">{errors.mileage}</p>}
                </div>

                {/* ZIP Code Field */}
                <div className="mb-6">
                  <label
                    htmlFor="cta-zipcode"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="cta-zipcode"
                    value={zipCode}
                    onChange={handleZipCodeChange}
                    maxLength={5}
                    placeholder="e.g., 90210"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono text-sm ${
                      errors.zipCode ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  <p className="text-xs text-slate-500 mt-1">{zipCode.length}/5</p>
                  {errors.zipCode && <p className="text-sm text-red-600 mt-1">{errors.zipCode}</p>}
                </div>

                {/* Submit Error */}
                {errors.submit && (
                  <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 text-sm rounded">
                    {errors.submit}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full group"
                  disabled={
                    loading || !email || vin.length !== 17 || !mileage || zipCode.length !== 5
                  }
                >
                  {loading ? 'Processing...' : 'Get My Independent Valuation'}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>

                <p className="text-center text-xs text-slate-500 mt-4">
                  Takes 60 seconds • No credit card required
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
