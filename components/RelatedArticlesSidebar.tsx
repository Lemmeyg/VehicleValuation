import type { Article } from '@/lib/knowledge-base-db'
import { RelatedArticleLink } from './RelatedArticleLink'
import Link from 'next/link'

interface RelatedArticlesSidebarProps {
  relatedArticles: Pick<Article, 'slug' | 'title' | 'category' | 'readingTime'>[]
  currentSlug: string
  categories: { name: string; count: number }[]
  currentCategory: string
}

export function RelatedArticlesSidebar({
  relatedArticles,
  currentSlug,
  categories,
  currentCategory,
}: RelatedArticlesSidebarProps) {
  return (
    <div className="sticky top-28 space-y-8">
      {/* Browse Topics */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Browse Topics
        </p>
        <div className="space-y-1">
          {categories.map(({ name, count }) => (
            <Link
              key={name}
              href={`/knowledge-base?category=${encodeURIComponent(name)}`}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                name === currentCategory
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{name}</span>
              <span
                className={`text-xs ${
                  name === currentCategory ? 'text-primary-400' : 'text-slate-400'
                }`}
              >
                {count}
              </span>
            </Link>
          ))}
          <Link
            href="/knowledge-base"
            className="flex items-center px-3 py-2 text-sm text-primary-600 font-semibold hover:text-primary-700 border-t border-slate-100 mt-1 pt-3"
          >
            ← All Articles
          </Link>
        </div>
      </div>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Related Articles
          </p>
          <div className="space-y-3">
            {relatedArticles.map((article, index) => (
              <RelatedArticleLink
                key={article.slug}
                article={article}
                fromSlug={currentSlug}
                position={index + 1}
                placement="sidebar"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
