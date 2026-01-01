/**
 * Supplier Directory Data Processing
 *
 * Processes supplier profiles stored as markdown files with YAML frontmatter.
 * Mirrors the pattern used in lib/knowledge-base.ts for consistency.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { markdownToHtml } from './markdown'

const SUPPLIERS_DIR = path.join(process.cwd(), 'content/suppliers')

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
 * Get all suppliers from markdown files
 * Optionally filter by state, service type, or specialties
 */
export async function getAllSuppliers(filters?: SupplierFilters): Promise<Supplier[]> {
  const serviceTypeDirs = ['appraisers', 'body-shops', 'advocates', 'attorneys']
  const suppliers: Supplier[] = []

  // Check if suppliers directory exists
  if (!fs.existsSync(SUPPLIERS_DIR)) {
    console.warn('Suppliers directory does not exist:', SUPPLIERS_DIR)
    return []
  }

  for (const dirName of serviceTypeDirs) {
    const dirPath = path.join(SUPPLIERS_DIR, dirName)

    // Skip if directory doesn't exist
    if (!fs.existsSync(dirPath)) {
      continue
    }

    const files = fs
      .readdirSync(dirPath)
      .filter(file => file.endsWith('.md') && file !== '_template.md')

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(fileContent)

      // Parse supplier data
      const supplier: Supplier = {
        slug: data.slug,
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        websiteUrl: data.websiteUrl,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        serviceType: data.serviceType,
        specialties: data.specialties || [],
        valueProposition: data.valueProposition,
        yearsInBusiness: data.yearsInBusiness,
        certifications: data.certifications || [],
        insuranceAccepted: data.insuranceAccepted || [],
        featured: data.featured || false,
        verified: data.verified || false,
        published: data.published !== false,
        content,
      }

      suppliers.push(supplier)
    }
  }

  // Filter unpublished in production
  let filtered = process.env.NODE_ENV === 'production'
    ? suppliers.filter(s => s.published)
    : suppliers

  // Apply filters if provided
  if (filters) {
    if (filters.state) {
      filtered = filtered.filter(s => s.state === filters.state)
    }

    if (filters.serviceType) {
      filtered = filtered.filter(s => s.serviceType === filters.serviceType)
    }

    if (filters.specialties && filters.specialties.length > 0) {
      filtered = filtered.filter(s =>
        filters.specialties!.some(specialty => s.specialties.includes(specialty))
      )
    }

    if (filters.featured !== undefined) {
      filtered = filtered.filter(s => s.featured === filters.featured)
    }
  }

  // Sort: featured first, then alphabetically by business name
  return filtered.sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return a.businessName.localeCompare(b.businessName)
  })
}

/**
 * Get a single supplier by slug
 * Converts markdown content to HTML
 */
export async function getSupplierBySlug(slug: string): Promise<Supplier | null> {
  const suppliers = await getAllSuppliers()
  const supplier = suppliers.find(s => s.slug === slug)

  if (!supplier) return null

  // Convert markdown to HTML
  supplier.htmlContent = await markdownToHtml(supplier.content)

  return supplier
}

/**
 * Get list of states that have suppliers
 * Returns sorted array of state codes
 */
export function getAvailableStates(): string[] {
  const serviceTypeDirs = ['appraisers', 'body-shops', 'advocates', 'attorneys']
  const states = new Set<string>()

  if (!fs.existsSync(SUPPLIERS_DIR)) {
    return []
  }

  for (const dirName of serviceTypeDirs) {
    const dirPath = path.join(SUPPLIERS_DIR, dirName)

    if (!fs.existsSync(dirPath)) {
      continue
    }

    const files = fs
      .readdirSync(dirPath)
      .filter(file => file.endsWith('.md') && file !== '_template.md')

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const { data } = matter(fileContent)

      if (data.state && (data.published !== false || process.env.NODE_ENV !== 'production')) {
        states.add(data.state)
      }
    }
  }

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

  // Get suppliers from same state or same service type
  const allSuppliers = await getAllSuppliers()

  const related = allSuppliers
    .filter(s => s.slug !== currentSlug)
    .sort((a, b) => {
      // Prioritize same state and same service type
      const aScore =
        (a.state === currentSupplier.state ? 2 : 0) +
        (a.serviceType === currentSupplier.serviceType ? 1 : 0)
      const bScore =
        (b.state === currentSupplier.state ? 2 : 0) +
        (b.serviceType === currentSupplier.serviceType ? 1 : 0)
      return bScore - aScore
    })
    .slice(0, limit)

  return related
}

/**
 * Get supplier count by service type
 * Useful for displaying counts in filters
 */
export async function getSupplierCountsByServiceType(): Promise<Record<string, number>> {
  const suppliers = await getAllSuppliers()
  const counts: Record<string, number> = {
    appraiser: 0,
    body_shop: 0,
    advocate: 0,
    attorney: 0,
  }

  suppliers.forEach(supplier => {
    counts[supplier.serviceType] = (counts[supplier.serviceType] || 0) + 1
  })

  return counts
}
