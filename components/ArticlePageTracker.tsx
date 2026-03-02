'use client'

import { useEffect } from 'react'
import { trackArticleView } from '@/lib/analytics/events'
import { setKBAttribution } from '@/lib/analytics/kb-attribution'

interface ArticlePageTrackerProps {
  slug: string
  title: string
  category: string
}

export function ArticlePageTracker({ slug, title, category }: ArticlePageTrackerProps) {
  useEffect(() => {
    trackArticleView({
      articleSlug: slug,
      articleTitle: title,
      articleCategory: category,
      source: 'direct',
    })
    setKBAttribution(slug, title)
  }, [slug, title, category])

  return null
}
