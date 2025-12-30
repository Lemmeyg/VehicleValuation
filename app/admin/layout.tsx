/**
 * Admin Layout
 *
 * Layout wrapper for admin dashboard pages
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkIsAdmin } from '@/lib/db/admin-auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check admin access
  const isAdmin = await checkIsAdmin()

  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Navigation */}
      <nav className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="text-xl font-bold">
                Admin Dashboard
              </Link>
              <div className="flex space-x-4">
                <Link
                  href="/admin"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Overview
                </Link>
                <Link
                  href="/admin/reports"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Reports
                </Link>
                <Link
                  href="/admin/payments"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Payments
                </Link>
                <Link
                  href="/admin/api-logs"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  API Logs
                </Link>
                <Link
                  href="/admin/users"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Users
                </Link>
                <Link
                  href="/admin/knowledge-base"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Knowledge Base
                </Link>
                <Link
                  href="/admin/directory"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Directory
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
              >
                User Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
