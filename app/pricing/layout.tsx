import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const metadata: Metadata = {
  title: 'Pricing - Vehicle Valuation Reports | TotalLossToolKit.com',
  description:
    'Get professional vehicle valuation reports starting at $19. Basic and Premium report options for total loss claims and insurance negotiations.',
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
  openGraph: {
    title: 'Pricing - Vehicle Valuation Reports | TotalLossToolKit.com',
    description:
      'Get professional vehicle valuation reports starting at $19. Basic and Premium report options for total loss claims and insurance negotiations.',
    type: 'website',
    url: `${siteUrl}/pricing`,
    siteName: 'TotalLossToolKit.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing - Vehicle Valuation Reports | TotalLossToolKit.com',
    description:
      'Get professional vehicle valuation reports starting at $19. Basic and Premium report options for total loss claims and insurance negotiations.',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
