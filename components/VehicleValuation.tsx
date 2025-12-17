'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from './ui/Button'

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
  const [vin, setVin] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState('')

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length <= 17) {
      setVin(value)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (vin.length !== 17) {
      setError('VIN must be exactly 17 characters')
      return
    }

    setIsValidating(true)

    // Redirect to pricing page with VIN
    router.push(`/pricing?vin=${vin}`)

    setIsValidating(false)
  }

  return (
    <section id="valuation" className="py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Get Your Vehicle Valuation
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Enter your 17-character Vehicle Identification Number (VIN) to get started
          </p>
        </div>

        {/* VIN Input Form */}
        <div className="max-w-2xl mx-auto mb-16">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={vin}
                  onChange={handleVinChange}
                  placeholder="Enter 17-character VIN"
                  className={`w-full px-6 py-4 text-lg border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                    error ? 'border-red-500' : 'border-slate-200'
                  }`}
                  maxLength={17}
                />
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                <p className="text-slate-500 text-sm mt-2">{vin.length}/17 characters</p>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={vin.length !== 17 || isValidating}
                className="sm:w-auto w-full"
              >
                {isValidating ? 'Validating...' : 'Get Report'}
              </Button>
            </div>
          </form>
        </div>

        {/* Pricing Tiers */}
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

        {/* Money-Back Guarantee */}
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-600">
            💯 <span className="font-semibold">100% Money-Back Guarantee</span> — Full refund if
            your settlement doesn&apos;t exceed our valuation
          </p>
        </div>
      </div>
    </section>
  )
}
