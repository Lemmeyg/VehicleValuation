/**
 * Dashboard Page
 *
 * Main dashboard view for authenticated users.
 * Shows overview of reports and recent activity.
 */

import { getUser, getUserProfile } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import CreateReportButton from '@/components/CreateReportButton'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getUserProfile()

  // Fetch user's reports
  const supabase = await createServerSupabaseClient()
  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const reportCount = reports?.length || 0

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}!
        </h1>
        <p className="mt-2 text-base text-slate-600">
          View your vehicle valuation reports and manage your account.
        </p>
      </div>

      {/* Quick actions - Rearranged: Profile, Saved Services, Saved Articles */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Left: User Profile */}
        <div className="glass-card rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-slate-100 overflow-hidden group">
          <div className="p-6 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-semibold text-slate-600 truncate">Your Profile</dt>
                  <dd className="text-base font-bold text-slate-900 truncate">{user?.email}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-3">
            <Link
              href="/profile"
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center group-hover:translate-x-1 transition-transform"
            >
              Edit profile →
            </Link>
          </div>
        </div>

        {/* Middle: Saved Services from Directory */}
        <div className="glass-card rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-slate-100 overflow-hidden group">
          <div className="p-6 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-semibold text-slate-600 truncate">Saved Services</dt>
                  <dd className="text-2xl font-bold text-slate-900">0</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-3">
            <Link
              href="/directory"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center group-hover:translate-x-1 transition-transform"
            >
              Browse directory →
            </Link>
          </div>
        </div>

        {/* Right: Saved Articles from Knowledge Base */}
        <div className="glass-card rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-slate-100 overflow-hidden group">
          <div className="p-6 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-semibold text-slate-600 truncate">Saved Articles</dt>
                  <dd className="text-2xl font-bold text-slate-900">0</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-3">
            <Link
              href="/#knowledge-base"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center group-hover:translate-x-1 transition-transform"
            >
              Browse articles →
            </Link>
          </div>
        </div>
      </div>

      {/* Reports Section */}
      <div className="mt-8 glass-card rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-emerald-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Your Reports</h2>
              <p className="text-sm text-slate-600 mt-1">
                {reportCount === 0
                  ? 'No reports yet - create your first one below'
                  : `${reportCount} report${reportCount !== 1 ? 's' : ''} created`}
              </p>
            </div>
            <CreateReportButton />
          </div>
        </div>

        {reportCount === 0 ? (
          /* Empty state */
          <div className="p-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">No reports yet</h3>
              <p className="mt-2 text-base text-slate-600 max-w-md mx-auto">
                Get started by creating your first vehicle valuation report. Our professional
                analysis takes just minutes to request.
              </p>
              <div className="mt-6">
                <CreateReportButton />
              </div>
            </div>
          </div>
        ) : (
          /* Reports List */
          <div className="divide-y divide-slate-100">
            {reports?.map(report => (
              <Link
                key={report.id}
                href={`/reports/${report.id}/view`}
                className="block p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-10 w-10 text-primary-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          VIN: <span className="font-mono">{report.vin}</span>
                        </p>
                        {report.vehicle_data?.year &&
                          report.vehicle_data?.make &&
                          report.vehicle_data?.model && (
                            <p className="text-sm text-slate-600">
                              {report.vehicle_data.year} {report.vehicle_data.make}{' '}
                              {report.vehicle_data.model}
                            </p>
                          )}
                        <p className="text-xs text-slate-500 mt-1">
                          Created{' '}
                          {new Date(report.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          report.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </div>
                    <svg
                      className="h-5 w-5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
