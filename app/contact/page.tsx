import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Mail } from 'lucide-react'
import type { Metadata } from 'next'
import { SUPPORT_EMAIL } from '@/lib/constants'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const metadata: Metadata = {
  title: 'Contact Us | TotalLossToolKit.com',
  description:
    'Get in touch with the TotalLossToolKit support team. We are here to help with your vehicle valuation questions.',
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  openGraph: {
    title: 'Contact Us | TotalLossToolKit.com',
    description: 'Get in touch with the TotalLossToolKit support team.',
    type: 'website',
    url: `${siteUrl}/contact`,
    siteName: 'TotalLossToolKit.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | TotalLossToolKit.com',
    description: 'Get in touch with the TotalLossToolKit support team.',
  },
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Contact Us</h1>
              <p className="text-slate-600">
                Have a question about your report, account, or money-back guarantee? We&apos;re here
                to help.
              </p>
            </div>

            <div className="flex items-start gap-4 bg-primary-50 border border-primary-100 rounded-xl p-6 mb-8">
              <div className="flex-shrink-0 mt-1">
                <Mail className="h-8 w-8 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Email Support</h2>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary-600 hover:underline text-lg font-medium"
                >
                  {SUPPORT_EMAIL}
                </a>
                <p className="text-slate-500 text-sm mt-2">
                  We aim to respond to all inquiries within 5–7 business days.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">What we can help with</h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Questions about your vehicle valuation report</li>
                <li>Account access and login issues</li>
                <li>Money-back guarantee claims</li>
                <li>Billing and payment questions</li>
                <li>Technical issues with the site</li>
                <li>Account deletion requests</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
