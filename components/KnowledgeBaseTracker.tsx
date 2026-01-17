'use client'

import { useEffect } from 'react'
import { trackKnowledgeBasePageView, trackArticleClick } from '@/lib/analytics/events'

interface Article {
  slug: string
  title: string
  category: string
}

interface KnowledgeBaseTrackerProps {
  articleCount: number
}

export function KnowledgeBasePageTracker({ articleCount }: KnowledgeBaseTrackerProps) {
  useEffect(() => {
    trackKnowledgeBasePageView({ articleCount })
  }, [articleCount])

  return null
}

interface ArticleLinkTrackerProps {
  article: Article
  children: React.ReactNode
  className?: string
}

export function ArticleLinkTracker({ article, children, className }: ArticleLinkTrackerProps) {
  const handleClick = () => {
    trackArticleClick({
      articleSlug: article.slug,
      articleTitle: article.title,
      articleCategory: article.category,
      source: 'knowledge_base_page',
    })
  }

  return (
    <div onClick={handleClick} className={className}>
      {children}
    </div>
  )
}
