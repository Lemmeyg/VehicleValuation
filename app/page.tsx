/**
 * Home Page / Landing Page
 *
 * Main landing page for the Vehicle Valuation SaaS application.
 */

import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import FeatureCards from '@/components/FeatureCards'
import VehicleValuation from '@/components/VehicleValuation'
import KnowledgeBase from '@/components/KnowledgeBase'
import Directory from '@/components/Directory'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Feature Cards - Replaces "Why Choose Us" */}
      <FeatureCards />

      {/* Vehicle Valuation Section with VIN input and Pricing */}
      <VehicleValuation />

      {/* Knowledge Base Section with Rotating Articles */}
      <KnowledgeBase />

      {/* Directory Section with 5-Profile Carousel */}
      <Directory />

      {/* Footer */}
      <Footer />
    </div>
  )
}
