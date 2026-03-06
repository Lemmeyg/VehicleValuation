import type { Article } from '@/lib/knowledge-base-db'

/**
 * Returns up to `limit` related articles for the given slug.
 *
 * Scoring:
 *   +6  same category
 *   +2  per shared tag
 *
 * Ties broken by datePublished descending (newest first).
 * Falls back to most recently published zero-score articles to fill remaining slots.
 */
export function getRelatedArticles(
  currentSlug: string,
  allArticles: Article[],
  limit: number = 3
): Article[] {
  const current = allArticles.find(a => a.slug === currentSlug)
  if (!current) return []

  const others = allArticles.filter(a => a.slug !== currentSlug)

  const scored = others.map(article => {
    let score = 0
    if (article.category === current.category) score += 6
    const sharedTags = article.tags.filter(tag => current.tags.includes(tag))
    score += sharedTags.length * 2
    return { article, score }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.article.datePublished).getTime() - new Date(a.article.datePublished).getTime()
  })

  const positive = scored
    .filter(s => s.score > 0)
    .slice(0, limit)
    .map(s => s.article)

  if (positive.length < limit) {
    const fallback = scored
      .filter(s => s.score === 0)
      .slice(0, limit - positive.length)
      .map(s => s.article)
    return [...positive, ...fallback]
  }

  return positive
}
