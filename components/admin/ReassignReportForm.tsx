'use client'

import { useState } from 'react'

interface ReassignReportFormProps {
  reportId: string
  currentUserId: string | null
}

export default function ReassignReportForm({ reportId, currentUserId }: ReassignReportFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ newUserId: string; newUserEmail: string } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/reports/${reportId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reassign report')
      } else {
        setSuccess({ newUserId: data.newUserId, newUserEmail: data.newUserEmail })
        setEmail('')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-6 py-5 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Reassign Report</h2>
      </div>
      <div className="px-6 py-5">
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-500 mb-1">Current Owner</p>
          <p className="text-sm text-gray-900 font-mono">{currentUserId ?? 'Unassigned'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reassign-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New owner email address
            </label>
            <input
              id="reassign-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm font-medium text-green-800">Report reassigned successfully</p>
              <p className="text-sm text-green-700 mt-1">
                New owner: <span className="font-mono">{success.newUserEmail}</span>
              </p>
              <p className="text-sm text-green-700 font-mono">{success.newUserId}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Reassigning...' : 'Reassign Report'}
          </button>
        </form>
      </div>
    </div>
  )
}
