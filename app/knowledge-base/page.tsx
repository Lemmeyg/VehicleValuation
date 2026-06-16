/**
 * Knowledge Base Page
 *
 * Displays knowledge base articles with search and category filtering.
 * Filtering is server-side via URL params: ?q= for search, ?category= for category.
 */

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { BookOpen, Clock, Tag } from 'lucide-react'
import {
  getArticleListMetadata,
  searchArticles,
  getArticlesByCategory,
} from '@/lib/knowledge-base-db'
import Link from 'next/link'
import { KnowledgeBasePageTracker, ArticleLinkTracker } from '@/components/KnowledgeBaseTracker'
import { KBFilterBar } from '@/components/KBFilterBar'
import { deriveCategories, filterArticlesByCategory } from '@/lib/utils/kb-articles'

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

interface Props {
  searchParams: Promise<{ q?: string; category?: string }>
}

export default async function KnowledgeBasePage({ searchParams }: Props) {
  const { q, category } = await searchParams

  const [allArticles, searchResults] = await Promise.all([
    getArticleListMetadata(),
    q ? searchArticles(q) : Promise.resolve([] as Awaited<ReturnType<typeof searchArticles>>),
  ])

  const categoryNames = deriveCategories(allArticles).map(c => c.name)
  const totalCount = allArticles.length

  let articles = allArticles
  if (q && category) {
    articles = filterArticlesByCategory(searchResults, category)
  } else if (q) {
    articles = searchResults
  } else if (category) {
    articles = await getArticlesByCategory(category)
  }

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
        <KnowledgeBasePageTracker articleCount={articles.length} />
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Knowledge Base</h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Expert guides and resources to help you understand vehicle valuation, insurance
                claims, and your rights
              </p>
            </div>

            {/* Filter bar */}
            <div className="max-w-4xl mx-auto mb-4">
              <KBFilterBar categories={categoryNames} activeCategory={category} activeQuery={q} />
            </div>

            {/* Results count */}
            <p className="text-sm text-slate-500 mb-8 max-w-4xl mx-auto">
              {q || category
                ? `Showing ${articles.length} of ${totalCount} articles`
                : `Showing ${totalCount} articles`}
            </p>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map(article => (
                <ArticleLinkTracker key={article.slug} article={article}>
                  <Link
                    href={`/knowledge-base/${article.slug}`}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer group border border-slate-100 hover:border-primary-200 block"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-primary-100 text-primary-700">
                          {article.category}
                        </span>
                        <div className="flex items-center text-slate-500 text-sm">
                          <Clock className="h-4 w-4 mr-1" />
                          {article.readingTime}
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-emerald-600 rounded-lg flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-slate-600 mb-4 line-clamp-3">{article.description}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {article.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-primary-600 font-semibold text-sm hover:text-primary-700 flex items-center">
                        Read Article
                        <svg
                          className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                </ArticleLinkTracker>
              ))}
            </div>

            {articles.length === 0 && (
              <div className="text-center py-16">
                <p className="text-slate-500 text-lg">No articles found.</p>
                <Link
                  href="/knowledge-base"
                  className="mt-4 inline-block text-primary-600 font-semibold hover:text-primary-700"
                >
                  Clear filters
                </Link>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
