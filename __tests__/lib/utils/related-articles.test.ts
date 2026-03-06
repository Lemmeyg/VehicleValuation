import { getRelatedArticles } from '@/lib/utils/related-articles'
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

const current = makeArticle({
  slug: 'current-article',
  category: 'Insurance Claims',
  tags: ['total loss', 'insurance dispute', 'valuation'],
  datePublished: '2025-06-01',
})

describe('getRelatedArticles', () => {
  it('excludes the current article from results', () => {
    const all = [
      current,
      makeArticle({ slug: 'other-1', category: 'Insurance Claims', tags: ['total loss'] }),
    ]
    const result = getRelatedArticles('current-article', all)
    expect(result.find(a => a.slug === 'current-article')).toBeUndefined()
  })

  it('returns at most 3 articles', () => {
    const all = [
      current,
      makeArticle({ slug: 'a', category: 'Insurance Claims', tags: ['total loss'] }),
      makeArticle({ slug: 'b', category: 'Insurance Claims', tags: ['valuation'] }),
      makeArticle({ slug: 'c', category: 'Insurance Claims', tags: ['insurance dispute'] }),
      makeArticle({ slug: 'd', category: 'Auto Insurance', tags: [] }),
    ]
    expect(getRelatedArticles('current-article', all).length).toBe(3)
  })

  it('ranks same-category articles above different-category articles with no shared tags', () => {
    const all = [
      current,
      makeArticle({ slug: 'same-cat', category: 'Insurance Claims', tags: [] }),
      makeArticle({ slug: 'diff-cat', category: 'Auto Insurance', tags: [] }),
    ]
    const result = getRelatedArticles('current-article', all)
    expect(result[0].slug).toBe('same-cat')
  })

  it('ranks a different-category article above same-category when it has more shared tags', () => {
    // diff-cat gets 2*4=8 pts; same-cat gets 6+0=6 pts
    const currentWith4Tags = makeArticle({
      slug: 'current-article',
      category: 'Insurance Claims',
      tags: ['total loss', 'insurance dispute', 'valuation', 'settlement'],
      datePublished: '2025-06-01',
    })
    const all = [
      currentWith4Tags,
      makeArticle({ slug: 'same-cat', category: 'Insurance Claims', tags: [] }),
      makeArticle({
        slug: 'diff-cat',
        category: 'Auto Insurance',
        tags: ['total loss', 'insurance dispute', 'valuation', 'settlement'],
      }),
    ]
    const result = getRelatedArticles('current-article', all)
    expect(result[0].slug).toBe('diff-cat')
  })

  it('breaks ties by datePublished descending (newest first)', () => {
    const all = [
      current,
      makeArticle({
        slug: 'older',
        category: 'Insurance Claims',
        tags: [],
        datePublished: '2024-01-01',
      }),
      makeArticle({
        slug: 'newer',
        category: 'Insurance Claims',
        tags: [],
        datePublished: '2025-01-01',
      }),
    ]
    const result = getRelatedArticles('current-article', all)
    expect(result[0].slug).toBe('newer')
  })

  it('fills remaining slots with zero-score articles when fewer than 3 score above zero', () => {
    const all = [
      current,
      makeArticle({ slug: 'scoring', category: 'Insurance Claims', tags: [] }), // 6 pts
      makeArticle({
        slug: 'fallback-1',
        category: 'Auto Insurance',
        tags: [],
        datePublished: '2025-02-01',
      }),
      makeArticle({
        slug: 'fallback-2',
        category: 'Auto Insurance',
        tags: [],
        datePublished: '2025-01-01',
      }),
    ]
    const result = getRelatedArticles('current-article', all)
    expect(result.length).toBe(3)
    expect(result[0].slug).toBe('scoring')
    expect(result.map(a => a.slug)).toContain('fallback-1')
    expect(result.map(a => a.slug)).toContain('fallback-2')
  })

  it('returns empty array when current slug is not found in allArticles', () => {
    const all = [makeArticle({ slug: 'some-article' })]
    expect(getRelatedArticles('does-not-exist', all)).toEqual([])
  })

  it('respects a custom limit parameter', () => {
    const all = [
      current,
      makeArticle({ slug: 'a', category: 'Insurance Claims', tags: ['total loss'] }),
      makeArticle({ slug: 'b', category: 'Insurance Claims', tags: ['valuation'] }),
      makeArticle({ slug: 'c', category: 'Insurance Claims', tags: ['insurance dispute'] }),
    ]
    expect(getRelatedArticles('current-article', all, 2).length).toBe(2)
    expect(getRelatedArticles('current-article', all, 1).length).toBe(1)
  })
})
