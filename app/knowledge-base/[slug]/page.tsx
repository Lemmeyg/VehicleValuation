import {
  getArticleBySlugStatic,
  getArticleListMetadataStatic,
  getAllArticleSlugs,
} from '@/lib/knowledge-base-db'
import { getRelatedArticles } from '@/lib/utils/related-articles'
import { deriveCategories } from '@/lib/utils/kb-articles'
import { splitArticleHtml } from '@/lib/utils/split-article-html'
import { formatDateET } from '@/lib/utils/format-date-eastern'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ArticlePageTracker } from '@/components/ArticlePageTracker'
import { ArticleCTA } from '@/components/ArticleCTA'
import { ArticleReportBar } from '@/components/ArticleReportBar'
import { RelatedArticlesSidebar } from '@/components/RelatedArticlesSidebar'
import { RelatedArticlesMobile } from '@/components/RelatedArticlesMobile'
import { DisputeLetterCTA } from '@/components/DisputeLetterCTA'
import StateDirectorySection from './StateDirectorySection'

export const revalidate = false

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlugStatic(slug)

  if (!article) return {}

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

  return {
    title: (() => {
      const suffix = ' | TotalLossToolKit.com'
      // Google displays roughly the first 60 characters of a <title>. Append
      // the brand suffix only when the whole string still fits; otherwise use
      // the full article title on its own. The previous logic hard-truncated
      // the title to 36 chars + an ellipsis so the suffix always fit, which
      // chopped ~40% of KB titles mid-word in the SERP.
      return article.title.length + suffix.length <= 60
        ? `${article.title}${suffix}`
        : article.title
    })(),
    description: article.description,
    alternates: {
      canonical: `${siteUrl}/knowledge-base/${slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      url: `${siteUrl}/knowledge-base/${slug}`,
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      authors: [article.author],
      tags: article.tags,
      siteName: 'TotalLossToolKit.com',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params

  const [article, allArticles] = await Promise.all([
    getArticleBySlugStatic(slug),
    getArticleListMetadataStatic(),
  ])

  if (!article) {
    notFound()
  }

  const relatedArticles = getRelatedArticles(slug, allArticles)
  const categories = deriveCategories(allArticles)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

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
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `${siteUrl}/knowledge-base/${slug}`,
      },
    ],
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TotalLossToolKit.com',
      url: siteUrl,
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/knowledge-base/${slug}`,
    },
    image: `${siteUrl}/knowledge-base/${slug}/opengraph-image`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <div className="min-h-screen bg-white">
        <ArticlePageTracker slug={article.slug} title={article.title} category={article.category} />
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
              {/* Main article column */}
              <article>
                <header className="mb-8">
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 text-sm font-semibold text-primary-600 bg-primary-50 rounded-full">
                      {article.category}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                    {article.title}
                  </h1>
                  <div className="flex items-center text-sm text-slate-600 space-x-4">
                    <span>{article.author}</span>
                    <span>•</span>
                    <time>{formatDateET(article.datePublished)}</time>
                    <span>•</span>
                    <span>{article.readingTime}</span>
                  </div>
                </header>

                {splitArticleHtml(article.htmlContent!).map((segment, i) =>
                  segment.type === 'html' ? (
                    <div
                      key={i}
                      className="prose prose-lg max-w-none"
                      dangerouslySetInnerHTML={{ __html: segment.content }}
                    />
                  ) : (
                    <ArticleReportBar
                      key={i}
                      articleSlug={article.slug}
                      placement={segment.placement}
                    />
                  )
                )}

                <ArticleCTA articleSlug={article.slug} />
                {(article.category === 'State Guides' ||
                  article.category === 'Owner Guides' ||
                  ['dispute', 'valuation', 'challenge', 'settlement'].some(kw =>
                    article.slug.includes(kw)
                  )) && <DisputeLetterCTA />}

                <StateDirectorySection slug={article.slug} category={article.category} />

                {/* Mobile related articles — hidden on desktop */}
                <RelatedArticlesMobile relatedArticles={relatedArticles} currentSlug={slug} />
              </article>

              {/* Sidebar — desktop only */}
              <aside className="hidden lg:block">
                <RelatedArticlesSidebar
                  relatedArticles={relatedArticles}
                  currentSlug={slug}
                  categories={categories}
                  currentCategory={article.category}
                />
              </aside>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
