'use client'

/**
 * Pricing Section Component
 *
 * Displays pricing cards with click-to-action functionality.
 * Shows modal notifications when users click pricing cards.
 * Currently all products are free for a limited time.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'

interface PricingPlan {
  id: 'basic' | 'premium'
  name: string
  price: number
  description: string
  features: string[]
  popular?: boolean
}

const pricingPlans: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic Report',
    price: 29,
    description: 'Essential valuation for standard vehicles',
    features: ['Market value analysis', 'Comparable vehicles', 'Professional PDF report'],
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
      'Priority support',
    ],
    popular: true,
  },
]

export default function PricingSection() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null)

  // Check authentication status
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        setIsAuthenticated(!!data.session)
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  const handlePricingClick = (plan: PricingPlan) => {
    setSelectedPlan(plan)
    setLoading(plan.id)
    setShowModal(true)
  }

  const handleModalConfirm = () => {
    setShowModal(false)

    if (!isAuthenticated) {
      // Redirect to signup
      setTimeout(() => {
        router.push('/signup')
      }, 300)
    } else {
      // Redirect to create report
      setTimeout(() => {
        router.push('/reports/new')
      }, 300)
    }

    setLoading(null)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setLoading(null)
    setSelectedPlan(null)
  }

  return (
    <>
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">Choose the report that fits your needs</p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:max-w-4xl lg:mx-auto">
            {pricingPlans.map(plan => (
              <div
                key={plan.id}
                onClick={() => handlePricingClick(plan)}
                className={`
                  rounded-2xl shadow-sm bg-white transition-all cursor-pointer
                  ${plan.popular ? 'border-2 border-primary-600 shadow-xl transform scale-105 relative' : 'border border-slate-200'}
                  ${loading === plan.id ? 'opacity-75 cursor-wait' : 'hover:shadow-lg hover:scale-[1.02]'}
                `}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold bg-primary-600 text-white shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Name */}
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>

                  {/* Price */}
                  <p className="mt-4">
                    <span className="text-5xl font-bold text-slate-900">${plan.price}</span>
                  </p>

                  {/* Description */}
                  <p className="mt-6 text-slate-600">{plan.description}</p>

                  {/* Features List */}
                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle2 className="flex-shrink-0 h-6 w-6 text-primary-600 mr-3" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    className={`
                      mt-8 w-full py-3 px-6 rounded-lg font-semibold transition-all
                      ${
                        plan.popular
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }
                      ${loading === plan.id ? 'opacity-50 cursor-wait' : ''}
                    `}
                    disabled={loading === plan.id}
                    onClick={e => {
                      e.stopPropagation()
                      handlePricingClick(plan)
                    }}
                  >
                    {loading === plan.id ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
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
                        Loading...
                      </span>
                    ) : (
                      `Get ${plan.name}`
                    )}
                  </button>

                  {/* Additional Info */}
                  <p className="mt-4 text-sm text-slate-500 text-center">
                    {isAuthenticated
                      ? 'Click to create your report'
                      : 'Sign up required to continue'}
                  </p>
                </div>
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

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={handleModalClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-8 pb-6">
              <button
                onClick={handleModalClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="bg-primary-100 rounded-full p-4">
                  <CheckCircle2 className="h-12 w-12 text-primary-600" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-center text-slate-900 mb-3">
                This product is currently free for a limited time!
              </h3>

              {/* Message */}
              <p className="text-center text-slate-600 text-lg leading-relaxed">
                {isAuthenticated ? (
                  <>
                    You&apos;ve selected the{' '}
                    <span className="font-semibold">{selectedPlan?.name}</span>. We&apos;re offering
                    this service for free during our beta period.
                  </>
                ) : (
                  <>
                    Sign up now to get the{' '}
                    <span className="font-semibold">{selectedPlan?.name}</span> completely free
                    during our beta period!
                  </>
                )}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-8 pb-8 pt-4">
              <button
                onClick={handleModalConfirm}
                className="w-full bg-primary-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isAuthenticated ? 'OK - Create Report' : 'OK - Sign Up Free'}
              </button>

              {/* Additional info */}
              <p className="text-center text-sm text-slate-500 mt-4">
                {isAuthenticated
                  ? 'You will be redirected to create your report'
                  : 'You will be redirected to the signup page'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
