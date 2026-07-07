'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { BookOpen, Clock, Tag } from 'lucide-react'
import { KBFilterBar } from '@/components/KBFilterBar'
import { KnowledgeBasePageTracker, ArticleLinkTracker } from '@/components/KnowledgeBaseTracker'
import type { ArticleListItem } from '@/lib/knowledge-base-db'

interface KBClientPageProps {
  articles: ArticleListItem[]
  categories: string[]
  totalCount: number
}

export function KBClientPage({ articles, categories, totalCount }: KBClientPageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeQuery, setActiveQuery] = useState(searchParams.get('q') ?? '')
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') ?? '')

  const filteredArticles = useMemo(() => {
    let result = articles
    if (activeCategory) {
      result = result.filter(a => a.category === activeCategory)
    }
    if (activeQuery) {
      const q = activeQuery.toLowerCase()
      result = result.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [articles, activeCategory, activeQuery])

  const updateUrl = useCallback(
    (query: string, category: string) => {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (category) params.set('category', category)
      const qs = params.toString()
      router.replace(qs ? `/knowledge-base?${qs}` : '/knowledge-base', { scroll: false })
    },
    [router]
  )

  const handleSearch = useCallback(
    (query: string) => {
      setActiveQuery(query)
      setActiveCategory('')
      updateUrl(query, '')
    },
    [updateUrl]
  )

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      const next = category ?? ''
      setActiveCategory(next)
      updateUrl(activeQuery, next)
    },
    [activeQuery, updateUrl]
  )

  const handleClearFilters = useCallback(() => {
    setActiveQuery('')
    setActiveCategory('')
    updateUrl('', '')
  }, [updateUrl])

  const hasFilter = activeQuery !== '' || activeCategory !== ''

  return (
    <>
      <KnowledgeBasePageTracker articleCount={totalCount} />
      <div className="max-w-4xl mx-auto mb-4">
        <KBFilterBar
          categories={categories}
          activeCategory={activeCategory || undefined}
          activeQuery={activeQuery || undefined}
          onSearch={handleSearch}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      <p className="text-sm text-slate-500 mb-8 max-w-4xl mx-auto">
        {hasFilter
          ? `Showing ${filteredArticles.length} of ${totalCount} articles`
          : `Showing ${totalCount} articles`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredArticles.map(article => (
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

      {filteredArticles.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">No articles found.</p>
          <button
            onClick={handleClearFilters}
            className="mt-4 inline-block text-primary-600 font-semibold hover:text-primary-700"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  )
}
