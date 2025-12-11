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

      // Create report and fetch data from APIs
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vin: sanitized }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create report')
        return
      }

      // Success! Redirect to report details
      router.push(`/reports/${data.report.id}`)

    } catch (err) {
      console.error('Error creating report:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
                Vehicle Valuation
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Create New Report
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Enter your vehicle's VIN to get started with a professional valuation report.
              </p>
            </div>

            {/* VIN Input Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* VIN Input */}
              <div>
                <label
                  htmlFor="vin"
                  className="block text-sm font-medium text-gray-700"
                >
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    disabled={loading}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  The VIN is typically found on the driver's side dashboard or door jamb.
                </p>
                {vin.length > 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    {vin.length}/17 characters
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
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
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
                    <h3 className="text-sm font-medium text-blue-800">
                      What happens next?
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>We'll validate your VIN and retrieve vehicle information</li>
                        <li>You'll review the details and select a report type ($29 or $49)</li>
                        <li>After payment, we'll generate your comprehensive report</li>
                        <li>Reports are typically ready within 24-48 hours</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading || vin.length !== 17}
                  className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <p className="text-sm text-gray-500">
            Need help finding your VIN?{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
              View our guide
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
