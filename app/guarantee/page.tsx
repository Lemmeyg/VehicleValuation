import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

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
                  <strong>Effective Date:</strong> January 1, 2026
                </p>
                <span className="hidden sm:inline">•</span>
                <p>
                  <strong>Version:</strong> 1.0
                </p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none">
              {/* Introduction */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Commitment to You</h2>
                <p className="text-slate-600 leading-relaxed">
                  We stand behind the quality of our vehicle valuation reports and services. If you're not satisfied with your purchase, our Money-Back Guarantee ensures you can request a refund under the conditions outlined below. This policy is designed to protect you while ensuring fair use of our services.
                </p>
              </section>

              {/* Eligibility Criteria */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Eligibility Criteria</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">You May Be Eligible for a Refund If:</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>The report contains significant technical errors that prevent you from accessing or reading the data</li>
                  <li>The VIN you submitted was processed incorrectly and the report shows information for a different vehicle</li>
                  <li>The report was not generated due to a system error or service failure on our end</li>
                  <li>You were charged but did not receive your report within 24 hours of purchase</li>
                  <li>The data sources failed to provide any valuation data despite a valid VIN submission</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">You Are NOT Eligible for a Refund If:</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You simply disagree with the valuation amount or market data provided</li>
                  <li>Your insurance company did not accept the valuation in settlement negotiations</li>
                  <li>You changed your mind after receiving a complete, accurate report</li>
                  <li>You submitted an invalid, fraudulent, or incorrect VIN</li>
                  <li>The report was successfully delivered but you did not download or save it</li>
                  <li>You misunderstood what data would be included in the report (all report features are clearly described before purchase)</li>
                  <li>Market conditions changed after your report was generated</li>
                  <li>Third-party API providers returned limited data for your specific vehicle (vintage, rare, or modified vehicles may have less available market data)</li>
                </ul>
              </section>

              {/* Refund Request Process */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">How to Request a Refund</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Step 1: Submit Your Request</h3>
                <p className="text-slate-600 leading-relaxed mb-3">To request a refund, you must:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Contact us through the contact form on our website within <strong>14 days</strong> of your purchase</li>
                  <li>Provide your order confirmation number or transaction ID</li>
                  <li>Include the VIN associated with the report</li>
                  <li>Clearly explain the reason for your refund request</li>
                  <li>Provide any supporting documentation (screenshots of errors, proof of incorrect data, etc.)</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Step 2: Review Process</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Once we receive your request:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We will acknowledge receipt within 2 business days</li>
                  <li>Our team will review your request and verify the eligibility criteria</li>
                  <li>We may request additional information or clarification</li>
                  <li>Review is typically completed within 5-7 business days</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Step 3: Decision and Processing</h3>
                <p className="text-slate-600 leading-relaxed mb-3">After review:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You will receive an email with our decision (approval or denial)</li>
                  <li>If approved, your refund will be processed to the original payment method</li>
                  <li>Refunds typically appear within 5-10 business days depending on your financial institution</li>
                  <li>If denied, we will provide a clear explanation of the reason</li>
                </ul>
              </section>

              {/* Refund Amounts and Exclusions */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Refund Amounts and Exclusions</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">What Is Refunded</h3>
                <p className="text-slate-600 leading-relaxed mb-3">If your refund is approved, you will receive:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>The full purchase price of the vehicle valuation report</li>
                  <li>Any applicable taxes or fees charged at the time of purchase</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">What Is NOT Refunded</h3>
                <p className="text-slate-600 leading-relaxed mb-3">The following are excluded from all refunds:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li><strong>Payment processing fees:</strong> Stripe and Lemon Squeezy charge non-refundable processing fees for each transaction</li>
                  <li><strong>Bank transfer fees:</strong> Any fees charged by your financial institution</li>
                  <li><strong>Currency conversion fees:</strong> If applicable to international transactions</li>
                  <li><strong>Third-party service fees:</strong> Costs associated with services you may have purchased separately (e.g., consultation with listed advisors)</li>
                </ul>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4">
                  <p className="text-sm text-blue-800">
                    <strong>Important:</strong> Payment processing fees typically range from 2.9% + $0.30 per transaction. These fees are charged by our payment processors (Stripe/Lemon Squeezy) and are non-recoverable even when we issue a refund.
                  </p>
                </div>
              </section>

              {/* Timeframes and Deadlines */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Important Timeframes</h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full border border-slate-300 text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">Action</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">Timeframe</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      <tr>
                        <td className="border border-slate-300 px-4 py-2">Request Deadline</td>
                        <td className="border border-slate-300 px-4 py-2">Within 14 days of purchase</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2">Initial Response</td>
                        <td className="border border-slate-300 px-4 py-2">Within 2 business days</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2">Review Completion</td>
                        <td className="border border-slate-300 px-4 py-2">5-7 business days</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2">Refund Processing</td>
                        <td className="border border-slate-300 px-4 py-2">5-10 business days after approval</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2">Total Maximum Time</td>
                        <td className="border border-slate-300 px-4 py-2">Up to 17 business days from request</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-sm text-slate-500 mt-4 italic">
                  Note: Business days exclude weekends and federal holidays. Actual processing times may vary depending on your financial institution.
                </p>
              </section>

              {/* Limitations and Restrictions */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Limitations and Restrictions</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">One-Time Courtesy Refund</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  We reserve the right to limit refunds to <strong>one courtesy refund per customer</strong> in cases where:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>The reason for refund is subjective (e.g., "not what I expected")</li>
                  <li>The report was delivered correctly but did not meet your personal expectations</li>
                  <li>There was no technical error or service failure</li>
                </ul>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Subsequent refund requests from the same customer may be denied unless they meet strict eligibility criteria (technical errors, system failures, etc.).
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Abuse Prevention</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We reserve the right to deny refunds if we detect:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Repeated refund requests for similar reasons</li>
                  <li>Attempts to obtain reports for free through refund abuse</li>
                  <li>Fraudulent claims or false information in refund requests</li>
                  <li>Violation of our Terms and Conditions</li>
                </ul>
                <p className="text-slate-600 leading-relaxed">
                  Accounts found to be abusing the refund policy may be suspended or terminated without further refunds.
                </p>
              </section>

              {/* Dispute Resolution */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Dispute Resolution</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">If Your Refund Request Is Denied</h3>
                <p className="text-slate-600 leading-relaxed mb-3">If you disagree with our refund decision:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You may submit additional evidence or clarification within 7 days of the denial</li>
                  <li>We will review the new information and provide a final decision</li>
                  <li>If you remain unsatisfied, you may dispute the charge with your credit card company or payment processor</li>
                  <li>Chargebacks may result in account suspension and forfeiture of access to services</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Chargebacks</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  <strong>Important:</strong> Before initiating a chargeback with your bank or credit card company, please contact us directly to resolve the issue. Chargebacks have serious consequences:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Your account will be immediately suspended pending investigation</li>
                  <li>You may be required to provide evidence to your financial institution</li>
                  <li>If the chargeback is resolved in our favor, your account will remain suspended</li>
                  <li>Chargeback fees ($15-25 per dispute) may be passed on to you</li>
                  <li>Multiple chargebacks may result in permanent account termination</li>
                </ul>
              </section>

              {/* Exceptions and Special Cases */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Exceptions and Special Cases</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Extended Timeframes</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  We may grant exceptions to the 14-day request deadline in cases of:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Medical emergencies or hospitalization (documentation required)</li>
                  <li>Natural disasters affecting your area</li>
                  <li>Service outages on our end that prevented timely request submission</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Partial Refunds</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  In some cases, we may offer partial refunds:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>If part of the report data is accurate but one section contains errors</li>
                  <li>If you purchased multiple reports and only one has issues</li>
                  <li>At our sole discretion as a goodwill gesture</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Account Credit Alternative</h3>
                <p className="text-slate-600 leading-relaxed">
                  Instead of a monetary refund, we may offer account credit equal to the purchase price, which can be used for future report purchases. This option may be available when a full refund is not warranted but we recognize inconvenience was caused.
                </p>
              </section>

              {/* Contact for Refund Requests */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">How to Contact Us</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  To submit a refund request or ask questions about this policy, please use the contact form available on our website.
                </p>
                <p className="text-slate-600 leading-relaxed mb-4">
                  When contacting us about a refund, please include:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Your full name and email address associated with the purchase</li>
                  <li>Order confirmation number or transaction ID</li>
                  <li>VIN associated with the report</li>
                  <li>Detailed explanation of the issue</li>
                  <li>Any supporting documentation (screenshots, error messages, etc.)</li>
                </ul>
                <p className="text-slate-600 leading-relaxed">
                  We aim to respond to all refund requests within 2 business days.
                </p>
              </section>

              {/* Relationship to Terms and Conditions */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Relationship to Terms and Conditions</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  This Money-Back Guarantee policy is supplementary to our <a href="/terms" className="text-blue-600 hover:text-blue-800 underline">Terms and Conditions</a>. In the event of any conflict between this policy and the Terms and Conditions, the Terms and Conditions shall prevail.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  By making a purchase, you agree to both this Money-Back Guarantee policy and our complete Terms and Conditions.
                </p>
              </section>

              {/* Changes to This Policy */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Changes to This Policy</h2>
                <p className="text-slate-600 leading-relaxed mb-3">
                  We reserve the right to modify this Money-Back Guarantee policy at any time. Changes will be effective immediately upon posting to our website. Your continued use of our services after changes are posted constitutes acceptance of the modified policy.
                </p>
                <p className="text-slate-600 leading-relaxed mb-4">
                  <strong>Important:</strong> The policy in effect at the time of your purchase will govern any refund requests for that purchase.
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>The "Effective Date" at the top of this page will be updated when changes are made</li>
                  <li>Significant changes will be announced via email or website notice</li>
                  <li>We recommend reviewing this policy periodically</li>
                </ul>
              </section>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-6 mt-8">
                <p className="text-sm text-slate-500 mb-2">
                  <strong>Last Updated:</strong> January 1, 2026
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  <strong>Version:</strong> 1.0
                </p>
                <p className="text-sm text-slate-600 italic">
                  This Money-Back Guarantee policy is part of our commitment to customer satisfaction. Please read it carefully to understand your rights and our refund process. For questions, please contact us through our website.
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
