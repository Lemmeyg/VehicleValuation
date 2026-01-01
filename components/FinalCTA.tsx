'use client'

/**
 * Final CTA Section
 *
 * Last call-to-action before footer.
 * Scrolls user back to hero form with smooth animation.
 */

import { Button } from './ui/Button'
import { Shield, Lock, Award, CheckCircle2 } from 'lucide-react'

export default function FinalCTA() {
  const handleScrollToForm = () => {
    const heroForm = document.getElementById('hero-form')
    if (heroForm) {
      const offset = 80 // Account for fixed navbar
      const elementPosition = heroForm.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      })

      // Optional: Highlight form briefly
      heroForm.classList.add('ring-4', 'ring-primary-500', 'ring-opacity-50', 'transition-all', 'duration-500')
      setTimeout(() => {
        heroForm.classList.remove('ring-4', 'ring-primary-500', 'ring-opacity-50')
      }, 2000)
    }
  }

  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Get Your Collision Valuation Report Now
        </h2>
        <p className="text-xl text-slate-300 mb-8">
          Stop guessing. Start negotiating with data.
        </p>

        <Button
          onClick={handleScrollToForm}
          size="lg"
          className="px-12 py-6 text-lg font-semibold bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700 mb-12"
        >
          Calculate My Vehicle Value →
        </Button>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-8 text-slate-400 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <span>SSL Secure</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            <span>Money-Back Guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>BBB Accredited</span>
          </div>
        </div>
      </div>
    </section>
  )
}
