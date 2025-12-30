/**
 * Admin Directory Management
 *
 * Manage Directory suppliers - create, edit, delete, and upload markdown files
 */

import { getAllSuppliers } from '@/lib/suppliers-db'
import Link from 'next/link'

export default async function AdminDirectoryPage() {
  const suppliers = await getAllSuppliers()

  // Group suppliers by service type
  const suppliersByType = suppliers.reduce(
    (acc, supplier) => {
      const type = supplier.serviceType || 'other'
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(supplier)
      return acc
    },
    {} as Record<string, typeof suppliers>
  )

  const serviceTypeLabels: Record<string, string> = {
    appraiser: 'Vehicle Appraisers',
    body_shop: 'Body Shops',
    advocate: 'Claims Advocates',
    attorney: 'Auto Attorneys',
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Directory Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage supplier directory, upload new listings, and organize service providers
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/directory/upload"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Upload Files
          </Link>
          <Link
            href="/admin/directory/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Supplier
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Suppliers</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{suppliers.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Appraisers</div>
          <div className="mt-2 text-3xl font-bold text-blue-600">
            {suppliers.filter(s => s.serviceType === 'appraiser').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Body Shops</div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {suppliers.filter(s => s.serviceType === 'body_shop').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Advocates</div>
          <div className="mt-2 text-3xl font-bold text-purple-600">
            {suppliers.filter(s => s.serviceType === 'advocate').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Attorneys</div>
          <div className="mt-2 text-3xl font-bold text-orange-600">
            {suppliers.filter(s => s.serviceType === 'attorney').length}
          </div>
        </div>
      </div>

      {/* Suppliers by Type */}
      <div className="space-y-6">
        {Object.entries(suppliersByType).map(([type, typeSuppliers]) => (
          <div key={type} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {serviceTypeLabels[type] || type}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({typeSuppliers.length} listings)
                </span>
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {typeSuppliers.map(supplier => (
                <div
                  key={supplier.slug}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-medium text-gray-900">
                          {supplier.businessName}
                        </h3>
                        <div className="flex items-center gap-2">
                          {supplier.verified && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              ✓ Verified
                            </span>
                          )}
                          {supplier.featured && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Featured
                            </span>
                          )}
                          {!supplier.published && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-1">
                        {supplier.valueProposition}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {supplier.city}, {supplier.state}
                        </span>
                        {supplier.specialties && supplier.specialties.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{supplier.specialties.length} specialties</span>
                          </>
                        )}
                        {supplier.yearsInBusiness && (
                          <>
                            <span>•</span>
                            <span>{supplier.yearsInBusiness} years</span>
                          </>
                        )}
                        {supplier.email && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{supplier.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/directory/${supplier.slug}`}
                        target="_blank"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View
                      </Link>
                      <Link
                        href={`/admin/directory/edit/${supplier.slug}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {suppliers.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No suppliers yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new supplier listing or uploading markdown files
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/admin/directory/upload"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Upload Files
            </Link>
            <Link
              href="/admin/directory/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              New Supplier
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
