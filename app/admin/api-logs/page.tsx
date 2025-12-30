/**
 * Admin API Logs Page
 *
 * Displays MarketCheck API call logs with costs and error rates
 */

import { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { requireAuth, checkIfUserIsAdmin } from '@/lib/db/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'API Call Logs | Admin',
  description: 'View API call logs and statistics',
}

export default async function ApiLogsPage() {
  const user = await requireAuth()
  const isAdmin = await checkIfUserIsAdmin(user.id)

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const supabase = await createServerSupabaseClient()

  // Fetch API call logs (last 30 days)
  const { data: apiLogs, error } = await supabase
    .from('api_call_logs')
    .select('*')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching API logs:', error)
  }

  // Calculate statistics
  const totalCalls = apiLogs?.length || 0
  const successfulCalls = apiLogs?.filter(log => log.success).length || 0
  const failedCalls = apiLogs?.filter(log => !log.success).length || 0
  const totalCost = apiLogs?.reduce((sum, log) => sum + parseFloat(log.cost || '0'), 0) || 0
  const avgResponseTime = apiLogs?.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / (totalCalls || 1) || 0
  const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0

  // Group by provider
  const marketCheckLogs = apiLogs?.filter(log => log.api_provider === 'marketcheck') || []
  const marketCheckCost = marketCheckLogs.reduce((sum, log) => sum + parseFloat(log.cost || '0'), 0)
  const marketCheckSuccess = marketCheckLogs.filter(log => log.success).length
  const marketCheckFailed = marketCheckLogs.filter(log => !log.success).length
  const marketCheckSuccessRate = marketCheckLogs.length > 0
    ? (marketCheckSuccess / marketCheckLogs.length) * 100
    : 0

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">API Call Logs</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Total API Calls</div>
          <div className="text-3xl font-bold">{totalCalls}</div>
          <div className="text-sm text-gray-500 mt-2">
            {successfulCalls} success / {failedCalls} failed
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Success Rate</div>
          <div className="text-3xl font-bold">{successRate.toFixed(1)}%</div>
          <div className={`text-sm mt-2 ${successRate >= 95 ? 'text-green-600' : 'text-red-600'}`}>
            {successRate >= 95 ? 'Healthy' : 'Needs Attention'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Total Cost (30 days)</div>
          <div className="text-3xl font-bold">${totalCost.toFixed(2)}</div>
          <div className="text-sm text-gray-500 mt-2">
            Avg: ${(totalCost / (totalCalls || 1)).toFixed(3)} per call
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Avg Response Time</div>
          <div className="text-3xl font-bold">{avgResponseTime.toFixed(0)}ms</div>
          <div className={`text-sm mt-2 ${avgResponseTime < 3000 ? 'text-green-600' : 'text-yellow-600'}`}>
            {avgResponseTime < 3000 ? 'Fast' : 'Moderate'}
          </div>
        </div>
      </div>

      {/* MarketCheck Specific Stats */}
      <div className="bg-blue-50 p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold mb-4">MarketCheck API Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Total Calls</div>
            <div className="text-2xl font-bold">{marketCheckLogs.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className="text-2xl font-bold">{marketCheckSuccessRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Cost</div>
            <div className="text-2xl font-bold">${marketCheckCost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Failed Calls</div>
            <div className="text-2xl font-bold text-red-600">{marketCheckFailed}</div>
          </div>
        </div>
      </div>

      {/* API Call Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apiLogs?.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    log.api_provider === 'marketcheck'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {log.api_provider}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                  {log.endpoint}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    log.success
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {log.success ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${parseFloat(log.cost || '0').toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.response_time_ms}ms
                </td>
                <td className="px-6 py-4 text-sm text-red-600 truncate max-w-xs">
                  {log.error_message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
