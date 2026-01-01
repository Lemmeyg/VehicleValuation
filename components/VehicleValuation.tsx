'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from './ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import AuthModal from './AuthModal'

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

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      setError('')
    }
  }

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '') // Only digits
    setMileage(value)
    setError('')
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5) // Only digits, max 5
    setZipCode(value)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Check authentication FIRST
    if (!user) {
      setShowAuthModal(true)
      return
    }

    // Validate VIN
    const sanitized = sanitizeVin(vin)
    const vinError = getVinValidationError(sanitized)
    if (vinError) {
      setError(vinError)
      return
    }

    // Validate mileage
    const mileageNum = parseInt(mileage)
    if (isNaN(mileageNum) || mileageNum < 0 || mileageNum > 999999) {
      setError('Please enter a valid mileage between 0 and 999,999')
      return
    }

    // Validate ZIP
    if (zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code')
      return
    }

    setLoading(true)

    try {
      // Create report via existing API
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
        return
      }

      // Redirect to pricing page with report ID
      router.push(`/pricing?reportId=${data.report.id}`)
    } catch (err) {
      console.error('Error creating report:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    // After successful auth, automatically submit the form
    if (vin.length === 17 && mileage && zipCode.length === 5) {
      handleSubmit(new Event('submit') as any)
    }
  }

  return (
    <section id="valuation" className="py-24 bg-gradient-to-br from-primary-50 via-emerald-50 to-blue-50">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
              <p className={`text-sm mt-1 ${vin.length === 17 ? 'text-green-600' : 'text-slate-500'}`}>
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
              <p className={`text-sm mt-1 ${zipCode.length === 5 ? 'text-green-600' : 'text-slate-500'}`}>
                {zipCode.length}/5 digits
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={vin.length !== 17 || !mileage || zipCode.length !== 5 || loading}
              className="px-12"
            >
              {loading ? 'Creating Report...' : 'Get Your Valuation'}
            </Button>
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
