import { deriveCategories, filterArticlesByCategory } from '@/lib/utils/kb-articles'
import type { Article } from '@/lib/knowledge-base-db'

function makeArticle(overrides: Partial<Article>): Article {
  return {
    slug: 'default-slug',
    title: 'Default Title',
    description: 'Default description',
    category: 'Insurance Claims',
    tags: [],
    author: 'Test Author',
    datePublished: '2025-01-01',
    dateModified: '2025-01-01',
    featured: false,
    published: true,
    content: '',
    readingTime: '5 min read',
    ...overrides,
  }
}

describe('deriveCategories', () => {
  it('returns an empty array for an empty article list', () => {
    expect(deriveCategories([])).toEqual([])
  })

  it('counts articles per category', () => {
    const articles = [
      makeArticle({ slug: 'a', category: 'Insurance Claims' }),
      makeArticle({ slug: 'b', category: 'Insurance Claims' }),
      makeArticle({ slug: 'c', category: 'Vehicle Valuation' }),
    ]
    const result = deriveCategories(articles)
    expect(result.find(c => c.name === 'Insurance Claims')?.count).toBe(2)
    expect(result.find(c => c.name === 'Vehicle Valuation')?.count).toBe(1)
  })

  it('sorts categories by count descending', () => {
    const articles = [
      makeArticle({ slug: 'a', category: 'Rare Topic' }),
      makeArticle({ slug: 'b', category: 'Insurance Claims' }),
      makeArticle({ slug: 'c', category: 'Insurance Claims' }),
      makeArticle({ slug: 'd', category: 'Insurance Claims' }),
    ]
    const result = deriveCategories(articles)
    expect(result[0].name).toBe('Insurance Claims')
    expect(result[0].count).toBe(3)
  })
})

describe('filterArticlesByCategory', () => {
  it('returns only articles matching the given category', () => {
    const articles = [
      makeArticle({ slug: 'a', category: 'Insurance Claims' }),
      makeArticle({ slug: 'b', category: 'Vehicle Valuation' }),
      makeArticle({ slug: 'c', category: 'Insurance Claims' }),
    ]
    const result = filterArticlesByCategory(articles, 'Insurance Claims')
    expect(result).toHaveLength(2)
    expect(result.every(a => a.category === 'Insurance Claims')).toBe(true)
  })

  it('returns an empty array when no articles match', () => {
    const articles = [makeArticle({ slug: 'a', category: 'Insurance Claims' })]
    expect(filterArticlesByCategory(articles, 'Nonexistent')).toEqual([])
  })

  it('returns an empty array for an empty input', () => {
    expect(filterArticlesByCategory([], 'Insurance Claims')).toEqual([])
  })
})
