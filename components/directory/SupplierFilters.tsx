/**
 * SupplierFilters Component
 *
 * Filter sidebar for the supplier directory.
 * Desktop: sticky sidebar | Mobile: collapsible with floating button
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, X } from 'lucide-react'
import { useState } from 'react'

interface SupplierFiltersProps {
  availableStates: string[]
  serviceTypes: Array<{ value: string; label: string }>
  specialties: Array<{ value: string; label: string }>
}

export default function SupplierFilters({
  availableStates,
  serviceTypes,
  specialties,
}: SupplierFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Get current filter values from URL
  const currentState = searchParams.get('state') || ''
  const currentServiceType = searchParams.get('serviceType') || ''
  const currentSpecialties = searchParams.get('specialties')?.split(',').filter(Boolean) || []

  // Update URL with new filter values
  const updateFilters = (updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        params.delete(key)
      } else if (Array.isArray(value)) {
        params.set(key, value.join(','))
      } else {
        params.set(key, value)
      }
    })

    router.push(`/directory?${params.toString()}`, { scroll: false })
  }

  const handleStateChange = (state: string) => {
    updateFilters({ state: state || null })
  }

  const handleServiceTypeChange = (serviceType: string) => {
    updateFilters({ serviceType: serviceType || null })
  }

  const handleSpecialtyToggle = (specialty: string) => {
    const newSpecialties = currentSpecialties.includes(specialty)
      ? currentSpecialties.filter(s => s !== specialty)
      : [...currentSpecialties, specialty]
    updateFilters({ specialties: newSpecialties.length > 0 ? newSpecialties : null })
  }

  const clearAllFilters = () => {
    router.push('/directory', { scroll: false })
  }

  const hasActiveFilters = currentState || currentServiceType || currentSpecialties.length > 0

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </h3>
        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileFiltersOpen(false)}
          className="lg:hidden text-slate-500 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* State Filter */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
        <select
          value={currentState}
          onChange={e => handleStateChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
        >
          <option value="">All States</option>
          {availableStates.map(state => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {/* Service Type Filter */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">Service Type</label>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="serviceType"
              value=""
              checked={!currentServiceType}
              onChange={e => handleServiceTypeChange(e.target.value)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300"
            />
            <span className="ml-2 text-sm text-slate-700 group-hover:text-slate-900">
              All Types
            </span>
          </label>
          {serviceTypes.map(type => (
            <label key={type.value} className="flex items-center cursor-pointer group">
              <input
                type="radio"
                name="serviceType"
                value={type.value}
                checked={currentServiceType === type.value}
                onChange={e => handleServiceTypeChange(e.target.value)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300"
              />
              <span className="ml-2 text-sm text-slate-700 group-hover:text-slate-900">
                {type.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Specialties Filter */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">Specialties</label>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {specialties.map(specialty => (
            <label key={specialty.value} className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={currentSpecialties.includes(specialty.value)}
                onChange={() => handleSpecialtyToggle(specialty.value)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded"
              />
              <span className="ml-2 text-sm text-slate-700 group-hover:text-slate-900">
                {specialty.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear All Button */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="w-full px-4 py-2 text-sm font-semibold text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block sticky top-24 h-fit">
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
          <FiltersContent />
        </div>
      </div>

      {/* Mobile Filter Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary-600 to-emerald-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <Filter className="h-5 w-5" />
          Filters
          {hasActiveFilters && (
            <span className="bg-white text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {(currentState ? 1 : 0) + (currentServiceType ? 1 : 0) + currentSpecialties.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Filter Modal */}
      {mobileFiltersOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileFiltersOpen(false)}
          />

          {/* Modal */}
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <FiltersContent />
            </div>
          </div>
        </>
      )}
    </>
  )
}
