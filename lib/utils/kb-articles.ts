import type { ArticleListItem } from '@/lib/knowledge-base-db'

export type CategoryCount = { name: string; count: number }

export function deriveCategories(articles: ArticleListItem[]): CategoryCount[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function filterArticlesByCategory(
  articles: ArticleListItem[],
  category: string
): ArticleListItem[] {
  return articles.filter(a => a.category === category)
}
