import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/db/supabase'
import { RedditPurchaseTracker } from './RedditPurchaseTracker'
import { PostHogPurchaseTracker } from './PostHogPurchaseTracker'
import { ReportReadyPoller } from './ReportReadyPoller'
import { AuthenticatedPaymentPoller } from './AuthenticatedPaymentPoller'
import { SUPPORT_EMAIL } from '@/lib/constants'

/**
 * Payment Success Page
 *
 * Displays confirmation after successful report purchase.
 * Auth-optional: authenticated users see full order details;
 * anonymous buyers (who paid without an account) see a
 * "check your email" message instead of being redirected.
 */

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function PaymentSuccessPage({ params, searchParams }: PageProps) {
  const { id: reportId } = await params
  const { session_id: sessionId } = await searchParams

  // Auth-optional: returns null for anonymous/unauthenticated users
  const user = await getUser()

  // Anonymous buyer — fetch checkout email then show poller with account setup
  if (!user) {
    const { data: anonReport } = await supabaseAdmin
      .from('reports')
      .select('email, price_paid')
      .eq('id', reportId)
      .single()

    return (
      <ReportReadyPoller
        reportId={reportId}
        checkoutEmail={anonReport?.email ?? null}
        pricePaid={anonReport?.price_paid ?? null}
      />
    )
  }

  // Authenticated user — fetch report details as before
  const supabase = await createServerSupabaseClient()

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', user.id)
    .single()

  if (error || !report) {
    redirect('/dashboard')
  }

  // Webhook hasn't processed yet — poll until price_paid is set
  if (!report.price_paid || report.price_paid === 0) {
    return <AuthenticatedPaymentPoller reportId={reportId} />
  }

  const planType = report.price_paid === 2900 ? 'basic' : 'premium'

  return (
    <div className="min-h-screen bg-gray-50">
      <RedditPurchaseTracker
        value={report.price_paid / 100}
        currency="USD"
        transactionId={sessionId}
      />
      <PostHogPurchaseTracker
        reportId={reportId}
        planType={planType}
        amountCents={report.price_paid}
        transactionId={sessionId}
        email={user.email ?? undefined}
        vin={report.vin ?? undefined}
        userId={user.id}
      />
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
                TotalLossToolKit
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-green-100 p-3">
                <svg
                  className="h-16 w-16 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
              <p className="text-lg text-gray-600">
                Thank you for your purchase. Your report is being generated.
              </p>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">VIN:</span>
                  <span className="font-mono font-medium text-gray-900">{report.vin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Report Type:</span>
                  <span className="font-medium text-gray-900">
                    {report.price_paid === 2900 ? 'Basic' : 'Premium'} Report
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-medium text-gray-900">
                    ${(report.price_paid / 100).toFixed(2)}
                  </span>
                </div>
                {sessionId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-sm text-gray-900">{sessionId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* What's Next */}
            {report.status !== 'vin_decode_failed' && (
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-3">What Happens Next?</h2>
                <ul className="space-y-2 text-blue-800">
                  <li className="flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      Click &ldquo;View Full Report&rdquo; to see your complete valuation analysis
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>View dual price predictions from CarsXE and MarketCheck</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>See 10 comparable vehicles with detailed pricing and location data</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Download your professional PDF report (if available)</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Access your report anytime from your dashboard</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Money-Back Guarantee */}
            <div className="bg-green-50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-green-900 mb-2">
                100% Money-Back Guarantee
              </h2>
              <p className="text-green-800 text-sm">
                If the insurance settlement falls short of our valuation, you can request a full
                refund within 90 days of receiving your report. We&apos;re confident in our
                valuations.
              </p>
            </div>

            {/* VIN Decode Failed — amber 48-hour notice */}
            {report.status === 'vin_decode_failed' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-amber-900 mb-2">Report In Progress</h2>
                <p className="text-amber-900 text-sm">
                  Additional information sources are required to ensure comprehensive reporting for
                  your vehicle. Expect your completed report via email within 48 hours.
                </p>
                <div className="mt-4 flex justify-center">
                  <Link
                    href="/dashboard"
                    className="inline-flex justify-center items-center px-8 py-4 border-2 border-slate-300 text-lg font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-all"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              /* Action Buttons */
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/reports/${reportId}`}
                  className="inline-flex justify-center items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all shadow-lg"
                >
                  View Full Report
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex justify-center items-center px-8 py-4 border-2 border-slate-300 text-lg font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-all"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Questions about your report? Email{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
