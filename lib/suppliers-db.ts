/**
 * Supplier Directory - Database Version
 *
 * Reads suppliers from Supabase database instead of markdown files
 * This version works with Netlify and other static hosting platforms
 */

import { createServerSupabaseClient, supabase } from './db/supabase'
import { markdownToHtml } from './markdown'

export interface Supplier {
  // Unique identifier
  slug: string

  // Business Information
  businessName: string
  contactName?: string
  email: string
  phone?: string
  websiteUrl?: string

  // Location
  city: string
  state: string
  zipCode?: string

  // Service Details
  serviceType: 'appraiser' | 'body_shop' | 'advocate' | 'attorney'
  specialties: string[]
  valueProposition: string
  yearsInBusiness?: number

  // Credentials
  certifications: string[]
  insuranceAccepted: string[]

  // Display Settings
  featured: boolean
  verified: boolean
  published: boolean

  // Content
  content: string
  htmlContent?: string
}

export interface SupplierFilters {
  state?: string
  serviceType?: 'appraiser' | 'body_shop' | 'advocate' | 'attorney'
  specialties?: string[]
  featured?: boolean
}

/**
 * Get all suppliers from database
 * Optionally filter by state, service type, or specialties
 */
export async function getAllSuppliers(filters?: SupplierFilters): Promise<Supplier[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('suppliers')
    .select('*')
    .order('featured', { ascending: false })
    .order('business_name', { ascending: true })

  // Apply filters
  if (filters) {
    if (filters.state) {
      query = query.eq('state', filters.state)
    }

    if (filters.serviceType) {
      query = query.eq('service_type', filters.serviceType)
    }

    if (filters.featured !== undefined) {
      query = query.eq('featured', filters.featured)
    }

    // Note: specialty filtering requires custom logic due to array field
  }

  // Filter published in production
  if (process.env.NODE_ENV === 'production') {
    query = query.eq('published', true)
  }

  const { data: suppliers, error } = await query

  if (error) {
    console.error('Error fetching suppliers:', error)
    return []
  }

  if (!suppliers || suppliers.length === 0) {
    return []
  }

  // Transform database format to Supplier interface
  let transformedSuppliers: Supplier[] = suppliers.map(supplier => ({
    slug: supplier.slug,
    businessName: supplier.business_name,
    contactName: supplier.contact_name || undefined,
    email: supplier.contact_email,
    phone: supplier.contact_phone || undefined,
    websiteUrl: supplier.website_url || undefined,
    city: supplier.city,
    state: supplier.state,
    zipCode: supplier.zip_code || undefined,
    serviceType: supplier.service_type,
    specialties: supplier.specialties || [],
    valueProposition: supplier.value_proposition || '',
    yearsInBusiness: supplier.years_in_business || undefined,
    certifications: supplier.certifications || [],
    insuranceAccepted: supplier.insurance_accepted || [],
    featured: supplier.featured || false,
    verified: supplier.verified || false,
    published: supplier.published !== false,
    content: supplier.content || '',
  }))

  // Apply specialty filter if provided (done in-memory due to array field)
  if (filters?.specialties && filters.specialties.length > 0) {
    transformedSuppliers = transformedSuppliers.filter(s =>
      filters.specialties!.some(specialty => s.specialties.includes(specialty))
    )
  }

  return transformedSuppliers
}

/**
 * Get a single supplier by slug
 * Converts markdown content to HTML
 */
export async function getSupplierBySlug(slug: string): Promise<Supplier | null> {
  const supabase = await createServerSupabaseClient()

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !supplier) {
    console.error('Error fetching supplier:', error)
    return null
  }

  // Transform to Supplier interface
  const transformedSupplier: Supplier = {
    slug: supplier.slug,
    businessName: supplier.business_name,
    contactName: supplier.contact_name || undefined,
    email: supplier.contact_email,
    phone: supplier.contact_phone || undefined,
    websiteUrl: supplier.website_url || undefined,
    city: supplier.city,
    state: supplier.state,
    zipCode: supplier.zip_code || undefined,
    serviceType: supplier.service_type,
    specialties: supplier.specialties || [],
    valueProposition: supplier.value_proposition || '',
    yearsInBusiness: supplier.years_in_business || undefined,
    certifications: supplier.certifications || [],
    insuranceAccepted: supplier.insurance_accepted || [],
    featured: supplier.featured || false,
    verified: supplier.verified || false,
    published: supplier.published !== false,
    content: supplier.content || '',
  }

  // Convert markdown to HTML
  if (transformedSupplier.content) {
    transformedSupplier.htmlContent = await markdownToHtml(transformedSupplier.content)
  }

  return transformedSupplier
}

/**
 * Get list of states that have suppliers
 * Returns sorted array of state codes
 */
export async function getAvailableStates(): Promise<string[]> {
  const supabase = await createServerSupabaseClient()

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('state')
    .eq('published', true)

  if (error || !suppliers) {
    console.error('Error fetching states:', error)
    return []
  }

  const states = new Set<string>()
  suppliers.forEach(s => {
    if (s.state) states.add(s.state)
  })

  return Array.from(states).sort()
}

/**
 * Get service type options for filtering
 */
export function getServiceTypes(): Array<{ value: string; label: string }> {
  return [
    { value: 'appraiser', label: 'Vehicle Appraiser' },
    { value: 'body_shop', label: 'Body Shop' },
    { value: 'advocate', label: 'Claims Advocate' },
    { value: 'attorney', label: 'Auto Attorney' },
  ]
}

/**
 * Get specialty options for filtering
 */
export function getSpecialtyOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'total_loss', label: 'Total Loss Claims' },
    { value: 'diminished_value', label: 'Diminished Value' },
    { value: 'independent_appraisals', label: 'Independent Appraisals' },
    { value: 'collision_repair', label: 'Collision Repair' },
    { value: 'frame_damage', label: 'Frame Damage' },
    { value: 'insurance_negotiation', label: 'Insurance Negotiation' },
    { value: 'claim_disputes', label: 'Claim Disputes' },
    { value: 'bad_faith', label: 'Bad Faith Claims' },
    { value: 'legal_representation', label: 'Legal Representation' },
  ]
}

/**
 * Get related suppliers based on location or service type
 * Excludes the current supplier by slug
 */
export async function getRelatedSuppliers(
  currentSlug: string,
  limit: number = 3
): Promise<Supplier[]> {
  const currentSupplier = await getSupplierBySlug(currentSlug)
  if (!currentSupplier) return []

  const supabase = await createServerSupabaseClient()

  // Get suppliers from same state or same service type
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('published', true)
    .neq('slug', currentSlug)
    .limit(limit * 2) // Get more than needed for sorting

  if (error || !suppliers) {
    console.error('Error fetching related suppliers:', error)
    return []
  }

  // Transform and prioritize
  const transformed: Supplier[] = suppliers.map(supplier => ({
    slug: supplier.slug,
    businessName: supplier.business_name,
    contactName: supplier.contact_name || undefined,
    email: supplier.contact_email,
    phone: supplier.contact_phone || undefined,
    websiteUrl: supplier.website_url || undefined,
    city: supplier.city,
    state: supplier.state,
    zipCode: supplier.zip_code || undefined,
    serviceType: supplier.service_type,
    specialties: supplier.specialties || [],
    valueProposition: supplier.value_proposition || '',
    yearsInBusiness: supplier.years_in_business || undefined,
    certifications: supplier.certifications || [],
    insuranceAccepted: supplier.insurance_accepted || [],
    featured: supplier.featured || false,
    verified: supplier.verified || false,
    published: supplier.published !== false,
    content: supplier.content || '',
  }))

  // Sort by relevance
  const sorted = transformed.sort((a, b) => {
    const aScore =
      (a.state === currentSupplier.state ? 2 : 0) +
      (a.serviceType === currentSupplier.serviceType ? 1 : 0)
    const bScore =
      (b.state === currentSupplier.state ? 2 : 0) +
      (b.serviceType === currentSupplier.serviceType ? 1 : 0)
    return bScore - aScore
  })

  return sorted.slice(0, limit)
}

/**
 * Get supplier count by service type
 * Useful for displaying counts in filters
 */
export async function getSupplierCountsByServiceType(): Promise<Record<string, number>> {
  const supabase = await createServerSupabaseClient()

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('service_type')
    .eq('published', true)

  if (error || !suppliers) {
    console.error('Error fetching supplier counts:', error)
    return {
      appraiser: 0,
      body_shop: 0,
      advocate: 0,
      attorney: 0,
    }
  }

  const counts: Record<string, number> = {
    appraiser: 0,
    body_shop: 0,
    advocate: 0,
    attorney: 0,
  }

  suppliers.forEach(s => {
    if (s.service_type) {
      counts[s.service_type] = (counts[s.service_type] || 0) + 1
    }
  })

  return counts
}

/**
 * Search suppliers by keyword
 */
export async function searchSuppliers(
  query: string,
  filters?: SupplierFilters
): Promise<Supplier[]> {
  const supabase = await createServerSupabaseClient()

  const { data: results, error } = await supabase.rpc('search_suppliers', {
    search_query: query,
    filter_state: filters?.state || null,
    filter_service_type: filters?.serviceType || null,
    filter_specialties: filters?.specialties || null,
  })

  if (error || !results) {
    console.error('Error searching suppliers:', error)
    return []
  }

  // Define the search result type from the RPC function
  interface SearchResult {
    slug: string
    business_name: string
    city: string
    state: string
    service_type: 'appraiser' | 'body_shop' | 'advocate' | 'attorney'
    value_proposition?: string
    featured?: boolean
    verified?: boolean
  }

  return results.map((result: SearchResult) => ({
    slug: result.slug,
    businessName: result.business_name,
    email: '',
    city: result.city,
    state: result.state,
    serviceType: result.service_type,
    specialties: [],
    valueProposition: result.value_proposition || '',
    certifications: [],
    insuranceAccepted: [],
    featured: result.featured || false,
    verified: result.verified || false,
    published: true,
    content: '',
  }))
}

// ============================================================================
// STATIC GENERATION HELPERS
// These functions use the simple supabase client (no cookies)
// Safe to use in generateStaticParams and other build-time functions
// ============================================================================

/**
 * Get all supplier slugs for static generation
 * Uses simple client (no cookies) - safe for generateStaticParams
 */
export async function getAllSupplierSlugs(): Promise<string[]> {
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('slug')
    .eq('published', true)

  if (error || !suppliers) {
    console.error('Error fetching supplier slugs:', error)
    return []
  }

  return suppliers.map(supplier => supplier.slug)
}

/**
 * Get supplier by slug for static generation
 * Uses simple client (no cookies) - safe for generateMetadata
 */
export async function getSupplierBySlugStatic(slug: string): Promise<Supplier | null> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !supplier) {
    console.error('Error fetching supplier:', error)
    return null
  }

  // Transform to Supplier interface
  const transformedSupplier: Supplier = {
    slug: supplier.slug,
    businessName: supplier.business_name,
    contactName: supplier.contact_name || undefined,
    email: supplier.contact_email,
    phone: supplier.contact_phone || undefined,
    websiteUrl: supplier.website_url || undefined,
    city: supplier.city,
    state: supplier.state,
    zipCode: supplier.zip_code || undefined,
    serviceType: supplier.service_type,
    specialties: supplier.specialties || [],
    valueProposition: supplier.value_proposition || '',
    yearsInBusiness: supplier.years_in_business || undefined,
    certifications: supplier.certifications || [],
    insuranceAccepted: supplier.insurance_accepted || [],
    featured: supplier.featured || false,
    verified: supplier.verified || false,
    published: supplier.published !== false,
    content: supplier.content || '',
  }

  // Convert markdown to HTML
  if (transformedSupplier.content) {
    transformedSupplier.htmlContent = await markdownToHtml(transformedSupplier.content)
  }

  return transformedSupplier
}

/**
 * Get related suppliers for static generation
 * Uses simple client (no cookies) - safe for build-time
 */
export async function getRelatedSuppliersStatic(
  currentSlug: string,
  limit: number = 3
): Promise<Supplier[]> {
  const currentSupplier = await getSupplierBySlugStatic(currentSlug)
  if (!currentSupplier) return []

  // Get suppliers from same state or same service type
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('published', true)
    .neq('slug', currentSlug)
    .limit(limit * 2) // Get more than needed for sorting

  if (error || !suppliers) {
    console.error('Error fetching related suppliers:', error)
    return []
  }

  // Transform and prioritize
  const transformed: Supplier[] = suppliers.map(supplier => ({
    slug: supplier.slug,
    businessName: supplier.business_name,
    contactName: supplier.contact_name || undefined,
    email: supplier.contact_email,
    phone: supplier.contact_phone || undefined,
    websiteUrl: supplier.website_url || undefined,
    city: supplier.city,
    state: supplier.state,
    zipCode: supplier.zip_code || undefined,
    serviceType: supplier.service_type,
    specialties: supplier.specialties || [],
    valueProposition: supplier.value_proposition || '',
    yearsInBusiness: supplier.years_in_business || undefined,
    certifications: supplier.certifications || [],
    insuranceAccepted: supplier.insurance_accepted || [],
    featured: supplier.featured || false,
    verified: supplier.verified || false,
    published: supplier.published !== false,
    content: supplier.content || '',
  }))

  // Sort by relevance
  const sorted = transformed.sort((a, b) => {
    const aScore =
      (a.state === currentSupplier.state ? 2 : 0) +
      (a.serviceType === currentSupplier.serviceType ? 1 : 0)
    const bScore =
      (b.state === currentSupplier.state ? 2 : 0) +
      (b.serviceType === currentSupplier.serviceType ? 1 : 0)
    return bScore - aScore
  })

  return sorted.slice(0, limit)
}
