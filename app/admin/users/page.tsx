/**
 * Admin Users Management Page
 *
 * View and manage all users
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient()

  // Get all reports grouped by user
  const { data: reports } = await supabase
    .from('reports')
    .select('user_id, price_paid, created_at')
    .order('created_at', { ascending: false })

  // Get all payments grouped by user
  const { data: payments } = await supabase
    .from('payments')
    .select('user_id, amount')

  // Aggregate user data
  const userMap = new Map<string, {
    userId: string
    totalReports: number
    paidReports: number
    totalSpent: number
    firstReport: string
    lastReport: string
  }>()

  reports?.forEach((report) => {
    if (!report.user_id) return

    const existing = userMap.get(report.user_id) || {
      userId: report.user_id,
      totalReports: 0,
      paidReports: 0,
      totalSpent: 0,
      firstReport: report.created_at,
      lastReport: report.created_at,
    }

    existing.totalReports++
    if (report.price_paid) {
      existing.paidReports++
    }
    if (new Date(report.created_at) > new Date(existing.lastReport)) {
      existing.lastReport = report.created_at
    }
    if (new Date(report.created_at) < new Date(existing.firstReport)) {
      existing.firstReport = report.created_at
    }

    userMap.set(report.user_id, existing)
  })

  payments?.forEach((payment) => {
    if (!payment.user_id) return

    const existing = userMap.get(payment.user_id)
    if (existing) {
      existing.totalSpent += payment.amount || 0
    }
  })

  const users = Array.from(userMap.values()).sort(
    (a, b) => new Date(b.lastReport).getTime() - new Date(a.lastReport).getTime()
  )

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const totalUsers = users.length
  const totalRevenue = users.reduce((sum, u) => sum + u.totalSpent, 0)
  const activeUsers = users.filter((u) => u.paidReports > 0).length

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
        <p className="mt-2 text-sm text-gray-600">View and manage all registered users</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-500">Active Users</p>
          <p className="text-2xl font-bold text-green-600">{activeUsers}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-500">Avg Revenue/User</p>
          <p className="text-2xl font-bold text-blue-600">
            {totalUsers > 0 ? formatCurrency(Math.round(totalRevenue / totalUsers)) : '$0'}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Reports
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paid Reports
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Spent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                First Report
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Activity
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length > 0 ? (
              users.map((user) => (
                <tr key={user.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">
                      {user.userId.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.totalReports}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.paidReports}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(user.totalSpent)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatDate(user.firstReport)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatDate(user.lastReport)}</div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
