'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/Button'
import { ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import ReportPreview from './ReportPreview'

export default function Hero() {
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

  // Email validation
  const validateEmail = (email: string): string | null => {
    if (!email) return 'Email address is required'

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'

    // Optional: Block common disposable email domains
    const disposableDomains = [
      'tempmail.com',
      'guerrillamail.com',
      '10minutemail.com',
      'throwaway.email',
    ]
    const domain = email.split('@')[1]?.toLowerCase()
    if (disposableDomains.includes(domain)) {
      return 'Please use a permanent email address'
    }

    return null
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
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: '' }))
    }
  }

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      if (errors.vin) {
        setErrors(prev => ({ ...prev, vin: '' }))
      }
    }
  }

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    setMileage(value)
    if (errors.mileage) {
      setErrors(prev => ({ ...prev, mileage: '' }))
    }
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipCode(value)
    if (errors.zipCode) {
      setErrors(prev => ({ ...prev, zipCode: '' }))
    }
  }

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    const newErrors: Record<string, string> = {}

    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError

    const vinError = validateVin(vin)
    if (vinError) newErrors.vin = vinError

    const mileageError = validateMileage(mileage)
    if (mileageError) newErrors.mileage = mileageError

    const zipCodeError = validateZipCode(zipCode)
    if (zipCodeError) newErrors.zipCode = zipCodeError

    // If any errors, show them and stop
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      // STEP 1: Check if email already has reports in the system
      console.log('[Hero] Checking if email has existing reports:', email)

      const checkEmailResponse = await fetch('/api/reports/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const checkEmailData = await checkEmailResponse.json()
      console.log('[Hero] Email check result:', checkEmailData)

      // STEP 2: If email has existing reports, redirect to login page with message
      if (checkEmailData.hasReports) {
        console.log('[Hero] Email has existing reports. Redirecting to login.')

        // Store the form data so they can still create a new report after login
        const formData = {
          email,
          vin: sanitizeVin(vin),
          mileage: parseInt(mileage),
          zipCode,
        }
        sessionStorage.setItem('hero_form_data', JSON.stringify(formData))
        sessionStorage.setItem('existing_user_message', 'true')

        // Redirect to login page with return URL
        const returnUrl = `/pricing?email=${encodeURIComponent(email)}&vin=${encodeURIComponent(sanitizeVin(vin))}&mileage=${mileage}&zipCode=${zipCode}`
        router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}&existingUser=true`)
        return
      }

      // STEP 3: New email - proceed to pricing page as normal
      console.log('[Hero] New email. Proceeding to pricing page.')

      // Store form data in sessionStorage for pricing page
      const formData = {
        email,
        vin: sanitizeVin(vin),
        mileage: parseInt(mileage),
        zipCode,
      }
      sessionStorage.setItem('hero_form_data', JSON.stringify(formData))

      // Redirect to pricing page with URL params
      const params = new URLSearchParams({
        email,
        vin: sanitizeVin(vin),
        mileage: mileage,
        zipCode: zipCode,
      })

      router.push(`/pricing?${params.toString()}`)
    } catch (error) {
      console.error('[Hero] Form submission error:', error)
      setErrors({ submit: 'An unexpected error occurred. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <section className="relative min-h-[90vh] flex items-center bg-slate-900 pt-20 pb-16 overflow-hidden">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Value Proposition + Form */}
          <div className="animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
              Protect Yourself Against Lowball Offers
            </h1>

            <p className="text-xl md:text-2xl text-slate-200 mb-4 font-semibold">
              Independent appraisals increase the settlement value by an average of over 25%
            </p>

            <p className="text-lg text-slate-300 mb-6 leading-relaxed max-w-lg">
              Insurance adjusters undervalue 9 out of 10 total loss claims. Don&apos;t settle
              without knowing your vehicle&apos;s true market value. Get an independent data-backed
              appraisal to level the playing field.
            </p>

            {/* Trust Indicators Row */}
            <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-8 text-slate-300 text-sm">
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-primary-400" />
                34% Avg Settlement Increase*
              </div>
            </div>

            {/* Form */}
            <form
              id="hero-form"
              onSubmit={handleSubmit}
              className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-2xl max-w-md"
            >
              {/* Email Field */}
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
                  Your Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 ${
                    errors.email ? 'border-red-400' : 'border-slate-200'
                  }`}
                  aria-required="true"
                  aria-describedby="email-helper email-error"
                />
                <p id="email-helper" className="text-xs text-slate-700 mt-1">
                  We&apos;ll send your report here—no spam, ever.
                </p>
                {errors.email && (
                  <p id="email-error" className="text-sm text-red-600 mt-1" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* VIN Field */}
              <div className="mb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="vin" className="block text-sm font-semibold text-slate-900">
                    Vehicle Identification Number (VIN)
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
                <p id="vin-helper" className="text-xs text-slate-700 mt-1">
                  17 characters, no spaces. {vin.length}/17
                </p>
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
              <div className="mb-4">
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
                <p id="mileage-helper" className="text-xs text-slate-700 mt-1">
                  Current odometer reading
                </p>
                {errors.mileage && (
                  <p id="mileage-error" className="text-sm text-red-600 mt-1" role="alert">
                    {errors.mileage}
                  </p>
                )}
              </div>

              {/* ZIP Code Field */}
              <div className="mb-6">
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
                <p id="zipcode-helper" className="text-xs text-slate-700 mt-1">
                  Where is the vehicle located? {zipCode.length}/5
                </p>
                {errors.zipCode && (
                  <p id="zipcode-error" className="text-sm text-red-600 mt-1" role="alert">
                    {errors.zipCode}
                  </p>
                )}
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

              {/* Below-Button Microcopy */}
              <p className="text-center text-xs text-slate-700 mt-4">
                Takes 60 seconds • No credit card required • Instant results
              </p>

              {/* Data Source Footnote */}
              <p className="text-center text-[10px] text-slate-600 mt-3 leading-tight">
                Data based on 2023-2025 closed claim analysis. Independent appraisals increased
                settlements by 34% on average across all total loss cases. Source: AppraiseItNow,
                2025.
              </p>
            </form>

            {/* Citation for Trust Indicators */}
            <p className="text-xs text-slate-400 mt-4 max-w-md">
              *Texas Department of Insurance (2024)
            </p>
          </div>

          {/* Right Column: Report Preview Visual */}
          <div className="hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
              <ReportPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
