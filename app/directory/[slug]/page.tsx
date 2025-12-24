/**
 * Supplier Detail Page
 *
 * Displays individual supplier profile with full content and lead capture form
 */

import {
  getSupplierBySlugStatic,
  getAllSupplierSlugs,
  getRelatedSuppliersStatic,
} from '@/lib/suppliers-db'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SupplierCard from '@/components/directory/SupplierCard'
import LeadCaptureForm from '@/components/directory/LeadCaptureForm'
import { MapPin, BadgeCheck, Award, Briefcase, Phone, Mail, Globe } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllSupplierSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supplier = await getSupplierBySlugStatic(slug)

  if (!supplier) return {}

  return {
    title: `${supplier.businessName} - ${supplier.city}, ${supplier.state} | Provider Directory`,
    description: supplier.valueProposition.substring(0, 160),
    openGraph: {
      title: supplier.businessName,
      description: supplier.valueProposition,
      type: 'website',
    },
  }
}

export default async function SupplierDetailPage({ params }: Props) {
  const { slug } = await params
  const supplier = await getSupplierBySlugStatic(slug)

  if (!supplier) {
    notFound()
  }

  const relatedSuppliers = await getRelatedSuppliersStatic(slug, 3)

  // Generate schema.org LocalBusiness markup
  const businessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: supplier.businessName,
    address: {
      '@type': 'PostalAddress',
      addressLocality: supplier.city,
      addressRegion: supplier.state,
      postalCode: supplier.zipCode || undefined,
    },
    telephone: supplier.phone,
    email: supplier.email,
    url: supplier.websiteUrl || undefined,
  }

  // Generate BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: process.env.NEXT_PUBLIC_SITE_URL || 'https://vehiclevaluationauthority.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Directory',
        item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://vehiclevaluationauthority.com'}/directory`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: supplier.businessName,
        item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://vehiclevaluationauthority.com'}/directory/${slug}`,
      },
    ],
  }

  return (
    <>
      {/* Schema.org markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-white">
        <Navbar />

        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="mb-6 text-sm text-slate-600">
              <ol className="flex items-center space-x-2">
                <li>
                  <Link href="/" className="hover:text-primary-600">
                    Home
                  </Link>
                </li>
                <li>/</li>
                <li>
                  <Link href="/directory" className="hover:text-primary-600">
                    Directory
                  </Link>
                </li>
                <li>/</li>
                <li className="text-slate-900 font-medium">{supplier.businessName}</li>
              </ol>
            </nav>

            {/* Two-Column Layout */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Main Content (2/3) */}
              <div className="flex-1">
                {/* Header */}
                <div className="mb-6">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-bold uppercase bg-primary-100 text-primary-700">
                      {getServiceTypeLabel(supplier.serviceType)}
                    </span>
                    {supplier.verified && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <BadgeCheck className="h-4 w-4" />
                        Verified Provider
                      </span>
                    )}
                    {supplier.featured && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Business Name */}
                  <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
                    {supplier.businessName}
                  </h1>

                  {/* Location */}
                  <div className="flex items-center text-lg text-slate-600 mb-4">
                    <MapPin className="h-5 w-5 mr-2 text-slate-400" />
                    {supplier.city}, {supplier.state}
                  </div>

                  {/* Value Proposition */}
                  <div className="p-4 bg-gradient-to-r from-primary-50 to-emerald-50 rounded-lg border border-primary-100">
                    <p className="text-lg text-slate-800 font-medium leading-relaxed">
                      {supplier.valueProposition}
                    </p>
                  </div>
                </div>

                {/* Credentials Box */}
                {(supplier.certifications.length > 0 || supplier.yearsInBusiness) && (
                  <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Years in Business */}
                      {supplier.yearsInBusiness && (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Briefcase className="h-5 w-5 text-emerald-700" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-emerald-700">
                              {supplier.yearsInBusiness}+ Years
                            </div>
                            <div className="text-sm text-slate-600">In Business</div>
                          </div>
                        </div>
                      )}

                      {/* Certifications */}
                      {supplier.certifications.length > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Award className="h-5 w-5 text-blue-700" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-700 mb-1">
                              Certifications
                            </div>
                            <ul className="space-y-1">
                              {supplier.certifications.map((cert, idx) => (
                                <li key={idx} className="text-sm text-slate-600 flex items-center">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2" />
                                  {cert}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Content */}
                <article
                  className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-primary-600 prose-li:text-slate-700"
                  dangerouslySetInnerHTML={{ __html: supplier.htmlContent || '' }}
                />
              </div>

              {/* Sidebar (1/3) - Sticky */}
              <aside className="lg:w-96 flex-shrink-0">
                <div className="lg:sticky lg:top-24 space-y-6">
                  {/* Contact Info Card */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Contact Information</h3>
                    <div className="space-y-3">
                      {supplier.phone && (
                        <a
                          href={`tel:${supplier.phone}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-primary-700" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Phone</div>
                            <div className="text-sm font-semibold text-slate-900">
                              {supplier.phone}
                            </div>
                          </div>
                        </a>
                      )}

                      {supplier.email && (
                        <a
                          href={`mailto:${supplier.email}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-emerald-700" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Email</div>
                            <div className="text-sm font-semibold text-slate-900 break-all">
                              {supplier.email}
                            </div>
                          </div>
                        </a>
                      )}

                      {supplier.websiteUrl && (
                        <a
                          href={supplier.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Globe className="h-5 w-5 text-blue-700" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Website</div>
                            <div className="text-sm font-semibold text-blue-600 break-all">
                              Visit Website →
                            </div>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Lead Capture Form */}
                  <LeadCaptureForm supplierSlug={slug} supplierName={supplier.businessName} />
                </div>
              </aside>
            </div>

            {/* Related Providers */}
            {relatedSuppliers.length > 0 && (
              <div className="mt-16">
                <h2 className="text-3xl font-bold text-slate-900 mb-6">Related Providers</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedSuppliers.map(related => (
                    <SupplierCard key={related.slug} supplier={related} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
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
