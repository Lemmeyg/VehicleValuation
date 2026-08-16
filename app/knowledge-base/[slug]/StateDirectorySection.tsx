import Link from 'next/link'
import SupplierCard from '@/components/directory/SupplierCard'
import { getStateDirectorySuppliers } from '@/lib/suppliers-db'
import { deriveStateFromSlug } from '@/lib/deriveStateFromSlug'
import { getStateCodeByName } from '@/lib/personalization/state-article'

interface StateDirectorySectionProps {
  slug: string
  category: string
}

export default async function StateDirectorySection({
  slug,
  category,
}: StateDirectorySectionProps) {
  if (category !== 'State Guides') return null

  const state = deriveStateFromSlug(slug)
  if (!state) return null

  // The suppliers table stores two-letter state codes (e.g. "PA"), not full names.
  const stateCode = getStateCodeByName(state)
  if (!stateCode) return null

  const suppliers = await getStateDirectorySuppliers(stateCode)
  if (suppliers.length === 0) return null

  const hasMore = suppliers.length === 4
  const displayedSuppliers = suppliers.slice(0, 3)

  return (
    <section className="mt-12 border-t pt-10">
      <h2 className="text-2xl font-bold mb-6">Find a {state} Total Loss Professional</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayedSuppliers.map(supplier => (
          <SupplierCard key={supplier.slug} supplier={supplier} isAuthenticated={false} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-6">
          <Link
            href={`/directory?state=${encodeURIComponent(stateCode)}`}
            className="text-blue-600 hover:underline font-medium"
          >
            View all {state} professionals →
          </Link>
        </div>
      )}
    </section>
  )
}
