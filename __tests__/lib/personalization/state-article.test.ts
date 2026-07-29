import { resolveStateArticle } from '@/lib/personalization/state-article'
import { PILLAR_ARTICLE_SLUG } from '@/lib/personalization/kb-article-url'

describe('resolveStateArticle', () => {
  it('resolves a standard state to its name and article slug', () => {
    expect(resolveStateArticle('PA')).toEqual({
      stateName: 'Pennsylvania',
      slug: 'pennsylvania-total-loss-law-explained',
    })
  })

  it('resolves Florida to its deviating slug pattern', () => {
    expect(resolveStateArticle('FL')).toEqual({
      stateName: 'Florida',
      slug: 'florida-total-loss-state-law-explained',
    })
  })

  it('resolves Maryland to its deviating slug pattern', () => {
    expect(resolveStateArticle('MD')).toEqual({
      stateName: 'Maryland',
      slug: 'maryland-total-loss-state-rules-explained',
    })
  })

  it('resolves Rhode Island to the general explainer', () => {
    expect(resolveStateArticle('RI')).toEqual({
      stateName: 'Rhode Island',
      slug: 'rhode-island-total-loss-law-explained',
    })
  })

  it('falls back to the pillar article for a state with no dedicated article yet (Vermont)', () => {
    expect(resolveStateArticle('VT')).toEqual({
      stateName: 'your state',
      slug: PILLAR_ARTICLE_SLUG,
    })
  })

  it('falls back to the pillar article for a state with no dedicated article yet (Wyoming)', () => {
    expect(resolveStateArticle('WY')).toEqual({
      stateName: 'your state',
      slug: PILLAR_ARTICLE_SLUG,
    })
  })

  it('falls back to the pillar article for an unrecognized code (DC, territory, bad data)', () => {
    expect(resolveStateArticle('DC')).toEqual({
      stateName: 'your state',
      slug: PILLAR_ARTICLE_SLUG,
    })
  })

  it('falls back to the pillar article for null (missing/unmapped ZIP)', () => {
    expect(resolveStateArticle(null)).toEqual({
      stateName: 'your state',
      slug: PILLAR_ARTICLE_SLUG,
    })
  })
})
