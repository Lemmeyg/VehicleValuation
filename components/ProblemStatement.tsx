'use client'

import { ArrowRight, Quote } from 'lucide-react'
import Link from 'next/link'

/**
 * Problem Statement Section
 *
 * Explains the core problem: insurance companies lowball claims.
 * Includes testimonials and CTAs throughout.
 */

export default function ProblemStatement() {
  return (
    <section className="relative py-20 bg-gradient-to-br from-slate-50 via-white to-primary-50/30 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section 1: Don't Accept Their First Offer */}
        <div className="mb-16">
          {/* Intro questions */}
          <div className="bg-slate-100 border-l-4 border-primary-500 rounded-r-lg p-6 mb-10">
            <ul className="space-y-3 text-xl md:text-2xl text-slate-700">
              <li className="flex items-start gap-3">
                <span className="text-primary-500 font-bold">&#8226;</span>
                <span>Just been in a serious collision?</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-500 font-bold">&#8226;</span>
                <span>Have no car (and need one now)?</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-500 font-bold">&#8226;</span>
                <span>Have to battle with insurance carriers for a fair valuation?</span>
              </li>
            </ul>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Don&apos;t Accept Their First Offer
          </h2>
          <div className="space-y-4 text-lg text-slate-700 leading-relaxed">
            <p>
              When your car is totaled, insurance companies count on one thing: that you&apos;ll accept their first offer—in fact, that you won&apos;t even realize it&apos;s an offer.
            </p>
            <p>
              The initial offer is almost always low—sometimes by <strong className="text-slate-900">thousands of dollars</strong>. But here&apos;s what they don&apos;t advertise: that number is negotiable. Real car owners are discovering they can increase their payouts by <strong className="text-primary-600">$1,500</strong>, <strong className="text-primary-600">$4,000</strong>, even <strong className="text-primary-600">$13,000</strong> just by pushing back with the right information and evidence.
            </p>
          </div>

          {/* Quote Callouts */}
          <div className="mt-8 space-y-4">
            <blockquote className="bg-white border-l-4 border-primary-500 pl-6 py-4 pr-6 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-6 w-6 text-primary-400 flex-shrink-0 mt-1" />
                <p className="text-slate-700 italic">
                  &ldquo;We pretty much got <strong className="text-primary-600 not-italic">$1,500 more</strong>... Always ask for more.&rdquo;
                </p>
              </div>
            </blockquote>
            <blockquote className="bg-white border-l-4 border-primary-500 pl-6 py-4 pr-6 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-6 w-6 text-primary-400 flex-shrink-0 mt-1" />
                <p className="text-slate-700 italic">
                  &ldquo;First offer was $23.5K... sent an updated list of comps and ended up receiving <strong className="text-primary-600 not-italic">$28K</strong>.&rdquo;
                </p>
              </div>
            </blockquote>
          </div>

          {/* CTA Button */}
          <div className="mt-8">
            <Link
              href="#hero-form"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Get Your Independent Valuation Report
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <h2 className="mt-10 mb-6 text-3xl md:text-4xl font-bold text-slate-900">
            Remember: the carrier&apos;s first valuation is an offer, so negotiate.
          </h2>
        </div>

        {/* Section 2: You Don't Need a Lawyer */}
        <div className="mb-16 -mt-10">
          <div className="space-y-4 text-lg text-slate-700 leading-relaxed">
            <p>
              You don&apos;t usually need a lawyer taking 33% of your settlement. You don&apos;t need to accept an offer that won&apos;t even cover a comparable replacement vehicle.
            </p>
            <p>
              What you need is the <strong className="text-slate-900">right information</strong>—an independent valuation that shows what your car is actually worth, backed by real market data they can&apos;t ignore.
            </p>
          </div>

          {/* Quote Callouts */}
          <div className="mt-8 space-y-4">
            <blockquote className="bg-white border-l-4 border-primary-500 pl-6 py-4 pr-6 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-6 w-6 text-primary-400 flex-shrink-0 mt-1" />
                <p className="text-slate-700 italic">
                  &ldquo;They initially tried to offer <strong className="text-primary-600 not-italic">$9,800</strong>... The independent vehicle evaluator pegged it at <strong className="text-primary-600 not-italic">$23,000</strong>. They cut me a check a week later.&rdquo;
                </p>
              </div>
            </blockquote>
            <blockquote className="bg-white border-l-4 border-primary-500 pl-6 py-4 pr-6 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-6 w-6 text-primary-400 flex-shrink-0 mt-1" />
                <p className="text-slate-700 italic">
                  &ldquo;We countered with $19k with comp listings... Finally settled around <strong className="text-primary-600 not-italic">$17k</strong>, <strong className="text-primary-600 not-italic">$7k higher</strong> than their original offer.&rdquo;
                </p>
              </div>
            </blockquote>
          </div>

          {/* CTA Button */}
          <div className="mt-8">
            <Link
              href="#hero-form"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Get Your Updated List of Comps Now!
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Section 3: Protect Yourself with Real-time Data */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Protect Yourself with Real-time Data
          </h2>
          <div className="space-y-4 text-lg text-slate-700 leading-relaxed">
            <p>
              The insurance adjuster&apos;s job is to close your claim quickly and cheaply. <strong className="text-slate-900">Your job is to make sure you get every dollar you deserve.</strong>
            </p>
            <p>
              Our detailed vehicle valuation reports give you the ammunition you need to negotiate confidently. We combine multiple premium data sources to show you exactly what your vehicle is worth, find comparable listings in your area, and document your car&apos;s true value—the same evidence that&apos;s helping drivers across the country walk away with thousands more.
            </p>
            <p className="text-xl font-semibold text-slate-900">
              Stop leaving money on the table. Get the valuation that levels the playing field.
            </p>
          </div>

          {/* CTA Button */}
          <div className="mt-8">
            <Link
              href="#hero-form"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Get Your Independent Valuation Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* More Quote Callouts */}
          <div className="mt-10 space-y-4">
            <blockquote className="bg-white border-l-4 border-emerald-500 pl-6 py-4 pr-6 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-1" />
                <p className="text-slate-700 italic">
                  &ldquo;Nearly doubled my payout just by sticking to my guns. I countered... they came up to <strong className="text-emerald-600 not-italic">$2,300</strong>!&rdquo;
                </p>
              </div>
            </blockquote>
            <blockquote className="bg-white border-l-4 border-emerald-500 pl-6 py-4 pr-6 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Quote className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-1" />
                <p className="text-slate-700 italic">
                  &ldquo;I <strong className="text-emerald-600 not-italic">more than doubled</strong> the money I got back just by pushing back on their offer.&rdquo;
                </p>
              </div>
            </blockquote>
          </div>

          {/* CTA Button - below quotes */}
          <div className="mt-8">
            <Link
              href="#hero-form"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Get Your Independent Valuation Report
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
