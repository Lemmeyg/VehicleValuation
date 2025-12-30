'use client'

/**
 * New Report Page
 *
 * VIN input form to create a new vehicle valuation report.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'

export default function NewReportPage() {
  const router = useRouter()

  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setVin(value.toUpperCase())
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Sanitize and validate VIN
      const sanitized = sanitizeVin(vin)
      const validationError = getVinValidationError(sanitized)

      if (validationError) {
        setError(validationError)
        setLoading(false)
        return
      }

      // Validate mileage
      const mileageNum = parseInt(mileage)
      if (isNaN(mileageNum) || mileageNum < 0 || mileageNum > 999999) {
        setError('Please enter a valid mileage between 0 and 999,999')
        setLoading(false)
        return
      }

      // Validate ZIP code
      if (zipCode.length !== 5) {
        setError('Please enter a valid 5-digit ZIP code')
        setLoading(false)
        return
      }

      // Create report and fetch data from APIs
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vin: sanitized,
          mileage: mileageNum,
          zipCode: zipCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle rate limit error with detailed message
        if (data.error === 'RATE_LIMIT_EXCEEDED' && data.message) {
          setError(data.message)
        } else {
          setError(data.error || 'Failed to create report')
        }
        return
      }

      // Success! Redirect to pricing page to select report tier
      router.push(`/pricing?reportId=${data.report.id}`)
    } catch (err) {
      console.error('Error creating report:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background decorative blobs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Navigation */}
      <nav className="bg-white shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-slate-900">
                Vehicle Valuation
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-slate-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="glass-card rounded-2xl shadow-xl">
          <div className="px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">Create New Report</h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter your vehicle&apos;s VIN to get started with a professional valuation report.
              </p>
            </div>

            {/* VIN Input Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* VIN Input */}
              <div>
                <label htmlFor="vin" className="block text-sm font-semibold text-slate-700 mb-2">
                  Vehicle Identification Number (VIN)
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="vin"
                    name="vin"
                    value={vin}
                    onChange={handleVinChange}
                    maxLength={17}
                    placeholder="Enter 17-character VIN"
                    className="appearance-none block w-full px-4 py-3 border-2 border-slate-200 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base font-mono transition-all"
                    disabled={loading}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  The VIN is typically found on the driver&apos;s side dashboard or door jamb.
                </p>
                {vin.length > 0 && (
                  <p
                    className={`mt-1 text-sm font-medium ${vin.length === 17 ? 'text-primary-600' : 'text-slate-500'}`}
                  >
                    {vin.length}/17 characters
                  </p>
                )}
              </div>

              {/* Mileage Input */}
              <div>
                <label htmlFor="mileage" className="block text-sm font-semibold text-slate-700 mb-2">
                  Current Mileage
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="mileage"
                    name="mileage"
                    value={mileage}
                    onChange={e => setMileage(e.target.value)}
                    min="0"
                    max="999999"
                    placeholder="e.g., 42000"
                    className="appearance-none block w-full px-4 py-3 border-2 border-slate-200 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    disabled={loading}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Enter the current odometer reading in miles.
                </p>
              </div>

              {/* ZIP Code Input */}
              <div>
                <label htmlFor="zipCode" className="block text-sm font-semibold text-slate-700 mb-2">
                  ZIP Code
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={zipCode}
                    onChange={e =>
                      setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))
                    }
                    maxLength={5}
                    placeholder="e.g., 90210"
                    className="appearance-none block w-full px-4 py-3 border-2 border-slate-200 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base font-mono transition-all"
                    disabled={loading}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Your location helps us find accurate comparable vehicles in your area.
                </p>
                {zipCode.length > 0 && (
                  <p
                    className={`mt-1 text-sm font-medium ${zipCode.length === 5 ? 'text-primary-600' : 'text-slate-500'}`}
                  >
                    {zipCode.length}/5 digits
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
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
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-5">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-primary-900">What happens next?</h3>
                    <div className="mt-2 text-sm text-primary-800">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>We&apos;ll validate your VIN and retrieve vehicle information</li>
                        <li>
                          You&apos;ll see pricing options for Basic ($29) or Premium ($49) reports
                        </li>
                        <li>Select your preferred report tier and complete checkout</li>
                        <li>Get instant access to your comprehensive valuation report</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-4">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading || vin.length !== 17 || !mileage || zipCode.length !== 5}
                  className="inline-flex justify-center py-3 px-8 border border-transparent shadow-md text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Validating...
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Need help finding your VIN?{' '}
            <a
              href="#"
              className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              View our guide
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
