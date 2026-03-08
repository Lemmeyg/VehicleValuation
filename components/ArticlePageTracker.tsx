'use client'

import { useEffect } from 'react'
import { trackArticleView, trackEvent } from '@/lib/analytics/events'
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

  useEffect(() => {
    const milestonesFired = new Set<number>()

    const handleScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable <= 0) return

      const pct = Math.round((window.scrollY / scrollable) * 100)

      if (pct >= 50 && !milestonesFired.has(50)) {
        milestonesFired.add(50)
        trackEvent('kb_article_scrolled', { article_slug: slug, depth: 50 })
      }
      if (pct >= 100 && !milestonesFired.has(100)) {
        milestonesFired.add(100)
        trackEvent('kb_article_scrolled', { article_slug: slug, depth: 100 })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [slug])

  return null
}
