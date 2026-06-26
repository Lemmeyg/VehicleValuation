/**
 * Knowledge Base Page
 *
 * Static page — all filtering handled client-side in KBClientPage.
 * Removing searchParams dependency eliminates per-URL SSR invocations from bot crawlers.
 */

import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getArticleListMetadata } from '@/lib/knowledge-base-db'
import { deriveCategories } from '@/lib/utils/kb-articles'
import { KBClientPage } from '@/components/KBClientPage'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const revalidate = 3600

export const metadata = {
  title: 'Knowledge Base | TotalLossToolKit.com',
  description:
    'Expert guides and resources to help you understand vehicle valuation, insurance claims, and your rights',
  alternates: {
    canonical: `${siteUrl}/knowledge-base`,
  },
  openGraph: {
    title: 'Knowledge Base | TotalLossToolKit.com',
    description:
      'Expert guides and resources to help you understand vehicle valuation, insurance claims, and your rights',
    type: 'website',
    url: `${siteUrl}/knowledge-base`,
    siteName: 'TotalLossToolKit.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Knowledge Base | TotalLossToolKit.com',
    description:
      'Expert guides and resources to help you understand vehicle valuation, insurance claims, and your rights',
  },
}

function KBPageSkeleton({ count }: { count: number }) {
  return (
    <>
      <div className="max-w-4xl mx-auto mb-4 h-24 bg-slate-100 rounded-xl animate-pulse" />
      <p className="text-sm text-slate-500 mb-8 max-w-4xl mx-auto">Showing {count} articles</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: Math.min(count, 9) }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-md h-64 animate-pulse" />
        ))}
      </div>
    </>
  )
}

export default async function KnowledgeBasePage() {
  const allArticles = await getArticleListMetadata()
  const categories = deriveCategories(allArticles).map(c => c.name)

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Knowledge Base',
        item: `${siteUrl}/knowledge-base`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Knowledge Base</h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Expert guides and resources to help you understand vehicle valuation, insurance
                claims, and your rights
              </p>
            </div>
            <Suspense fallback={<KBPageSkeleton count={allArticles.length} />}>
              <KBClientPage
                articles={allArticles}
                categories={categories}
                totalCount={allArticles.length}
              />
            </Suspense>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
