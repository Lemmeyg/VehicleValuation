'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Check, Car, DollarSign, TrendingUp, TrendingDown, FileText } from 'lucide-react'

interface VehicleData {
  vin: string
  make: string
  model: string
  year: number
  trim: string
  mileage: number
  highestPrice: number
  lowestPrice: number
  listingCount: number
}

const PRICING_TIERS = [
  {
    id: 'basic',
    name: 'Basic Report',
    price: 29,
    features: [
      'Vehicle Specifications',
      'Market Value Range',
      'Price Comparison (5 listings)',
      'Basic Vehicle History',
      'PDF Download'
    ]
  },
  {
    id: 'premium',
    name: 'Premium Report',
    price: 49,
    features: [
      'Everything in Basic',
      'Detailed Market Analysis',
      'Price Comparison (20+ listings)',
      'Comprehensive Vehicle History',
      'Accident & Damage Reports',
      'Service Records',
      'Priority Support',
      'PDF Download'
    ],
    recommended: true
  }
]

export default function PricingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vinParam = searchParams.get('vin')

  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call with dummy data
    // In production, this would fetch from your API/database
    if (vinParam) {
      setTimeout(() => {
        setVehicleData({
          vin: vinParam,
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          trim: 'XLE V6',
          mileage: 45000,
          highestPrice: 28500,
          lowestPrice: 24200,
          listingCount: 47
        })
        setLoading(false)
      }, 500)
    } else {
      setLoading(false)
    }
  }, [vinParam])

  const handleTierSelect = async (tierId: string) => {
    // Check authentication status
    const response = await fetch('/api/auth/session')
    const session = await response.json()

    if (!session || !session.user) {
      // User not logged in - show login modal (will implement in next step)
      // For now, redirect to login
      router.push('/login?redirect=/pricing?vin=' + vinParam + '&tier=' + tierId)
    } else {
      // User logged in - proceed to payment
      router.push('/payment?vin=' + vinParam + '&tier=' + tierId)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading vehicle data...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!vehicleData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-4">No VIN Provided</h1>
              <p className="text-slate-600 mb-8">Please enter a VIN to view pricing.</p>
              <Button onClick={() => router.push('/')}>Return to Home</Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Vehicle Data Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">
                Vehicle Valuation Report
              </h1>
              <p className="text-lg text-slate-600">
                Choose your report tier to view detailed analysis
              </p>
            </div>

            {/* Vehicle Info Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <div className="flex items-center mb-6">
                <Car className="h-8 w-8 text-primary-600 mr-3" />
                <h2 className="text-2xl font-bold text-slate-900">
                  {vehicleData.year} {vehicleData.make} {vehicleData.model}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* VIN */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600 mb-1">VIN</div>
                  <div className="font-semibold text-slate-900 font-mono text-sm">
                    {vehicleData.vin}
                  </div>
                </div>

                {/* Trim & Mileage */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600 mb-1">Trim / Mileage</div>
                  <div className="font-semibold text-slate-900">
                    {vehicleData.trim}
                  </div>
                  <div className="text-sm text-slate-600">
                    {vehicleData.mileage.toLocaleString()} miles
                  </div>
                </div>

                {/* Price Range */}
                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="text-sm text-emerald-700 mb-1 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Highest Price
                  </div>
                  <div className="font-bold text-emerald-700 text-xl">
                    ${vehicleData.highestPrice.toLocaleString()}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-700 mb-1 flex items-center">
                    <TrendingDown className="h-4 w-4 mr-1" />
                    Lowest Price
                  </div>
                  <div className="font-bold text-blue-700 text-xl">
                    ${vehicleData.lowestPrice.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Listings Count */}
              <div className="mt-6 bg-primary-50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-primary-600 mr-2" />
                  <span className="text-slate-700">Market Data Analysis</span>
                </div>
                <span className="font-bold text-primary-600">
                  {vehicleData.listingCount} listings analyzed
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Tiers Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Choose Your Report
              </h2>
              <p className="text-slate-600">
                Select the tier that best fits your needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`relative bg-white rounded-2xl shadow-lg p-8 transition-all hover:shadow-2xl border-2 ${
                    tier.recommended
                      ? 'border-primary-500 transform md:scale-105'
                      : 'border-slate-200 hover:border-primary-300'
                  }`}
                >
                  {tier.recommended && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-primary-600 to-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                        Recommended
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {tier.name}
                    </h3>
                    <div className="flex items-center justify-center mb-4">
                      <DollarSign className="h-6 w-6 text-slate-600" />
                      <span className="text-5xl font-bold text-slate-900">
                        {tier.price}
                      </span>
                    </div>
                    <p className="text-slate-600">One-time payment</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleTierSelect(tier.id)}
                    className={`w-full py-6 text-lg font-semibold ${
                      tier.recommended
                        ? 'bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700'
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    Get {tier.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="text-center text-sm text-slate-600 space-y-2">
            <p>🔒 Secure payment processing</p>
            <p>📧 Instant report delivery to your email</p>
            <p>💯 100% satisfaction guarantee</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
