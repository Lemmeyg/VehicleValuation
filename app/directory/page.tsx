/**
 * Directory Page
 *
 * Displays all professional service providers
 */

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { MapPin, Star, BadgeCheck, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Professional {
  id: number
  name: string
  role: string
  location: string
  rating: number
  reviewCount: number
  valueProposition: string
}

const PROFESSIONALS: Professional[] = [
  {
    id: 1,
    name: 'Sarah Johnson',
    role: 'Certified Auto Appraiser',
    location: 'Chicago, IL',
    rating: 4.9,
    reviewCount: 124,
    valueProposition:
      'Get fair market valuations backed by 15 years of expertise. I help accident victims navigate insurance claims and secure maximum settlements.',
  },
  {
    id: 2,
    name: 'Michael Chen',
    role: 'Senior Vehicle Inspector',
    location: 'San Francisco, CA',
    rating: 5.0,
    reviewCount: 89,
    valueProposition:
      "Don't let insurance companies undervalue your claim. My detailed inspections uncover hidden damage and ensure you receive proper compensation.",
  },
  {
    id: 3,
    name: 'Jennifer Davis',
    role: 'Dealership Valuation Expert',
    location: 'Miami, FL',
    rating: 4.8,
    reviewCount: 56,
    valueProposition:
      'Struggling with total loss disputes? I provide independent valuations that protect your financial interests against lowball insurance offers.',
  },
  {
    id: 4,
    name: 'Robert Martinez',
    role: 'Collision Damage Specialist',
    location: 'Houston, TX',
    rating: 4.9,
    reviewCount: 142,
    valueProposition:
      'Overwhelmed by the claims process? I simplify complex valuations and fight for every dollar you deserve after an accident.',
  },
  {
    id: 5,
    name: 'Emily Thompson',
    role: 'Insurance Claim Advocate',
    location: 'Seattle, WA',
    rating: 5.0,
    reviewCount: 98,
    valueProposition:
      "Tired of insurance delays and denials? I expedite your claim with professional documentation that insurance companies can't ignore.",
  },
]

export default function DirectoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Professional Directory
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Connect with certified experts who understand your challenges and fight for fair
              compensation
            </p>
          </div>

          {/* Professionals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PROFESSIONALS.map(pro => (
              <div
                key={pro.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 border border-slate-100 hover:border-primary-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full border-2 border-primary-200 bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center">
                      <User className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{pro.name}</h3>
                      <p className="text-sm text-primary-600">{pro.role}</p>
                    </div>
                  </div>
                  {pro.rating >= 4.9 && <BadgeCheck className="text-blue-500 h-6 w-6" />}
                </div>

                {/* Value Proposition */}
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed italic">
                    &ldquo;{pro.valueProposition}&rdquo;
                  </p>
                </div>

                {/* Details */}
                <div className="flex items-center justify-between text-sm text-slate-600 mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {pro.location}
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold text-slate-900">{pro.rating}</span>
                    <span className="text-slate-500 ml-1">({pro.reviewCount})</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  View Profile
                </Button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
