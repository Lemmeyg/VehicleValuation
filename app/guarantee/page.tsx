import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Shield, CheckCircle2, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const metadata: Metadata = {
  title: 'Money-Back Guarantee | TotalLossToolKit.com',
  description:
    "Our Premium Report guarantee - if your settlement doesn't increase by more than the report cost, we'll refund your money.",
  alternates: {
    canonical: `${siteUrl}/guarantee`,
  },
  openGraph: {
    title: 'Money-Back Guarantee | TotalLossToolKit.com',
    description:
      "Our Premium Report guarantee - if your settlement doesn't increase by more than the report cost, we'll refund your money.",
    type: 'website',
    url: `${siteUrl}/guarantee`,
    siteName: 'TotalLossToolKit.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Money-Back Guarantee | TotalLossToolKit.com',
    description:
      "Our Premium Report guarantee - if your settlement doesn't increase by more than the report cost, we'll refund your money.",
  },
}

export default function MoneyBackGuaranteePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Money-Back Guarantee
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-slate-600">
                <p>
                  <strong>Effective Date:</strong> January 1st, 2026
                </p>
                <span className="hidden sm:inline">•</span>
                <p>
                  <strong>Version:</strong> 1.0
                </p>
              </div>
            </div>

            {/* Guarantee Hero Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8 flex items-start gap-4">
              <div className="flex-shrink-0">
                <Shield className="h-10 w-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-emerald-900 mb-1">
                  90-Day Money-Back Guarantee
                </h2>
                <p className="text-emerald-800 leading-relaxed">
                  If your settlement doesn&apos;t increase by more than the report cost, we&apos;ll
                  refund you — no questions asked.
                </p>
              </div>
            </div>

            {/* At a Glance Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">At a Glance</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">
                    <strong>Refund if</strong> your settlement increase is less than or equal to the
                    report cost
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">
                    <strong>How to claim</strong> — submit via Contact Us with subject
                    &quot;Money-Back Guarantee Claim&quot; within 90 days of purchase
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">
                    <strong>Timeline</strong> — decision within 14 business days · refund issued in
                    5–7 business days
                  </span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="text-center mb-8">
              <Link
                href="/#hero-form"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
              >
                Get Your Report — Risk Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="prose prose-slate max-w-none">
              {/* Our Commitment to You */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Commitment to You</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We&apos;re confident that our Premium Report will help you secure a fair
                  settlement from your insurance company. In fact, we guarantee it will help
                  increase your settlement by more than the cost of the report—or we&apos;ll refund
                  your money.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Why we offer this guarantee:</strong> We&apos;ve seen countless collision
                  victims accept low offers simply because they didn&apos;t have the information or
                  knowledge to negotiate effectively. Our reports provide the comprehensive market
                  analysis and documentation you need to level the playing field with insurance
                  adjusters. We stand behind the value our reports deliver, and this guarantee
                  proves it.
                </p>
              </section>

              {/* What's Covered */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">What&apos;s Covered</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Our Money-Back Guarantee applies to purchases of our Premium Report only.
                  Here&apos;s how it works:
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  You&apos;re eligible for a refund if:
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    Your final insurance settlement increases by less than or equal to the cost of
                    your Premium Report compared to the carrier&apos;s original offer
                  </li>
                  <li>You purchased the report and meet all the requirements listed below</li>
                </ul>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4">
                  <p className="text-sm text-blue-800">
                    <strong>Example:</strong> If you paid $49 for a Premium Report and your original
                    settlement offer was $8,000, but your final settlement is only $8,040 (a $40
                    increase), you qualify for a $9 refund since the increase was less than the full
                    report cost.
                  </p>
                </div>
              </section>

              {/* What's Required to Claim Your Refund */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  What&apos;s Required to Claim Your Refund
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  To qualify for our Money-Back Guarantee, you must:
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  1. Timing Requirements
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    Submit your refund request within <strong>90 days</strong> of your report
                    purchase date
                  </li>
                  <li>
                    Wait at least <strong>30 days</strong> after purchasing the report before
                    submitting a claim (to allow adequate time for negotiation)
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  2. Negotiation Requirements
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    Actively negotiate with your insurance carrier using the information from our
                    report
                  </li>
                  <li>
                    Share our Premium Vehicle Valuation Report with your insurance adjuster during
                    negotiations
                  </li>
                  <li>
                    Provide written evidence of your negotiation efforts (emails or letters
                    exchanged with the carrier)
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  3. Documentation Requirements
                </h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  You must provide all of the following documents:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    <strong>Original settlement offer:</strong> Written documentation from your
                    insurance carrier showing the initial settlement amount, dated before the
                    creation date of your first report for this VIN
                  </li>
                  <li>
                    <strong>Final settlement payment:</strong> Documentation from your carrier
                    showing the final settlement amount you accepted
                  </li>
                  <li>
                    <strong>Negotiation evidence:</strong> Copies of emails or letters showing you
                    negotiated with the carrier and shared our report with them including the reason
                    why the Total Loss Tool Kit report was not considered applicable in their
                    valuation process
                  </li>
                  <li>
                    <strong>Claim consistency:</strong> The VIN and ZIP code in your insurance claim
                    must match the information in the report you purchased
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  4. How to Submit a Refund Request
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Go to our Contact Us page on the website</li>
                  <li>
                    Submit a refund request with the subject line &quot;Money-Back Guarantee
                    Claim&quot;
                  </li>
                  <li>Include all required documentation listed above</li>
                  <li>You&apos;ll receive instructions on next steps within 14 business days</li>
                </ul>
              </section>

              {/* What's Not Covered */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">What&apos;s Not Covered</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  This guarantee does not apply in the following situations:
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Settlement Type Exclusions
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    <strong>No negotiation attempt:</strong> Cases where you accepted the insurance
                    carrier&apos;s first offer without attempting to negotiate
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Report Type Exclusions
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    <strong>Non-Premium reports:</strong> This guarantee only covers our Premium
                    Report tier, not basic or standard reports
                  </li>
                  <li>
                    <strong>Multiple reports:</strong> If you purchased multiple reports for the
                    same VIN, only the first Premium Report purchased is eligible
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Documentation Issues</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    <strong>Missing documentation:</strong> Incomplete submissions lacking any of
                    the required documents
                  </li>
                  <li>
                    <strong>Inconsistent information:</strong> Cases where the VIN or ZIP code in
                    your insurance claim doesn&apos;t match the report you purchased
                  </li>
                  <li>
                    <strong>Late submissions:</strong> Refund requests submitted more than 90 days
                    after report purchase
                  </li>
                  <li>
                    <strong>Early submissions:</strong> Claims submitted less than 30 days after
                    report purchase
                  </li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  Fraud & Misrepresentation
                </h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>
                    <strong>Fraudulent claims:</strong> Any evidence of fraudulent information in
                    either your insurance claim or refund request
                  </li>
                  <li>
                    <strong>Misrepresented data:</strong> Altered or falsified settlement offers,
                    payment documentation, or negotiation records
                  </li>
                </ul>
              </section>

              {/* Refund Process & Timeline */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Refund Process & Timeline
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Once we receive your complete refund request:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We&apos;ll review your submission and all supporting documentation</li>
                  <li>You&apos;ll receive our decision within 14 business days</li>
                  <li>
                    If approved, your refund will be issued to your original payment method within
                    5-7 business days
                  </li>
                  <li>If we need additional information, we&apos;ll contact you via email</li>
                </ul>
              </section>

              {/* Frequently Asked Questions */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Frequently Asked Questions
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: Can I get a refund if I hired a public adjuster or attorney to help with my
                      claim?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: Yes. Our guarantee still applies even if you used professional assistance,
                      as long as you meet all other requirements.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: What if my insurance company improved their offer but I&apos;m still
                      negotiating?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: You can only submit a refund claim once you&apos;ve reached a final
                      settlement. If negotiations are ongoing, please wait until you have a final
                      settlement amount.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: I have multiple vehicles in my claim. Does the guarantee apply to all of
                      them?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: The guarantee applies separately to each vehicle. If you purchased a
                      Premium Report for each VIN, each report is covered by its own guarantee based
                      on that specific vehicle&apos;s settlement outcome.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: What counts as &quot;sharing the report&quot; with my insurance carrier?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: You must provide evidence that you sent the Premium Report to your
                      adjuster, such as an email with the report attached or a letter referencing
                      specific data from the report.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: My insurance company didn&apos;t increase their offer at all. Am I
                      guaranteed a refund?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: Yes, if your final settlement is equal to or less than the original offer
                      (meaning an increase of $0 or less), and you meet all other requirements, you
                      qualify for a full refund.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: What if I can&apos;t find my original settlement offer letter?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: Contact your insurance carrier and request a copy of their initial
                      valuation or offer letter. Most carriers can provide this documentation upon
                      request.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: The 90-day deadline is approaching but my claim isn&apos;t settled yet.
                      What should I do?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: Contact us immediately through our Contact Us page. We&apos;ll work with
                      you on a case-by-case basis for claims that are still in active negotiation
                      near the deadline.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: Can I get a partial refund if my settlement increased by some amount but
                      less than the report cost?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: Yes. Our guarantee includes a partial refund. If your settlement increase
                      is less than or equal to the report cost, you receive a full refund. If it
                      exceeds the report cost, the guarantee doesn&apos;t apply (because the report
                      more than paid for itself).
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Q: What is the maximum refund I can receive?
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      A: The maximum refund you can receive is for the full cost of one report per
                      claim.
                    </p>
                  </div>
                </div>
              </section>

              {/* Questions About This Guarantee */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Questions About This Guarantee?
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  If you have questions about our Money-Back Guarantee or need clarification on any
                  terms, please contact us through our website. We&apos;re here to help you get the
                  fair settlement you deserve.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  This guarantee demonstrates our confidence in the Premium Vehicle Valuation Report
                  and our commitment to your success in negotiating with insurance carriers.
                </p>
              </section>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-6 mt-8">
                <p className="text-sm text-slate-500 mb-2">
                  <strong>Last Updated:</strong> January 1st, 2026
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  <strong>Version:</strong> 1.0
                </p>
                <p className="text-sm text-slate-600 italic">
                  This Money-Back Guarantee policy is part of our commitment to customer
                  satisfaction. Please read it carefully to understand your rights and our refund
                  process. For questions, please contact us through our website.
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
