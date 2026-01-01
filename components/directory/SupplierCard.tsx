/**
 * SupplierCard Component
 *
 * Displays a supplier profile in a card format for the directory listing.
 * Clean, scannable design with single CTA focus.
 */

import { MapPin, Award } from 'lucide-react'
import { Supplier } from '@/lib/suppliers-db'
import FavoriteButton from './FavoriteButton'
import ContactRequestButton from './ContactRequestButton'

interface SupplierCardProps {
  supplier: Supplier
  isFavorited?: boolean
  isAuthenticated?: boolean
  userName?: string
  userEmail?: string
}

export default function SupplierCard({
  supplier,
  isFavorited = false,
  isAuthenticated = false,
  userName = '',
  userEmail = '',
}: SupplierCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 border border-slate-100 hover:border-primary-200 h-full flex flex-col">
      {/* Header Row: Favorite Button */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1" />
        <FavoriteButton
          supplierSlug={supplier.slug}
          initialIsFavorited={isFavorited}
          isAuthenticated={isAuthenticated}
        />
      </div>

      {/* Business Name */}
      <h3 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2">
        {supplier.businessName}
      </h3>

      {/* Description / Value Proposition */}
      <div className="mb-4 flex-grow">
        <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">
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
            {supplier.specialties.map((specialty, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-full border border-primary-200"
              >
                {formatSpecialty(specialty)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Location (State) */}
      <div className="flex items-center text-sm text-slate-600 mb-4">
        <MapPin className="h-4 w-4 mr-1 text-slate-400" />
        {supplier.state}
      </div>

      {/* Contact Request Button */}
      <ContactRequestButton
        supplierSlug={supplier.slug}
        businessName={supplier.businessName}
        isAuthenticated={isAuthenticated}
        userName={userName}
        userEmail={userEmail}
      />
    </div>
  )
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
