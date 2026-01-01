/**
 * Admin Report Details Page
 *
 * View single report with admin actions (regenerate PDF, etc.)
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminReportDetailsPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Fetch report
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !report) {
    notFound()
  }

  const vehicleData = report.vehicle_data as any
  const accidentDetails = report.accident_details as any
  const valuation = report.valuation_result as any

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Link
              href="/admin/reports"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              ← Back to Reports
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Report Details</h1>
          <p className="mt-2 text-sm text-gray-600 font-mono">VIN: {report.vin}</p>
        </div>
        <div className="flex space-x-3">
          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Download PDF
            </a>
          )}
          {report.price_paid && report.price_paid > 0 && (
            <form action={`/api/reports/${id}/generate-pdf`} method="POST">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {report.pdf_url ? 'Regenerate PDF' : 'Generate PDF'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Report Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">Status</p>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              report.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : report.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {report.status}
          </span>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">Amount Paid</p>
          <p className="text-2xl font-bold text-gray-900">
            {report.price_paid ? formatCurrency(report.price_paid) : 'Not Paid'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {report.price_paid === 2900 ? 'Basic Report' : report.price_paid === 4900 ? 'Premium Report' : ''}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">Created</p>
          <p className="text-sm text-gray-900">{formatDate(report.created_at)}</p>
        </div>
      </div>

      {/* Technical Details */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Technical Details</h2>
        </div>
        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Report ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{report.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{report.user_id}</dd>
            </div>
            {report.stripe_payment_id && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Stripe Payment ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">
                  <a
                    href={`https://dashboard.stripe.com/payments/${report.stripe_payment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500"
                  >
                    {report.stripe_payment_id}
                  </a>
                </dd>
              </div>
            )}
            {report.pdf_url && (
              <div>
                <dt className="text-sm font-medium text-gray-500">PDF URL</dt>
                <dd className="mt-1 text-sm text-gray-900 truncate">
                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500"
                  >
                    View PDF
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(report.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Vehicle Information */}
      {vehicleData && Object.keys(vehicleData).length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Vehicle Information</h2>
          </div>
          <div className="px-6 py-5">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {Object.entries(vehicleData).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-gray-500 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Market Valuation */}
      {valuation && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Market Valuation</h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-2">Low Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${valuation.lowValue?.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-2">Average Value</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${valuation.averageValue?.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-2">High Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${valuation.highValue?.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Confidence Level</p>
                <p className="mt-1 text-sm text-gray-900 capitalize">{valuation.confidence}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Data Points</p>
                <p className="mt-1 text-sm text-gray-900">{valuation.dataPoints}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accident History */}
      {accidentDetails && accidentDetails.accidents && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Accident History</h2>
          </div>
          <div className="px-6 py-5">
            {accidentDetails.accidents.length === 0 ? (
              <p className="text-sm text-gray-600">No accidents reported</p>
            ) : (
              <div className="space-y-4">
                {accidentDetails.accidents.map((accident: any, index: number) => (
                  <div key={index} className="border-l-4 border-red-400 pl-4 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">Accident {index + 1}</p>
                      {accident.severity && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {accident.severity}
                        </span>
                      )}
                    </div>
                    {accident.accidentDate && (
                      <p className="text-sm text-gray-600">Date: {accident.accidentDate}</p>
                    )}
                    {accident.location && (
                      <p className="text-sm text-gray-600">Location: {accident.location}</p>
                    )}
                    {accident.damageDescription && (
                      <p className="mt-2 text-sm text-gray-900">{accident.damageDescription}</p>
                    )}
                    {accident.estimatedCost && (
                      <p className="text-sm text-gray-600">
                        Estimated Cost: ${accident.estimatedCost.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
