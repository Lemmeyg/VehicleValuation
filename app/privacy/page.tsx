import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Privacy Policy
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-slate-600">
                <p>
                  <strong>Effective Date:</strong> [Date]
                </p>
                <span className="hidden sm:inline">•</span>
                <p>
                  <strong>Version:</strong> 1.0
                </p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none">
              {/* Table of Contents */}
              <section className="mb-8 p-6 bg-slate-50 rounded-lg">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Table of Contents</h2>
                <ol className="list-decimal pl-6 text-slate-600 space-y-1">
                  <li><a href="#introduction" className="text-primary-600 hover:underline">Introduction</a></li>
                  <li><a href="#information-we-collect" className="text-primary-600 hover:underline">Information We Collect</a></li>
                  <li><a href="#how-we-use" className="text-primary-600 hover:underline">How We Use Your Information</a></li>
                  <li><a href="#how-we-protect" className="text-primary-600 hover:underline">How We Protect Your Information</a></li>
                  <li><a href="#data-sharing" className="text-primary-600 hover:underline">Data Sharing and Third Parties</a></li>
                  <li><a href="#data-retention" className="text-primary-600 hover:underline">Data Retention</a></li>
                  <li><a href="#privacy-rights" className="text-primary-600 hover:underline">Your Privacy Rights</a></li>
                  <li><a href="#childrens-privacy" className="text-primary-600 hover:underline">Children's Privacy</a></li>
                  <li><a href="#changes" className="text-primary-600 hover:underline">Changes to This Privacy Policy</a></li>
                  <li><a href="#contact" className="text-primary-600 hover:underline">Contact Us</a></li>
                </ol>
              </section>

              {/* Introduction */}
              <section id="introduction" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Introduction</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Welcome to [Your Website Name]. We are committed to protecting your privacy and being transparent about how we collect, use, and protect your personal information. This Privacy Policy explains our practices regarding data collection and your rights as a user.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Our service helps vehicle owners obtain comprehensive valuation reports for insurance negotiations. We take the sensitivity of vehicle-related data seriously and have implemented measures to protect your information.
                </p>
              </section>

              {/* Information We Collect */}
              <section id="information-we-collect" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Information We Collect</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Account Information</h3>
                <p className="text-slate-600 leading-relaxed mb-3">When you create an account with us, we collect:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li><strong>Name</strong> (first and last)</li>
                  <li><strong>Email address</strong></li>
                  <li><strong>Password</strong> (stored securely using industry-standard encryption)</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Vehicle Information</h3>
                <p className="text-slate-600 leading-relaxed mb-3">To provide valuation reports, we collect:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li><strong>Vehicle Identification Numbers (VINs)</strong> - We recognize that VINs are sensitive data as they can be linked to personal vehicle ownership records and may reveal information about your vehicle and insurance claims</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Technical Information</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We automatically collect certain information when you use our service:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li><strong>IP addresses</strong> - Used for security, fraud prevention, and general analytics</li>
                  <li><strong>Usage data and analytics</strong> - We use PostHog to collect information about how you interact with our website, including pages visited, features used, and time spent on our platform</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Payment Information</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We do not directly collect or store payment information. All payment processing is handled securely by:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li><strong>Stripe</strong> or <strong>Lemon Squeezy</strong> - These third-party payment processors collect and process payment card information according to their own privacy policies and PCI-DSS compliance standards</li>
                </ul>
              </section>

              {/* How We Use Your Information */}
              <section id="how-we-use" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">How We Use Your Information</h2>
                <p className="text-slate-600 leading-relaxed mb-4">We use the information we collect for the following purposes:</p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">To Provide Our Services</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Generate comprehensive vehicle valuation reports using VIN data</li>
                  <li>Access premium vehicle data through our third-party API providers (Auto.dev, CarsXE, MarketCheck, VinAudit)</li>
                  <li>Maintain and manage your user account</li>
                  <li>Process your subscription payments through our payment processors</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">To Improve Our Services</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Analyze usage patterns to enhance user experience</li>
                  <li>Monitor and improve platform performance</li>
                  <li>Develop new features and services</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">To Communicate With You</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Send service-related notifications (report delivery, account updates)</li>
                  <li>Respond to your inquiries and support requests</li>
                  <li>Provide customer service</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Future Marketing Communications (With Your Consent)</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We may send promotional emails, newsletters, or special offers in the future</li>
                  <li>You will have the ability to opt-out of marketing communications at any time</li>
                  <li>You will receive clear notice and obtain your consent before initiating any marketing communications</li>
                </ul>
              </section>

              {/* How We Protect Your Information */}
              <section id="how-we-protect" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">How We Protect Your Information</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We take the security of your personal information seriously and implement multiple layers of protection:
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Data Storage</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>All user data is stored on <strong>Supabase</strong>, a secure cloud database platform</li>
                  <li>Data is transmitted using industry-standard SSL/TLS encryption</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Access Controls</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We implement strict access controls limiting who can view or handle sensitive data</li>
                  <li>Only authorized personnel have access to user information on a need-to-know basis</li>
                  <li>VIN data receives additional protection due to its sensitive nature</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Security Measures</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Regular security assessments and updates</li>
                  <li>Password protection using secure hashing algorithms</li>
                  <li>Monitoring for unauthorized access attempts</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">VIN Data Protection</h3>
                <p className="text-slate-600 leading-relaxed mb-3">Because VINs are considered sensitive personal identifiers that can be linked to vehicle ownership:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We limit VIN data access to essential operations only</li>
                  <li>VINs are only shared with trusted API providers necessary for generating your reports</li>
                  <li>We do not sell or share VIN data with third parties for marketing purposes</li>
                </ul>

                <p className="text-slate-600 leading-relaxed">
                  <strong>Please note:</strong> While we implement robust security measures, no method of electronic storage or internet transmission is 100% secure. We cannot guarantee absolute security but continuously work to protect your information.
                </p>
              </section>

              {/* Data Sharing and Third Parties */}
              <section id="data-sharing" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Data Sharing and Third Parties</h2>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Third-Party Service Providers</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We share limited information with trusted third-party providers who help us deliver our services:
                </p>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Vehicle Data API Providers:</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Auto.dev</li>
                  <li>CarsXE</li>
                  <li>MarketCheck</li>
                  <li>VinAudit</li>
                </ul>
                <p className="text-slate-600 leading-relaxed mb-4">
                  These providers receive VIN data solely to generate vehicle valuation reports. They operate under their own privacy policies and are contractually obligated to protect your information.
                </p>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Payment Processors:</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Stripe or Lemon Squeezy handles all payment transactions</li>
                  <li>We do not have access to your full payment card details</li>
                  <li>Payment processors maintain PCI-DSS compliance</li>
                </ul>

                <h4 className="text-lg font-semibold text-slate-900 mb-2">Analytics Provider:</h4>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>PostHog collects usage analytics to help us improve our service</li>
                  <li>This data is used internally and not sold to third parties</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">What We Don't Do</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We do <strong>not</strong> sell your personal information to third parties</li>
                  <li>We do <strong>not</strong> share your VIN data for marketing purposes</li>
                  <li>We do <strong>not</strong> provide your information to data brokers</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Legal Requirements</h3>
                <p className="text-slate-600 leading-relaxed mb-3">We may disclose your information if required by law, such as:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>In response to valid legal processes (subpoenas, court orders)</li>
                  <li>To protect our rights, property, or safety</li>
                  <li>To prevent fraud or security threats</li>
                </ul>
              </section>

              {/* Data Retention */}
              <section id="data-retention" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Data Retention</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy:
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Active Accounts</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Account information and VIN submissions are retained while your account is active</li>
                  <li>Historical reports remain accessible through your account dashboard</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Account Deletion</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Upon request, we will delete your account and associated personal information</li>
                  <li>Some information may be retained for legal or business purposes (e.g., transaction records for tax compliance)</li>
                  <li>Backups may retain data for up to 90 days before permanent deletion</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Automated Deletion</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We are developing automated data retention and deletion processes</li>
                  <li>Users will have control over their data retention preferences</li>
                </ul>
              </section>

              {/* Your Privacy Rights */}
              <section id="privacy-rights" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Privacy Rights</h2>
                <p className="text-slate-600 leading-relaxed mb-4">You have important rights regarding your personal information:</p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Access</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You can request a copy of the personal information we hold about you</li>
                  <li>Contact us through our website contact form to request your data</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Correction</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You can update your account information at any time through your account settings</li>
                  <li>Contact us if you need assistance correcting your information</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Deletion</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You can request deletion of your personal information</li>
                  <li>Account deletion can be initiated through your account settings or by contacting us</li>
                  <li>Note: Some information may be retained for legal compliance purposes</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Opt-Out</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>You can opt-out of future marketing communications (when implemented)</li>
                  <li>You can request that we stop processing your data for certain purposes</li>
                </ul>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">California Residents (CCPA Rights)</h3>
                <p className="text-slate-600 leading-relaxed mb-3">If you are a California resident, you have additional rights under the California Consumer Privacy Act:</p>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>Right to know what personal information is collected</li>
                  <li>Right to know whether personal information is sold or disclosed</li>
                  <li>Right to opt-out of the sale of personal information (note: we do not sell personal information)</li>
                  <li>Right to non-discrimination for exercising your CCPA rights</li>
                </ul>

                <p className="text-slate-600 leading-relaxed">
                  <strong>To Exercise Your Rights:</strong> Submit a request through our contact form on the website. We will respond to your request within 30 days.
                </p>
              </section>

              {/* Children's Privacy */}
              <section id="childrens-privacy" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Children's Privacy</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Our service is designed for vehicle owners and insurance claimants. We do not knowingly collect personal information from individuals under the age of 16. By using our service, you confirm that you are at least 16 years of age.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  If we discover that we have inadvertently collected information from someone under 16, we will promptly delete that information. If you believe we may have collected information from a minor, please contact us immediately through our contact form.
                </p>
              </section>

              {/* Changes to This Privacy Policy */}
              <section id="changes" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Changes to This Privacy Policy</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors.
                </p>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">When We Make Changes:</h3>
                <ul className="list-disc pl-6 mb-4 text-slate-600 space-y-2">
                  <li>We will update the "Effective Date" at the top of this policy</li>
                  <li>We will update the version number</li>
                  <li>For significant changes, we will notify you via email or through a prominent notice on our website</li>
                  <li>Your continued use of our service after changes constitutes acceptance of the updated policy</li>
                </ul>

                <p className="text-slate-600 leading-relaxed">
                  We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.
                </p>
              </section>

              {/* Contact Us */}
              <section id="contact" className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Us</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
                </p>
                <p className="text-slate-600 leading-relaxed mb-4">
                  <strong>Contact Method:</strong> Use the contact form available on our website
                </p>
                <p className="text-slate-600 leading-relaxed">
                  We aim to respond to all privacy-related inquiries within 5-7 business days.
                </p>
              </section>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-6 mt-8">
                <p className="text-sm text-slate-500 mb-4">
                  <strong>Last Updated:</strong> [Date]
                </p>
                <p className="text-sm text-slate-600 italic">
                  This Privacy Policy is designed to comply with applicable privacy laws including CCPA (California Consumer Privacy Act) and general privacy best practices. Users are advised to read this policy carefully and contact us with any questions.
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
