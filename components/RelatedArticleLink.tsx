'use client'

import Link from 'next/link'
import { Clock, ArrowRight } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/events'
import type { Article } from '@/lib/knowledge-base-db'

interface RelatedArticleLinkProps {
  article: Pick<Article, 'slug' | 'title' | 'category' | 'readingTime'>
  fromSlug: string
  position: number
  placement: 'sidebar' | 'mobile_inline'
}

export function RelatedArticleLink({
  article,
  fromSlug,
  position,
  placement,
}: RelatedArticleLinkProps) {
  function handleClick() {
    trackEvent('kb_related_article_clicked', {
      from_slug: fromSlug,
      to_slug: article.slug,
      position,
      placement,
    })
  }

  return (
    <Link
      href={`/knowledge-base/${article.slug}`}
      onClick={handleClick}
      className="block p-4 rounded-xl border border-slate-100 hover:border-primary-200 hover:shadow-md transition-all group bg-white"
    >
      <span className="inline-block px-2 py-0.5 text-xs font-semibold text-primary-600 bg-primary-50 rounded-full mb-2">
        {article.category}
      </span>
      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 transition-colors leading-snug mb-3">
        {article.title}
      </h3>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {article.readingTime}
        </span>
        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}
