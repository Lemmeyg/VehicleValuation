/**
 * Report Details Page
 *
 * Displays vehicle information and valuation data for a specific report.
 */

import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PaymentButtons } from './payment-buttons'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ canceled?: string }>
}

export default async function ReportDetailsPage({ params, searchParams }: PageProps) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const { canceled } = await searchParams

  const supabase = await createServerSupabaseClient()

  // Fetch report data
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report Not Found</h1>
          <p className="mt-2 text-gray-600">
            The report you're looking for doesn't exist or you don't have access.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-blue-600 hover:text-blue-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const vehicleData = report.vehicle_data as any
  const accidentDetails = report.accident_details as any
  const valuation = report.valuation_result as any
  const isPaid = report.price_paid && report.price_paid > 0
  const pdfUrl = report.pdf_url as string | null
  const isCompleted = report.status === 'completed' && pdfUrl

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
                Vehicle Valuation
              </Link>
            </div>
            <div className="flex items-center space-x-4">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Canceled Payment Alert */}
        {canceled && (
          <div className="mb-6 rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Payment Canceled</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Your payment was canceled. No charges were made. You can try again below.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paid Status Banner */}
        {isPaid && !isCompleted && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
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
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Payment Received</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Your {report.price_paid === 2900 ? 'Basic' : 'Premium'} report is being
                    generated. You'll receive an email when it's ready (typically within a few minutes).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Ready Banner */}
        {isCompleted && (
          <div className="mb-6 rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
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
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Report Ready!</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Your {report.price_paid === 2900 ? 'Basic' : 'Premium'} report is ready for download.
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <a
                      href={pdfUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download PDF
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vehicle Report</h1>
          <p className="mt-2 text-sm text-gray-600">
            VIN: <span className="font-mono">{report.vin}</span>
          </p>
          {isPaid && (
            <p className="mt-1 text-sm text-gray-600">
              Status:{' '}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {report.status}
              </span>
            </p>
          )}
        </div>

        {/* Vehicle Information */}
        {vehicleData && Object.keys(vehicleData).length > 0 && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Vehicle Information</h2>
            </div>
            <div className="px-6 py-5">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Year</dt>
                  <dd className="mt-1 text-sm text-gray-900">{vehicleData.year}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Make</dt>
                  <dd className="mt-1 text-sm text-gray-900">{vehicleData.make}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Model</dt>
                  <dd className="mt-1 text-sm text-gray-900">{vehicleData.model}</dd>
                </div>
                {vehicleData.trim && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Trim</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vehicleData.trim}</dd>
                  </div>
                )}
                {vehicleData.bodyType && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Body Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vehicleData.bodyType}</dd>
                  </div>
                )}
                {vehicleData.engine && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Engine</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vehicleData.engine}</dd>
                  </div>
                )}
                {vehicleData.transmission && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Transmission</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {vehicleData.transmission}
                    </dd>
                  </div>
                )}
                {vehicleData.driveType && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Drive Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vehicleData.driveType}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}

        {/* Accident History */}
        {accidentDetails && accidentDetails.accidents && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Accident History</h2>
            </div>
            <div className="px-6 py-5">
              {accidentDetails.accidents.length === 0 ? (
                <p className="text-sm text-gray-600">No accidents reported</p>
              ) : (
                <div className="space-y-4">
                  {accidentDetails.accidents.map((accident: any, index: number) => (
                    <div key={index} className="border-l-4 border-red-400 pl-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          Accident {index + 1}
                        </p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {accident.severity}
                        </span>
                      </div>
                      {accident.accidentDate && (
                        <p className="mt-1 text-sm text-gray-600">
                          Date: {accident.accidentDate}
                        </p>
                      )}
                      {accident.location && (
                        <p className="mt-1 text-sm text-gray-600">
                          Location: {accident.location}
                        </p>
                      )}
                      {accident.damageDescription && (
                        <p className="mt-2 text-sm text-gray-900">
                          {accident.damageDescription}
                        </p>
                      )}
                      {accident.estimatedCost && (
                        <p className="mt-1 text-sm text-gray-600">
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

        {/* Market Valuation */}
        {valuation && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Market Valuation</h2>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Low Value</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    ${valuation.lowValue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Average Value</p>
                  <p className="mt-2 text-3xl font-bold text-blue-600">
                    ${valuation.averageValue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">High Value</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    ${valuation.highValue.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Confidence Level:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {valuation.confidence}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Data Points:</span>
                  <span className="font-medium text-gray-900">{valuation.dataPoints}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Section */}
        {!isPaid && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-5">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Next Steps</h2>
              <p className="text-sm text-gray-600 mb-6">
                Select a report type to proceed with payment and receive your comprehensive PDF
                report within 24-48 hours.
              </p>

              {/* Payment Buttons */}
              <PaymentButtons reportId={id} />

              {/* Money-Back Guarantee */}
              <div className="mt-6 bg-green-50 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      100% Money-Back Guarantee
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        If the insurance settlement falls short of our valuation, request a full
                        refund within 90 days. We're confident in our valuations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
