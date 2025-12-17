/**
 * Dashboard Layout
 *
 * Protected layout for authenticated users.
 * Includes navigation and user profile display.
 */

import { getUser, getUserProfile } from '@/lib/db/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  const profile = await getUserProfile()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link
                  href="/dashboard"
                  className="text-xl font-bold text-slate-900 hover:text-primary-600 transition-colors"
                >
                  Vehicle Valuation
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-primary-600 text-sm font-medium text-slate-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/reports"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                >
                  Reports
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {(profile?.full_name || user.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {profile?.full_name || user.email}
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
