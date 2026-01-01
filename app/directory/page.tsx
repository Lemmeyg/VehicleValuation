/**
 * Directory Page
 *
 * Displays all service providers with CMS-driven content and filtering
 */

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SupplierCard from '@/components/directory/SupplierCard'
import SupplierFilters from '@/components/directory/SupplierFilters'
import {
  getAllSuppliers,
  getAvailableStates,
  getServiceTypes,
  getSpecialtyOptions,
} from '@/lib/suppliers-db'
import { getUser, getUserProfile } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import ContactUsDialog from '@/components/directory/ContactUsDialog'

export const metadata: Metadata = {
  title:
    'Professional Services Directory - Vehicle Appraisers & Claims Advocates | Vehicle Valuation Authority',
  description:
    'Connect with experts who help vehicle owners understand their situation and make the right decision for them.',
}

interface SearchParams {
  state?: string
  serviceType?: string
  specialties?: string
}

interface DirectoryPageProps {
  searchParams: Promise<SearchParams>
}

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const params = await searchParams

  // Parse filters from URL
  const filters = {
    state: params.state,
    serviceType: params.serviceType as
      | 'appraiser'
      | 'body_shop'
      | 'advocate'
      | 'attorney'
      | undefined,
    specialties: params.specialties?.split(',').filter(Boolean),
  }

  // Get filtered suppliers
  const suppliers = await getAllSuppliers(filters)

  // Get filter options
  const availableStates = await getAvailableStates()
  const serviceTypes = getServiceTypes()
  const specialtyOptions = getSpecialtyOptions()

  // Get user information
  const user = await getUser()
  const profile = await getUserProfile()
  const isAuthenticated = !!user
  const userName = profile?.full_name || user?.email?.split('@')[0] || ''
  const userEmail = user?.email || ''

  // Get user's favorited suppliers
  let favoritedSlugs: string[] = []
  if (user) {
    const supabase = await createServerSupabaseClient()
    const { data: favorites } = await supabase
      .from('user_saved_suppliers')
      .select('supplier_slug')
      .eq('user_id', user.id)

    favoritedSlugs = favorites?.map(f => f.supplier_slug) || []
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Professional Services Directory
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Connect with experts who help vehicle owners understand their situation and make the
              right decision for them
            </p>
            <p className="text-sm text-slate-500 mt-3 max-w-2xl mx-auto">
              These are independent service providers. We do not have any liability based on the
              work they do.
            </p>
          </div>

          {/* Two-Column Layout: Filters + Results */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <Suspense fallback={<FiltersSkeleton />}>
                <SupplierFilters
                  availableStates={availableStates}
                  serviceTypes={serviceTypes}
                  specialties={specialtyOptions}
                />
              </Suspense>
            </aside>

            {/* Results */}
            <div className="flex-1">
              {/* Results Count */}
              <div className="mb-6">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{suppliers.length}</span>{' '}
                  {suppliers.length === 1 ? 'provider' : 'providers'}
                  {(filters.state || filters.serviceType || filters.specialties?.length) && (
                    <span> matching your filters</span>
                  )}
                </p>
              </div>

              {/* Suppliers Grid */}
              {suppliers.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      No providers found
                    </h3>
                    <p className="text-slate-600 mb-4">
                      No professionals match your current filter criteria. Try adjusting your
                      filters.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {suppliers.map(supplier => (
                    <SupplierCard
                      key={supplier.slug}
                      supplier={supplier}
                      isFavorited={favoritedSlugs.includes(supplier.slug)}
                      isAuthenticated={isAuthenticated}
                      userName={userName}
                      userEmail={userEmail}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 bg-gradient-to-br from-primary-600 to-emerald-600 rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-3xl font-bold mb-4">Don&apos;t see a provider for your need?</h2>
            <div className="text-lg text-white/90 mb-6 max-w-2xl mx-auto">
              Please{' '}
              <ContactUsDialog
                isAuthenticated={isAuthenticated}
                userName={userName}
                userEmail={userEmail}
              />{' '}
              and let us know what service you&apos;re looking for.
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

/**
 * Loading skeleton for filters
 */
function FiltersSkeleton() {
  return (
    <div className="hidden lg:block bg-white rounded-xl shadow-md p-6 border border-slate-100">
      <div className="space-y-6">
        <div className="h-6 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 bg-slate-200 rounded animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
