import type { Article } from '@/lib/knowledge-base-db'
import { RelatedArticleLink } from './RelatedArticleLink'

interface RelatedArticlesMobileProps {
  relatedArticles: Pick<Article, 'slug' | 'title' | 'category' | 'readingTime'>[]
  currentSlug: string
}

export function RelatedArticlesMobile({
  relatedArticles,
  currentSlug,
}: RelatedArticlesMobileProps) {
  if (relatedArticles.length === 0) return null

  return (
    <div className="mt-12 lg:hidden">
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
            placement="mobile_inline"
          />
        ))}
      </div>
    </div>
  )
}
