// lib/pricing/constants.ts

export interface PricingTier {
  id: 'BASIC' | 'PREMIUM'
  name: string
  price: number
  variantId: string
  features: string[]
  recommended?: boolean
}

const CORE_FEATURES = [
  'Real market data from 450M+ vehicle listings',
  'Valuations accurate to within 5% of actual sale price',
  'High/low range with actual vehicle valuation',
  '10 verified live listings for comparison',
  'Covers 25+ model years with equipment-level precision',
]

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'BASIC',
    name: 'Basic Report',
    price: 19,
    variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID!,
    features: CORE_FEATURES,
  },
  {
    id: 'PREMIUM',
    name: 'Premium Report',
    price: 25,
    variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID!,
    features: [
      ...CORE_FEATURES,
      'Two free report refreshes with updated listings',
      "Money-back guarantee if we don't beat your insurer's offer",
    ],
    recommended: true,
  },
]

export const TESTIMONIALS = [
  {
    quote:
      'First offer was $23.5K. I provided an updated list of comparable sales from the report and ended up receiving $28K — a $4,500 increase.',
    attribution: 'M.R., California — 2020 Honda Civic',
    outcome: '+$4,500',
  },
  {
    quote:
      'They initially tried to offer $9,800 for my car. An independent vehicle evaluation pegged it at $23,000. They cut me a check a week later.',
    attribution: 'T.K., Texas — 2018 Toyota Camry',
    outcome: '+$13,200',
  },
]

export const WHATS_INCLUDED = [
  { label: 'Accurate market value from 450M+ real listings' },
  { label: '10 verified comparable vehicles with prices and locations' },
  { label: 'High/low value range with confidence score' },
  { label: 'VIN-decoded equipment and trim-level precision' },
  { label: 'Regional pricing factors specific to your ZIP code' },
  { label: 'Negotiation-ready PDF format with professional layout' },
]
