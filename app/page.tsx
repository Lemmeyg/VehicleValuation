/**
 * Home Page / Landing Page
 *
 * Main landing page for the Vehicle Valuation SaaS application.
 * Updated with new funnel flow: Hero (with form) → Problem Statement → Knowledge Base → Directory → Value Props & CTA
 */

import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import ProblemStatement from '@/components/ProblemStatement'
import KnowledgeBase from '@/components/KnowledgeBase'
import Directory from '@/components/Directory'
import Testimonials from '@/components/Testimonials'
import Footer from '@/components/Footer'
import PasswordResetRedirect from '@/components/PasswordResetRedirect'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Handle password reset codes that land on home page (Supabase misconfiguration workaround) */}
      <Suspense fallback={null}>
        <PasswordResetRedirect />
      </Suspense>

      {/* Navigation */}
      <Navbar />

      {/* Hero Section with Email + VIN + Mileage + ZIP Form */}
      <Hero />

      {/* Problem Statement Section */}
      <ProblemStatement />

      {/* Knowledge Base Section with Rotating Articles */}
      <KnowledgeBase />

      {/* Directory Section with 5-Profile Carousel */}
      <Directory />

      {/* Value Propositions & CTA Section (formerly Testimonials) */}
      <Testimonials />

      {/* Footer */}
      <Footer />
    </div>
  )
}
