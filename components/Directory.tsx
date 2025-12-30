'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from './ui/Button'
import { MapPin, Star, BadgeCheck, User, ChevronLeft, ChevronRight } from 'lucide-react'

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

export default function Directory() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handlePrevious = () => {
    setCurrentIndex(prev => (prev === 0 ? PROFESSIONALS.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev === PROFESSIONALS.length - 1 ? 0 : prev + 1))
  }

  return (
    <section id="services-directory" className="py-24 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
      {/* Background blob */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-900/20 rounded-full blur-[100px] pointer-events-none animate-blob" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-emerald-600 font-semibold tracking-wide uppercase text-sm">
            Professional Network
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-6">
            Connect with Trusted Professionals
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Find certified experts who understand your challenges and fight for fair compensation.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative max-w-4xl mx-auto mb-12">
          {/* Navigation Arrows */}
          <button
            onClick={handlePrevious}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white rounded-full p-3 shadow-lg hover:shadow-xl hover:bg-primary-50 transition-all group"
            aria-label="Previous professional"
          >
            <ChevronLeft className="h-6 w-6 text-slate-900 group-hover:text-primary-600" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-3 shadow-lg hover:shadow-xl hover:bg-primary-50 transition-all group"
            aria-label="Next professional"
          >
            <ChevronRight className="h-6 w-6 text-slate-900 group-hover:text-primary-600" />
          </button>

          {/* Profile Cards */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {PROFESSIONALS.map(pro => (
                <div key={pro.id} className="w-full flex-shrink-0 px-4">
                  <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center shadow-lg">
                          <User className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-slate-900 font-bold text-xl">{pro.name}</h3>
                          <p className="text-emerald-600 text-sm font-medium">{pro.role}</p>
                        </div>
                      </div>
                      {pro.rating >= 4.9 && <BadgeCheck className="text-primary-600 h-7 w-7" />}
                    </div>

                    {/* Value Proposition */}
                    <div className="mb-6 bg-gradient-to-br from-primary-50 to-emerald-50 p-4 rounded-lg border border-primary-100">
                      <p className="text-slate-700 leading-relaxed italic">
                        &ldquo;{pro.valueProposition}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-slate-600 text-sm mb-6 border-y border-slate-100 py-4">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-slate-400" /> {pro.location}
                      </div>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-slate-900 mr-1">{pro.rating}</span>
                        <span className="text-slate-500">({pro.reviewCount} reviews)</span>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      className="w-full"
                    >
                      View Profile
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Indicators */}
          <div className="flex justify-center mt-6 space-x-2">
            {PROFESSIONALS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'w-8 bg-primary-500'
                    : 'w-2 bg-slate-600 hover:bg-slate-500'
                }`}
                aria-label={`Go to professional ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/directory">
            <Button variant="primary" size="lg">
              Link to directory
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
