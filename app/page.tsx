/**
 * Home Page / Landing Page
 *
 * Main landing page for the Vehicle Valuation SaaS application.
 * Updated with new funnel flow: Hero (with form) → Problem Statement → Knowledge Base → Directory → Value Props & CTA
 */

import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import ProblemStatement from '@/components/ProblemStatement'
import KnowledgeBase from '@/components/KnowledgeBase'
import Directory from '@/components/Directory'
import Testimonials from '@/components/Testimonials'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
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
