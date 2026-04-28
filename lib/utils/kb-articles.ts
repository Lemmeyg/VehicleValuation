import type { Article } from '@/lib/knowledge-base-db'

export function deriveCategories(articles: Article[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function filterArticlesByCategory(articles: Article[], category: string): Article[] {
  return articles.filter(a => a.category === category)
}
