'use client'

/**
 * Payment Buttons Component
 *
 * Client-side buttons to initiate Lemon Squeezy checkout for Basic and Premium reports.
 */

import { useState } from 'react'

interface PaymentButtonsProps {
  reportId: string
}

export function PaymentButtons({ reportId }: PaymentButtonsProps) {
  const [loading, setLoading] = useState<'BASIC' | 'PREMIUM' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async (reportType: 'BASIC' | 'PREMIUM') => {
    setLoading(reportType)
    setError(null)

    try {
      // Call the Lemon Squeezy create-checkout API
      const response = await fetch('/api/lemonsqueezy/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          reportType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Lemon Squeezy Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(null)
    }
  }

  return (
    <div>
      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
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

      {/* Payment Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Report Button */}
        <button
          onClick={() => handlePayment('BASIC')}
          disabled={loading !== null}
          className="relative bg-white border-2 border-blue-600 rounded-lg p-6 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Basic Report</h3>
            <div className="text-4xl font-bold text-blue-600 mb-3">$29</div>
            <ul className="text-sm text-gray-600 space-y-2 mb-4">
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-green-500 mr-2"
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
                Vehicle Information
              </li>
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-green-500 mr-2"
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
                Market Valuation
              </li>
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-green-500 mr-2"
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
                Money-Back Guarantee
              </li>
            </ul>
            {loading === 'BASIC' ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
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
                <span className="ml-2 text-sm text-blue-600">Processing...</span>
              </div>
            ) : (
              <span className="text-blue-600 font-medium">Select Basic →</span>
            )}
          </div>
        </button>

        {/* Premium Report Button */}
        <button
          onClick={() => handlePayment('PREMIUM')}
          disabled={loading !== null}
          className="relative bg-blue-600 text-white rounded-lg p-6 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {/* Popular Badge */}
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
              Most Popular
            </span>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Premium Report</h3>
            <div className="text-4xl font-bold mb-3">$49</div>
            <ul className="text-sm space-y-2 mb-4 text-blue-100">
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white mr-2"
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
                Everything in Basic
              </li>
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white mr-2"
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
                Accident History
              </li>
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white mr-2"
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
                Market Comparables
              </li>
              <li className="flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white mr-2"
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
                Priority Processing
              </li>
            </ul>
            {loading === 'PREMIUM' ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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
                <span className="ml-2 text-sm">Processing...</span>
              </div>
            ) : (
              <span className="font-medium">Select Premium →</span>
            )}
          </div>
        </button>
      </div>

      {/* Secure Payment Notice */}
      <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
        <svg
          className="h-4 w-4 text-gray-400 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Secure payment powered by Lemon Squeezy
      </div>
    </div>
  )
}
