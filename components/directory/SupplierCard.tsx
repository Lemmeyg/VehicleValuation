/**
 * SupplierCard Component
 *
 * Displays a supplier profile in a card format for the directory listing.
 * Clean, scannable design with single CTA focus.
 */

import Link from 'next/link'
import { MapPin, Award, BadgeCheck, Briefcase } from 'lucide-react'
import { Supplier } from '@/lib/suppliers-db'

interface SupplierCardProps {
  supplier: Supplier
}

export default function SupplierCard({ supplier }: SupplierCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 border border-slate-100 hover:border-primary-200 h-full flex flex-col">
      {/* Badge Row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-primary-100 text-primary-700">
          {getServiceTypeLabel(supplier.serviceType)}
        </span>
        {supplier.verified && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <BadgeCheck className="h-3 w-3" />
            Verified
          </span>
        )}
        {supplier.featured && (
          <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Featured
          </span>
        )}
      </div>

      {/* Business Name */}
      <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">
        {supplier.businessName}
      </h3>

      {/* Location */}
      <div className="flex items-center text-sm text-slate-600 mb-3">
        <MapPin className="h-4 w-4 mr-1 text-slate-400" />
        {supplier.city}, {supplier.state}
      </div>

      {/* Value Proposition */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex-grow">
        <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
          {supplier.valueProposition}
        </p>
      </div>

      {/* Specialty Tags */}
      {supplier.specialties.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <Award className="h-4 w-4 text-primary-600" />
            <span className="text-xs font-semibold text-slate-700">Specialties:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {supplier.specialties.slice(0, 3).map((specialty, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-full border border-primary-200"
              >
                {formatSpecialty(specialty)}
              </span>
            ))}
            {supplier.specialties.length > 3 && (
              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                +{supplier.specialties.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Years in Business */}
      {supplier.yearsInBusiness && (
        <div className="flex items-center text-xs text-slate-600 mb-4">
          <Briefcase className="h-3 w-3 mr-1 text-slate-400" />
          <span className="font-semibold text-emerald-700">
            {supplier.yearsInBusiness}+ years
          </span>
          {' '}in business
        </div>
      )}

      {/* CTA Button */}
      <Link
        href={`/directory/${supplier.slug}`}
        className="block w-full text-center px-4 py-3 bg-gradient-to-r from-primary-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md"
      >
        View Profile & Contact
      </Link>
    </div>
  )
}

/**
 * Helper function to get human-readable service type label
 */
function getServiceTypeLabel(serviceType: string): string {
  const labels: Record<string, string> = {
    appraiser: 'Vehicle Appraiser',
    body_shop: 'Body Shop',
    advocate: 'Claims Advocate',
    attorney: 'Auto Attorney',
  }
  return labels[serviceType] || serviceType
}

/**
 * Helper function to format specialty strings
 */
function formatSpecialty(specialty: string): string {
  const formatted: Record<string, string> = {
    total_loss: 'Total Loss',
    diminished_value: 'Diminished Value',
    independent_appraisals: 'Independent Appraisals',
    collision_repair: 'Collision Repair',
    frame_damage: 'Frame Damage',
    insurance_negotiation: 'Insurance Negotiation',
    claim_disputes: 'Claim Disputes',
    bad_faith: 'Bad Faith',
    legal_representation: 'Legal Representation',
  }
  return formatted[specialty] || specialty.replace(/_/g, ' ')
}
