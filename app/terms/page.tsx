import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Terms and Conditions
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
              {/* Acceptance of Terms */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Acceptance of Terms</h2>
                <p className="text-slate-600 leading-relaxed">
                  By accessing or using this website (the "Service"), you agree to these Terms and Conditions ("Terms"). These form a binding contract between you ("User," "you," or "your") and [Your Company Name] ("we," "us," or "our"). If you do not agree, do not use the Service. We may update Terms anytime; continued use means acceptance.
                </p>
              </section>

              {/* Description of Service */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Description of Service</h2>
                <p className="text-slate-600 leading-relaxed">
                  The Service offers vehicle valuation estimates via MarketCheck Price™ Premium API (retail predictions from dealer listings), links/references to vehicle owners, a directory of service providers in relevant areas and a knowledge base with informational articles. None constitute endorsements, partnerships, or legal/financial advice. Service advisors/providers are independent and unaffiliated with us.
                </p>
              </section>

              {/* Account Registration and Security */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Account Registration and Security</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Account Creation and Confidentiality</h3>
                <p className="text-slate-600 leading-relaxed mb-3">When you create an account with us, you agree to:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and promptly update your account information to keep it accurate and current</li>
                  <li>Maintain the confidentiality of your account credentials (username and password)</li>
                  <li>Use a strong password meeting our minimum security requirements (at least 8 characters including letters, numbers, and special characters)</li>
                  <li>Not share your account credentials with any third party</li>
                  <li>Not allow any other person to use your account</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Account Responsibility and Security</h3>
                <p className="text-slate-600 leading-relaxed mb-3">You are fully responsible for all activities that occur under your account, including any unauthorized use. You agree to:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Immediately notify us of any unauthorized access to or use of your account</li>
                  <li>Immediately notify us if you become aware of any security breach related to the Service</li>
                  <li>Take all reasonable steps to prevent unauthorized access to your account</li>
                  <li>Accept full liability for all activities conducted through your account, even if conducted by an unauthorized third party, unless you have notified us of the breach</li>
                </ul>
                <p className="text-slate-600 leading-relaxed mb-4">
                  <strong>Important:</strong> Failure to maintain account security may result in immediate termination of your account and potential liability for any damages resulting from unauthorized use.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Account Transfer Restrictions</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Your account is personal to you. You may not:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Transfer, sell, or assign your account to another person or entity</li>
                  <li>Allow others to use your account for any purpose</li>
                  <li>Share login credentials with business partners, family members, or colleagues</li>
                </ul>
                <p className="text-slate-600 leading-relaxed">
                  Any attempted transfer or sharing may result in immediate account termination without refund.
                </p>
              </section>

              {/* Prohibited Uses and Activities */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Prohibited Uses and Activities</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">General Prohibitions</h3>
                <p className="text-slate-600 leading-relaxed mb-3">When using our Service, you agree NOT to:</p>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Service Misuse:</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Use automated systems, bots, scrapers, or any automated means to access the Service, reports, or directories (accessing the knowledge base for personal reading is permitted)</li>
                  <li>Attempt to reverse engineer, decompile, or extract source code from any part of the Service</li>
                  <li>Use the Service for commercial resale or to operate as an intermediary for other parties without our express written permission</li>
                  <li>Circumvent, disable, or interfere with security features or features that prevent unauthorized use</li>
                  <li>Attempt to gain unauthorized access to any systems, accounts, or networks connected to the Service</li>
                </ul>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Data and Content Violations:</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Submit false, fraudulent, or stolen Vehicle Identification Numbers (VINs)</li>
                  <li>Submit VINs you do not own or lack authorization to use</li>
                  <li>Share, distribute, or resell vehicle valuation reports to unauthorized third parties for commercial purposes</li>
                  <li>Use data obtained from the Service to harass, defraud, or misrepresent information to insurance companies or other parties</li>
                  <li>Misrepresent the source, accuracy, or completeness of valuation data</li>
                  <li>Remove, obscure, or alter any proprietary notices or attributions in reports or materials</li>
                </ul>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Harmful Activities:</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Engage in any unlawful, fraudulent, or deceptive practices</li>
                  <li>Violate any applicable local, state, national, or international law</li>
                  <li>Infringe upon intellectual property rights of any third party</li>
                  <li>Introduce viruses, malware, or any malicious code</li>
                  <li>Interfere with or disrupt the Service or servers/networks connected to the Service</li>
                  <li>Impersonate any person or entity or falsely state or misrepresent your affiliation with any person or entity</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Severity of Violations</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Violations are classified as follows:</p>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Minor Violations (may result in warning):</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>First-time accidental sharing of reports</li>
                  <li>Unintentional submission of incorrect information</li>
                  <li>Minor policy misunderstandings</li>
                </ul>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Serious Violations (may result in immediate termination):</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Fraudulent VIN submissions or use of stolen VINs</li>
                  <li>Commercial resale without authorization</li>
                  <li>Use of automated bots or scrapers on protected content</li>
                  <li>Attempting to defraud insurance companies using our reports</li>
                  <li>Multiple repeated violations after warnings</li>
                  <li>Any activity that threatens the security or integrity of our Service</li>
                </ul>
                <p className="text-slate-600 leading-relaxed">
                  We reserve the right to determine violation severity at our sole discretion.
                </p>
              </section>

              {/* VIN Data Submissions and User Warranties */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">VIN Data Submissions and User Warranties</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">User Authorization and Ownership</h3>
                <p className="text-slate-600 leading-relaxed mb-3">By submitting a Vehicle Identification Number (VIN) to our Service, you represent and warrant that:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You are the legal owner of the vehicle associated with the VIN, OR</li>
                  <li>You have explicit authorization from the vehicle owner to submit the VIN and obtain a valuation report</li>
                  <li>The VIN you submit is accurate and not fraudulent, stolen, or obtained through illegal means</li>
                  <li>You will use the valuation report only for lawful purposes related to your legitimate interest in the vehicle</li>
                  <li>You have disclosed to the vehicle owner (if you are not the owner) how their VIN data will be used</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">VIN Data Accuracy Disclaimer</h3>
                <p className="text-slate-600 leading-relaxed mb-3">While we strive to provide accurate vehicle valuations, you acknowledge and agree that:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We rely on third-party API providers (Auto.dev, CarsXE, MarketCheck, VinAudit) for VIN data</li>
                  <li>We are not responsible for the accuracy, completeness, or timeliness of data provided by these third parties</li>
                  <li>VIN data and valuations may contain errors, omissions, or outdated information</li>
                  <li>You should independently verify all VIN data and valuation information before making decisions</li>
                  <li>We disclaim all responsibility for decisions made based on VIN data accuracy</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Third-Party API Disclaimers</h3>
                <p className="text-slate-600 leading-relaxed mb-3">The Service uses multiple third-party APIs to provide vehicle data. You acknowledge that:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>API providers may experience outages, errors, or data quality issues beyond our control</li>
                  <li>We are not liable for any inaccuracies, downtime, or errors in data provided by Auto.dev, CarsXE, MarketCheck, VinAudit, or any other third-party data source</li>
                  <li>API data reflects listings and market conditions at a point in time and may not represent final sale values or insurance settlements</li>
                  <li>We make no guarantees about data availability or consistency across different API providers</li>
                </ul>
              </section>

              {/* User Responsibilities */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">User Responsibilities</h2>
                <p className="text-slate-600 leading-relaxed">
                  Provide accurate info; use lawfully. Do not rely solely on valuations, articles, or providers for decisions like total loss claims, repairs, or sales—verify independently. Vehicle owners: Adjust estimates for condition/mileage; cross-check with inspections. No sharing of advisor contacts implies our involvement.
                </p>
              </section>

              {/* Payment Terms and Subscriptions */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Payment Terms and Subscriptions</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">One-Time Purchases</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Our Service operates on a one-time purchase model:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Each vehicle valuation report is purchased individually</li>
                  <li>Payment is required before report generation</li>
                  <li>Prices are clearly displayed before purchase and may vary by service tier</li>
                  <li>All prices are in U.S. Dollars (USD) unless otherwise stated</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Payment Processing</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>All payments are processed securely through Stripe or Lemon Squeezy</li>
                  <li>We do not store your payment card information</li>
                  <li>You authorize us to charge your selected payment method for the purchase amount</li>
                  <li>Payment processing fees are non-refundable, even if you receive a refund for the service</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Pricing Changes</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We reserve the right to:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Modify pricing at any time with or without notice</li>
                  <li>Offer promotional pricing or discounts at our discretion</li>
                  <li>Change pricing tiers or service offerings</li>
                  <li>Any pricing changes will apply to future purchases only; existing purchases are not affected</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Refund Policy and Money-Back Guarantee</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Our refund policy and money-back guarantee are detailed in our <a href="/guarantee" className="text-blue-600 hover:text-blue-800 underline">Money-Back Guarantee</a> policy. Key points:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Refund requests must meet specific eligibility criteria outlined in our Money-Back Guarantee policy</li>
                  <li>Payment processing fees are excluded from all refunds</li>
                  <li>Refunds are issued to the original payment method</li>
                  <li>Processing time for approved refunds is typically 5-10 business days</li>
                  <li>Please refer to our complete <a href="/guarantee" className="text-blue-600 hover:text-blue-800 underline">Money-Back Guarantee</a> documentation for full terms and conditions</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Failed Payments</h3>
                <p className="text-slate-600 leading-relaxed mb-3">If a payment fails or is declined:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You will not receive access to the requested report or service</li>
                  <li>You are responsible for any fees imposed by your financial institution</li>
                  <li>We may suspend or terminate access to your account until payment issues are resolved</li>
                </ul>
              </section>

              {/* Insurance Negotiation Disclaimer */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Insurance Negotiation Disclaimer</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">No Guarantee of Outcomes</h3>
                <p className="text-slate-600 leading-relaxed mb-3">You acknowledge and agree that:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Vehicle valuation reports are provided as informational tools only</li>
                  <li>We make no guarantees about insurance settlement amounts or negotiation outcomes</li>
                  <li>Insurance companies make independent decisions based on their own policies, appraisals, and criteria</li>
                  <li>Our valuations are estimates based on market data and do not constitute binding assessments</li>
                  <li>You use our reports in insurance negotiations entirely at your own risk</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Independent Verification Required</h3>
                <p className="text-slate-600 leading-relaxed mb-3">When using our reports for insurance claims:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You should obtain independent vehicle appraisals and inspections</li>
                  <li>You should submit your own comparable sales data to support your position</li>
                  <li>You should consult with licensed insurance professionals or attorneys</li>
                  <li>You should not rely solely on our valuations as proof of vehicle value</li>
                  <li>Actual vehicle condition, mileage, and market factors may differ from report assumptions</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">No Liability for Insurance Disputes</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We are not liable for:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Denied insurance claims or unfavorable settlement amounts</li>
                  <li>Disputes between you and your insurance company</li>
                  <li>Differences between our valuation and insurance company valuations</li>
                  <li>Any damages, losses, or costs resulting from insurance negotiations</li>
                  <li>Decisions made by insurance adjusters or claims processors</li>
                </ul>
              </section>

              {/* No Warranties or Liability */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">No Warranties or Liability</h2>
                <p className="text-slate-600 leading-relaxed">
                  All content—including valuations, provider links, knowledge base articles, and advisor info—is "AS IS" and "AS AVAILABLE" without warranties of accuracy, completeness, merchantability, fitness, or non-infringement. Valuations reflect listings, not sales/settlements. Knowledge base is educational only, not legal/tax advice. We disclaim liability for third-party services, data errors, or advice outcomes.
                </p>
              </section>

              {/* No Legal or Professional Advice */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">No Legal or Professional Advice</h2>
                <p className="text-slate-600 leading-relaxed">
                  Nothing on the Service is legal, financial, insurance, or professional advice. Consult licensed attorneys, accountants, or advisors for your situation. Knowledge base articles are general info; user misinterpretation does not create liability. Service advisors are external; we have no control over, affiliation with, or responsibility for their services, accuracy, or conduct.
                </p>
              </section>

              {/* Third-Party Providers and Disclaimers */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Third-Party Providers and Disclaimers</h2>
                <p className="text-slate-600 leading-relaxed">
                  Links to service providers are for convenience only—no endorsement, warranty, or agency relationship exists. We are not liable for their acts, omissions, quality, pricing, or disputes. Providers operate independently; any claims against them must be directed solely to them. Users assume all risks of engaging third parties via our site.
                </p>
              </section>

              {/* Indemnification */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Indemnification</h2>
                <p className="text-slate-600 leading-relaxed">
                  You agree to indemnify, defend, and hold harmless us, affiliates, officers, directors, employees, agents, MarketCheck, third-party providers, and advisors from all claims, losses, damages, liabilities, costs, and expenses (including attorneys' fees) arising from: (a) your use/misuse of the Service; (b) reliance on data/content/advice; (c) disputes with providers/advisors; (d) total loss/vehicle transactions; (e) breach of Terms; (f) law violations; (g) unauthorized use of your account; (h) fraudulent VIN submissions; or (i) violations of prohibited activities. This covers lawsuits alleging bad advice, poor services, data misuse, or account misuse.
                </p>
              </section>

              {/* Limitation of Liability */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Limitation of Liability</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Liability Cap</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  Our total aggregate liability to you for all claims arising from or related to the Service is limited to the lesser of:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>$100, OR</li>
                  <li>The total amount you paid us in the 12 months preceding the claim</li>
                </ul>
                <p className="text-slate-600 leading-relaxed mb-4">
                  This limitation applies regardless of the legal theory (contract, tort, negligence, strict liability, or otherwise).
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Excluded Damages</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We are not liable for:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Indirect, incidental, consequential, special, or punitive damages</li>
                  <li>Lost profits, revenue, or business opportunities</li>
                  <li>Loss of data or information</li>
                  <li>Cost of substitute services</li>
                  <li>Claims arising from inaccurate data, third-party services, knowledge base content, or unaffiliated advisors</li>
                  <li>Claims related to insurance negotiations or settlement outcomes</li>
                  <li>Damages resulting from API provider errors or outages</li>
                  <li>Unauthorized account access (if you failed to maintain security)</li>
                  <li>Any damages exceeding the liability cap stated above</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Basis of the Bargain</h3>
                <p className="text-slate-600 leading-relaxed">
                  You acknowledge that we have set our prices and entered into this agreement in reliance upon these limitations of liability, and that these limitations reflect a reasonable allocation of risk between the parties.
                </p>
              </section>

              {/* Dispute Resolution and Arbitration */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Dispute Resolution and Arbitration</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Mandatory Binding Arbitration</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  You and [Your Company Name] agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service (collectively, "Disputes") will be resolved through <strong>binding arbitration</strong> rather than in court, except as specified in the "Exceptions to Arbitration" section below.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Arbitration Process</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Arbitration will be conducted by the American Arbitration Association (AAA) under its Consumer Arbitration Rules</li>
                  <li>The arbitration will take place in New Jersey unless both parties agree otherwise</li>
                  <li>The arbitrator's decision will be final and binding</li>
                  <li>Judgment on the arbitration award may be entered in any court having jurisdiction</li>
                  <li>You and we each agree to waive the right to a jury trial</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Class Action Waiver</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  <strong>YOU AND [YOUR COMPANY NAME] AGREE THAT DISPUTES WILL BE RESOLVED ONLY ON AN INDIVIDUAL BASIS AND NOT AS A CLASS ACTION, CLASS ARBITRATION, OR ANY OTHER CONSOLIDATED PROCEEDING.</strong>
                </p>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Neither you nor we may bring a claim on behalf of other individuals or entities, nor participate as a class member in any class or consolidated proceeding. If this class action waiver is found to be unenforceable, the entire arbitration agreement will be void.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Exceptions to Arbitration</h3>
                <p className="text-slate-600 leading-relaxed mb-3">The following matters are NOT subject to mandatory arbitration:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Claims that qualify for small claims court (claims seeking $10,000 or less)</li>
                  <li>Claims for injunctive or equitable relief to protect intellectual property rights</li>
                  <li>Claims that may be brought in small claims court in New Jersey</li>
                </ul>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Either party may bring such claims in small claims court or, if the matter is outside small claims court jurisdiction, in state or federal courts located in New Jersey.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Arbitration Costs</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>For claims under $10,000, we will pay all arbitration filing fees and administrative costs</li>
                  <li>For claims over $10,000, fees will be allocated according to AAA rules</li>
                  <li>Each party will bear its own attorney's fees unless the arbitrator awards them to the prevailing party</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Notice Requirement</h3>
                <p className="text-slate-600 leading-relaxed">
                  Before initiating arbitration, you must send written notice to us at [Your Company Address] describing the dispute. We will have 30 days to attempt to resolve the dispute informally. If unresolved, either party may commence arbitration.
                </p>
              </section>

              {/* Account Termination */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Account Termination</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Termination by Us</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  We reserve the right to suspend, disable, or terminate your account and access to the Service, with or without notice, for:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Violation of these Terms or any prohibited activities</li>
                  <li>Fraudulent VIN submissions or suspected fraudulent activity</li>
                  <li>Unauthorized commercial use or resale of services</li>
                  <li>Use of bots, scrapers, or automated access to protected content</li>
                  <li>Abusive, threatening, or harassing behavior toward our staff or other users</li>
                  <li>Non-payment or payment disputes</li>
                  <li>Any activity that threatens the security, integrity, or operation of our Service</li>
                  <li>Any reason at our sole discretion</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Immediate Termination for Serious Violations</h3>
                <p className="text-slate-600 leading-relaxed mb-3">For serious violations (as defined in "Prohibited Uses and Activities"), we may:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Terminate your account immediately without prior warning</li>
                  <li>Deny access to all services and reports</li>
                  <li>Retain evidence of violations for legal purposes</li>
                  <li>Report illegal activity to appropriate authorities</li>
                  <li>Take legal action to protect our rights and interests</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Termination by You</h3>
                <p className="text-slate-600 leading-relaxed mb-3">You may terminate your account at any time by:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Contacting us through the website contact form</li>
                  <li>Requesting account deletion in writing</li>
                </ul>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Upon termination, you will lose access to all account data, reports, and services.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Effect of Termination</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Upon termination of your account:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Your right to access and use the Service immediately ceases</li>
                  <li>All outstanding fees become immediately due and payable</li>
                  <li>No refunds will be provided unless required by our Money-Back Guarantee policy</li>
                  <li>We may delete your account data and associated information</li>
                  <li>Sections of these Terms that by their nature should survive termination will continue to apply (including Indemnification, Limitation of Liability, Dispute Resolution, and Governing Law)</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">No Liability for Termination</h3>
                <p className="text-slate-600 leading-relaxed">
                  We will not be liable to you or any third party for any termination of your account or access to the Service.
                </p>
              </section>

              {/* Governing Law and Jurisdiction */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Governing Law and Jurisdiction</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Governing Law</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  These Terms and your use of the Service are governed by and construed in accordance with the laws of the State of New Jersey, without regard to its conflict of law provisions.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Jurisdiction and Venue</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  For any disputes not subject to arbitration (as specified in the "Exceptions to Arbitration" section):
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You agree that any legal action must be brought exclusively in the state or federal courts located in New Jersey</li>
                  <li>You consent to the personal jurisdiction of such courts</li>
                  <li>You waive any objection to venue in such courts</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Severability</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent authority:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>That provision will be modified to the minimum extent necessary to make it valid and enforceable</li>
                  <li>If modification is not possible, the provision will be severed from these Terms</li>
                  <li>All other provisions of these Terms will remain in full force and effect</li>
                </ul>
              </section>

              {/* Disclaimers Table */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Disclaimers Table for Users</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-slate-300 text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">Section</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">Key Disclaimer</th>
                        <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">Action Recommended</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Valuations</strong></td>
                        <td className="border border-slate-300 px-4 py-2">Retail listings only, not final values</td>
                        <td className="border border-slate-300 px-4 py-2">Verify with KBB/inspection</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Knowledge Base</strong></td>
                        <td className="border border-slate-300 px-4 py-2">Informational; not legal advice</td>
                        <td className="border border-slate-300 px-4 py-2">Consult professionals</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Service Providers</strong></td>
                        <td className="border border-slate-300 px-4 py-2">Independent, unaffiliated</td>
                        <td className="border border-slate-300 px-4 py-2">Review their terms directly</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Advisors</strong></td>
                        <td className="border border-slate-300 px-4 py-2">No association; external only</td>
                        <td className="border border-slate-300 px-4 py-2">Contact them independently</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Total Loss Use</strong></td>
                        <td className="border border-slate-300 px-4 py-2">Benchmark, not settlement guarantee</td>
                        <td className="border border-slate-300 px-4 py-2">Submit comps/proof to insurer</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>VIN Data</strong></td>
                        <td className="border border-slate-300 px-4 py-2">Third-party API data; may contain errors</td>
                        <td className="border border-slate-300 px-4 py-2">Independently verify all data</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Account Security</strong></td>
                        <td className="border border-slate-300 px-4 py-2">User fully responsible for all activity</td>
                        <td className="border border-slate-300 px-4 py-2">Use strong password; report breaches immediately</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-4 py-2"><strong>Insurance Outcomes</strong></td>
                        <td className="border border-slate-300 px-4 py-2">No guarantee of settlement amounts</td>
                        <td className="border border-slate-300 px-4 py-2">Consult insurance professionals</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Changes to These Terms */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Changes to These Terms</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Modify</h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  We reserve the right to modify, update, or replace these Terms at any time at our sole discretion. Changes may include:
                </p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Updates to reflect new features or services</li>
                  <li>Clarifications to existing provisions</li>
                  <li>Changes required by law or regulation</li>
                  <li>Adjustments to pricing, refund policies, or service offerings</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Notice of Changes</h3>
                <p className="text-slate-600 leading-relaxed mb-3">When we make changes to these Terms:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We will update the "Effective Date" at the top of this document</li>
                  <li>We will update the version number</li>
                  <li>For material changes, we will provide notice through email or a prominent notice on our website at least 15 days before the changes take effect</li>
                  <li>Your continued use of the Service after changes become effective constitutes acceptance of the modified Terms</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Review Responsibility</h3>
                <p className="text-slate-600 leading-relaxed">
                  It is your responsibility to review these Terms periodically for updates. If you do not agree to modified Terms, you must stop using the Service and may request account termination.
                </p>
              </section>

              {/* Miscellaneous Provisions */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Miscellaneous Provisions</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Entire Agreement</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  These Terms, together with our Privacy Policy and Money-Back Guarantee policy, constitute the entire agreement between you and [Your Company Name] regarding the Service and supersede all prior agreements, understandings, and communications.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">No Waiver</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Our failure to enforce any provision of these Terms will not constitute a waiver of that provision or any other provision. No waiver will be effective unless made in writing and signed by an authorized representative of [Your Company Name].
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Assignment</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  You may not assign or transfer these Terms or your account to any third party without our prior written consent. We may assign or transfer our rights and obligations under these Terms without restriction.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Force Majeure</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We will not be liable for any failure or delay in performing our obligations under these Terms due to circumstances beyond our reasonable control, including acts of God, natural disasters, war, terrorism, labor disputes, or internet service provider failures.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Relationship of Parties</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Nothing in these Terms creates any partnership, joint venture, agency, franchise, sales representative, or employment relationship between you and [Your Company Name]. You have no authority to bind us or make commitments on our behalf.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Headings</h3>
                <p className="text-slate-600 leading-relaxed">
                  Section headings in these Terms are for convenience only and have no legal or contractual effect.
                </p>
              </section>

              {/* Contact Information */}
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Information</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  If you have questions about these Terms and Conditions, please contact us through the contact form available on our website.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  We aim to respond to all inquiries within 5-7 business days.
                </p>
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
                  These Terms and Conditions are legally binding. By using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. Please read them carefully.
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
