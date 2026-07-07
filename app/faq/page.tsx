import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import type { Metadata } from 'next'
import { SUPPORT_EMAIL } from '@/lib/constants'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | TotalLossToolKit.com',
  description:
    'Find answers to common questions about TotalLossToolKit and our vehicle valuation reports.',
  alternates: {
    canonical: `${siteUrl}/faq`,
  },
  openGraph: {
    title: 'Frequently Asked Questions | TotalLossToolKit.com',
    description:
      'Find answers to common questions about TotalLossToolKit and our vehicle valuation reports.',
    type: 'website',
    url: `${siteUrl}/faq`,
    siteName: 'TotalLossToolKit.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frequently Asked Questions | TotalLossToolKit.com',
    description:
      'Find answers to common questions about TotalLossToolKit and our vehicle valuation reports.',
  },
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Frequently Asked Questions
              </h1>
              <p className="text-slate-600">
                Find answers to common questions about TotalLossToolKit and our vehicle valuation
                reports.
              </p>
            </div>

            <div className="prose prose-slate max-w-none">
              {/* Table of Contents */}
              <section className="mb-8 p-6 bg-slate-50 rounded-lg">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Links</h2>
                <ul className="list-disc pl-6 text-slate-600 space-y-1">
                  <li>
                    <a href="#what-is-tltk" className="text-primary-600 hover:underline">
                      What is TotalLossToolKit?
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="text-primary-600 hover:underline">
                      How does the valuation report work?
                    </a>
                  </li>
                  <li>
                    <a href="#vin-questions" className="text-primary-600 hover:underline">
                      VIN & Vehicle Information
                    </a>
                  </li>
                  <li>
                    <a href="#pricing-payment" className="text-primary-600 hover:underline">
                      Pricing & Payment
                    </a>
                  </li>
                  <li>
                    <a href="#reports" className="text-primary-600 hover:underline">
                      About Your Report
                    </a>
                  </li>
                  <li>
                    <a href="#account" className="text-primary-600 hover:underline">
                      Account & Login
                    </a>
                  </li>
                  <li>
                    <a href="#privacy-security" className="text-primary-600 hover:underline">
                      Privacy & Security
                    </a>
                  </li>
                  <li>
                    <a href="#guarantee" className="text-primary-600 hover:underline">
                      Money-Back Guarantee
                    </a>
                  </li>
                  <li>
                    <a href="#contact-support" className="text-primary-600 hover:underline">
                      Contact & Support
                    </a>
                  </li>
                </ul>
              </section>

              {/* What is TotalLossToolKit */}
              <section id="what-is-tltk" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  What is TotalLossToolKit?
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What does TotalLossToolKit do?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      TotalLossToolKit provides comprehensive vehicle valuation reports designed to
                      help vehicle owners negotiate fair settlements with insurance companies after
                      a total loss claim. Our reports use multiple data sources to give you an
                      accurate picture of your vehicle&apos;s true market value.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Who should use this service?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Our service is ideal for anyone who has had their vehicle declared a total
                      loss by their insurance company and wants to ensure they receive fair
                      compensation. This includes victims of accidents, theft, natural disasters, or
                      any other event that resulted in a total loss determination.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Why might I need an independent valuation?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Insurance companies often use their own valuation methods that may undervalue
                      your vehicle. An independent, comprehensive valuation report gives you
                      documented evidence to support your claim for a higher settlement amount.
                    </p>
                  </div>
                </div>
              </section>

              {/* How It Works */}
              <section id="how-it-works" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">How Does It Work?</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What is the process for getting a report?
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-3">
                      Getting your valuation report is simple:
                    </p>
                    <ol className="list-decimal pl-6 text-slate-600 space-y-2">
                      <li>
                        Enter your vehicle&apos;s VIN (Vehicle Identification Number) and current
                        mileage
                      </li>
                      <li>Create an account or log in to your existing account</li>
                      <li>Complete your purchase</li>
                      <li>Receive your comprehensive valuation report</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How long does it take to get my report?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Reports are typically generated within minutes of completing your purchase.
                      You&apos;ll be able to access your report immediately from your dashboard, and
                      we&apos;ll also send you an email notification when it&apos;s ready.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What data sources do you use?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      We aggregate data from multiple trusted automotive data providers and market
                      sources to provide a comprehensive view of your vehicle&apos;s value. This
                      includes comparable vehicle listings, auction data, and industry valuation
                      guides.
                    </p>
                  </div>
                </div>
              </section>

              {/* VIN Questions */}
              <section id="vin-questions" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  VIN & Vehicle Information
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Where can I find my VIN?
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-3">
                      Your 17-character VIN can be found in several locations:
                    </p>
                    <ul className="list-disc pl-6 text-slate-600 space-y-2">
                      <li>On your vehicle registration or title documents</li>
                      <li>On your insurance card or policy documents</li>
                      <li>On the driver&apos;s side dashboard, visible through the windshield</li>
                      <li>On the driver&apos;s side door jamb sticker</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What if I enter the wrong VIN?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Please double-check your VIN before submitting. If you accidentally enter an
                      incorrect VIN, please contact our support team and we&apos;ll help resolve the
                      issue. Reports generated with incorrect VINs may be eligible for correction
                      under our guarantee policy.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Why do you need my mileage?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Mileage is a significant factor in determining a vehicle&apos;s value.
                      Accurate mileage helps us provide a more precise valuation that reflects your
                      specific vehicle&apos;s condition and market value.
                    </p>
                  </div>
                </div>
              </section>

              {/* Pricing & Payment */}
              <section id="pricing-payment" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Pricing & Payment</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How much does a report cost?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Please visit our{' '}
                      <a href="/pricing" className="text-primary-600 hover:underline">
                        Pricing page
                      </a>{' '}
                      for current report pricing. We offer competitive rates for comprehensive
                      valuation reports.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What payment methods do you accept?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      We accept all major credit cards (Visa, Mastercard, American Express) through
                      our secure payment processor, Lemon Squeezy. All transactions are encrypted
                      and secure.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Can I get a refund?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Yes! We offer a money-back guarantee. If you&apos;re not satisfied with your
                      report or if there are issues with the data provided, please see our{' '}
                      <a href="/guarantee" className="text-primary-600 hover:underline">
                        Money-Back Guarantee
                      </a>{' '}
                      page for full details on our refund policy.
                    </p>
                  </div>
                </div>
              </section>

              {/* About Your Report */}
              <section id="reports" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">About Your Report</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What&apos;s included in the valuation report?
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-3">
                      Our comprehensive reports typically include:
                    </p>
                    <ul className="list-disc pl-6 text-slate-600 space-y-2">
                      <li>Vehicle specifications and decoded VIN information</li>
                      <li>Market value analysis from multiple data sources</li>
                      <li>Comparable vehicle listings in your market</li>
                      <li>Supporting documentation for insurance negotiations</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How do I access my report?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Once your report is generated, you can access it from your account dashboard.
                      You can view, download, and print your report at any time. We also send a
                      notification email when your report is ready.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Can I share my report with my insurance company?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Absolutely! That&apos;s exactly what our reports are designed for. You can
                      download a PDF version of your report and submit it directly to your insurance
                      adjuster as supporting evidence for your valuation claim.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How long do I have access to my report?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Your reports are stored in your account and remain accessible as long as your
                      account is active. We recommend downloading and saving a copy for your
                      records.
                    </p>
                  </div>
                </div>
              </section>

              {/* Account & Login */}
              <section id="account" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Account & Login</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Do I need an account to get a report?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Yes, an account is required to purchase and access your valuation reports.
                      Creating an account is free and allows you to securely store and access your
                      reports at any time.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      I forgot my password. How do I reset it?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Click the &quot;Forgot Password&quot; link on the login page and enter your
                      email address. We&apos;ll send you a secure link to reset your password.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Can I delete my account?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Yes, you can request account deletion at any time by emailing{' '}
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-primary-600 hover:underline"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                      . Please note that account deletion will remove access to any previously
                      generated reports.
                    </p>
                  </div>
                </div>
              </section>

              {/* Privacy & Security */}
              <section id="privacy-security" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Privacy & Security</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Is my VIN information secure?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Yes. We treat VIN data as sensitive information and implement strong security
                      measures to protect it. Your VIN is only shared with trusted data providers
                      necessary to generate your report. We never sell VIN data. For full details,
                      see our{' '}
                      <a href="/privacy" className="text-primary-600 hover:underline">
                        Privacy Policy
                      </a>
                      .
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Do you sell my personal information?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      No. We do not sell your personal information to third parties. Your data is
                      used solely to provide our services and is protected according to our Privacy
                      Policy.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How is my payment information protected?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      We use Lemon Squeezy for payment processing. We never see or store your full
                      credit card details. All payment transactions are encrypted and processed
                      through PCI-DSS compliant systems.
                    </p>
                  </div>
                </div>
              </section>

              {/* Money-Back Guarantee */}
              <section id="guarantee" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Money-Back Guarantee</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      What does your guarantee cover?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      We stand behind our reports. If there are issues with the data accuracy or
                      you&apos;re unsatisfied with your report for a valid reason, you may be
                      eligible for a refund. Please see our full{' '}
                      <a href="/guarantee" className="text-primary-600 hover:underline">
                        Money-Back Guarantee
                      </a>{' '}
                      terms for details.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How do I request a refund?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Email us at{' '}
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-primary-600 hover:underline"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                      , explain the issue with your report, and we&apos;ll review your request
                      promptly.
                    </p>
                  </div>
                </div>
              </section>

              {/* Contact & Support */}
              <section id="contact-support" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact & Support</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      How can I contact support?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Email us at{' '}
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-primary-600 hover:underline"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                      . We aim to respond to all inquiries within 5-7 business days.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      I have a question not listed here.
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      No problem! Email us at{' '}
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-primary-600 hover:underline"
                      >
                        {SUPPORT_EMAIL}
                      </a>{' '}
                      and we&apos;ll be happy to help answer any questions you have about our
                      service.
                    </p>
                  </div>
                </div>
              </section>

              {/* Footer Note */}
              <div className="border-t border-slate-200 pt-6 mt-8">
                <p className="text-sm text-slate-500">
                  <strong>Last Updated:</strong> January 2026
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  Didn&apos;t find what you were looking for?{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">
                    Contact us
                  </a>{' '}
                  and we&apos;ll be happy to help.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
