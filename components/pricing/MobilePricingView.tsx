'use client'

import { useRef, useState } from 'react'
import {
  Check,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Quote,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics/events'
import {
  getPersonalizedVehicleLabel,
  type PersonalizationVehicleData,
} from '@/lib/personalization/vehicle-label'
import type { PricingTier } from '@/lib/pricing/constants'
import { TESTIMONIALS } from '@/lib/pricing/constants'
import MobilePricingSampleReport from './MobilePricingSampleReport'

interface MobilePricingViewProps {
  vehicleData: PersonalizationVehicleData | null | undefined
  tiers: PricingTier[]
  onSelectPlan: (tier: PricingTier) => void
  processingPayment: boolean
  reportId?: string
}

interface FaqItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do you find my vehicle information?',
    answer:
      'We use your unique VIN (Vehicle Identification Number) to pull comprehensive factory build sheets, ensuring every option — from trim level to equipment packages — is included in the valuation.',
  },
  {
    question: 'Is there a money-back guarantee?',
    answer:
      "Yes — the Premium Report includes a 90-Day Money-Back Guarantee. If your settlement offer doesn't increase after using it, we'll refund you in full within 90 days, no questions asked.",
  },
  {
    question: 'How long does it take to receive my report?',
    answer:
      "It takes less than a minute to create the report and you'll see it in your browser. You'll also be emailed a copy within 24 hours.",
  },
  {
    question: 'What if my car is rare or customized?',
    answer:
      "For rare or highly modified vehicles, we recommend the Premium Report — it draws on a wider pool of comparable sales to better capture value that standard software alone can miss. If we don't have sufficient data for your vehicle, we'll issue a full refund and notify you within 24 hours.",
  },
  {
    question: "What if I disagree with the report's value?",
    answer:
      "That's exactly what the report is for. Use the comparable sales and valuation range as evidence in a written dispute — pair it with our free dispute letter template — or cite it during an appraisal-clause negotiation with your insurer.",
  },
  {
    question: 'Does this work for any vehicle make, model, or year?',
    answer:
      'Our data covers passenger vehicles across 25+ model years. If your vehicle is especially rare, customized, or a commercial/specialty vehicle, there may not be sufficient data to populate the report. If that is the case, you will be issued a refund and notified within 24 hours.',
  },
]

export default function MobilePricingView({
  vehicleData,
  tiers,
  onSelectPlan,
  processingPayment,
  reportId,
}: MobilePricingViewProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const premiumCardRef = useRef<HTMLDivElement>(null)

  const vehicleLabel = getPersonalizedVehicleLabel(vehicleData)

  return (
    <div className="md:hidden">
      {/* Hero headline */}
      <div className="mb-6 text-center">
        {vehicleLabel ? (
          <>
            <h1 className="mb-2 text-2xl font-bold leading-tight text-slate-900">
              Your <span className="italic text-primary-600">{vehicleLabel}</span> may be
              undervalued by your insurer.
            </h1>
            <p className="text-sm text-slate-600">
              Industry data shows 9 out of 10 total-loss claims are undervalued by insurers — most
              owners never push back. Our report gives you 10 real comparable sales to dispute your
              carrier&apos;s number and recover what you&apos;re owed.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold leading-tight text-slate-900">
              Get Paid What Your Vehicle Is Worth
            </h1>
            <p className="text-sm text-slate-600">
              Industry data shows 9 out of 10 total-loss claims are undervalued by insurers. Our
              report gives you 10 real comparable sales to dispute the number and recover what
              you&apos;re owed.
            </p>
          </>
        )}
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-emerald-50 p-2 text-center shadow-sm">
          <AlertTriangle className="mb-1 h-4 w-4 text-emerald-600" />
          <h3 className="text-base font-bold leading-tight text-primary-700">9/10</h3>
          <p className="text-[9px] uppercase leading-tight tracking-wider text-slate-500">
            Claims undervalued
          </p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-emerald-50 p-2 text-center shadow-sm">
          <TrendingUp className="mb-1 h-4 w-4 text-emerald-600" />
          <h3 className="text-base font-bold leading-tight text-primary-700">34%</h3>
          <p className="text-[9px] uppercase leading-tight tracking-wider text-slate-500">
            Avg. settlement increase
          </p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-emerald-50 p-2 text-center shadow-sm">
          <Calendar className="mb-1 h-4 w-4 text-emerald-600" />
          <h3 className="text-base font-bold leading-tight text-primary-700">90 Days</h3>
          <p className="text-[9px] uppercase leading-tight tracking-wider text-slate-500">
            To dispute your offer
          </p>
        </div>
      </div>

      {/* Sample report preview */}
      <MobilePricingSampleReport
        onExpand={() => trackEvent('report_preview_viewed', { reportId })}
      />

      {/* Pricing cards */}
      <div className="mb-8">
        <div className="mb-2 text-center">
          <h2 className="mb-1 text-2xl font-bold text-slate-900">Choose Your Report</h2>
          <p className="text-xs text-slate-500">
            One-time payment · Instant access · 100% satisfaction guarantee
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Already have an account?{' '}
            <a href="/auth" className="text-primary-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-6">
          {tiers.map(tier => (
            <div
              key={tier.id}
              ref={tier.recommended ? premiumCardRef : undefined}
              className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-lg ${
                tier.recommended
                  ? 'mt-2 border-primary-500 bg-gradient-to-br from-white to-primary-50 shadow-primary-100'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {tier.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary-600 px-4 py-1 text-sm font-semibold text-white shadow-sm">
                  RECOMMENDED
                </div>
              )}
              <h3 className="mb-2 text-xl font-bold text-slate-900">{tier.name}</h3>
              <div className="mb-5">
                <span
                  className={`text-3xl font-bold ${
                    tier.recommended ? 'text-primary-600' : 'text-slate-900'
                  }`}
                >
                  ${tier.price}
                </span>
                <span className="ml-1 text-sm text-slate-400">one-time</span>
              </div>
              <ul className="mb-6 flex-grow space-y-3">
                {tier.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                    <span
                      className={`text-sm text-slate-700 ${tier.recommended ? 'font-semibold' : ''}`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.recommended ? 'primary' : 'outline'}
                onClick={() => onSelectPlan(tier)}
                disabled={processingPayment}
                className={`w-full py-3.5 text-base font-semibold ${
                  tier.recommended ? 'bg-primary-600 hover:bg-primary-700' : ''
                }`}
              >
                {processingPayment ? 'Processing...' : `Get ${tier.name} — $${tier.price}`}
                {tier.recommended && !processingPayment && (
                  <ArrowRight className="ml-2 inline h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Success Stories */}
      <div className="mb-8 rounded-2xl bg-slate-50 py-8">
        <div className="px-4">
          <h2 className="mb-6 text-center text-xl font-bold text-slate-900">Success Stories</h2>
          <div className="flex flex-col gap-6">
            {TESTIMONIALS.map(t => (
              <div
                key={t.attribution}
                className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <Quote className="mb-3 h-6 w-6 text-primary-300" />
                <p className="mb-4 text-sm italic text-slate-700">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs text-slate-500">{t.attribution}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <h2 className="mb-6 text-center text-xl font-bold text-slate-900">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaqIndex === index
            return (
              <div
                key={item.question}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-900">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-slate-500 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && <div className="p-4 pt-0 text-sm text-slate-600">{item.answer}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Money-Back Guarantee banner */}
      <div className="mb-8">
        <div className="flex flex-col items-start gap-5 rounded-3xl bg-primary-600 p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 rounded-2xl bg-white/10 p-3">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">
              90-Day Money-Back Guarantee — Premium Report
            </h3>
          </div>
          <p className="text-sm text-white/80">
            If your settlement offer doesn&apos;t increase after using our Premium Report,
            we&apos;ll refund you in full — no questions asked within 90 days.
          </p>
          <a
            href="/guarantee"
            className="text-sm font-semibold text-white underline underline-offset-2"
          >
            Full terms →
          </a>
          <button
            type="button"
            onClick={() =>
              premiumCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            className="w-full rounded-xl bg-white px-6 py-3.5 font-bold text-primary-600 shadow-lg transition-transform active:scale-95"
          >
            Purchase Now
          </button>
        </div>
      </div>
    </div>
  )
}
