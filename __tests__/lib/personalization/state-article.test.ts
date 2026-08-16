import { resolveStateArticle, getStateCodeByName } from '@/lib/personalization/state-article'
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

  it('resolves Vermont to its article slug', () => {
    expect(resolveStateArticle('VT')).toEqual({
      stateName: 'Vermont',
      slug: 'vermont-total-loss-law-explained',
    })
  })

  it('resolves Wyoming to its article slug', () => {
    expect(resolveStateArticle('WY')).toEqual({
      stateName: 'Wyoming',
      slug: 'wyoming-total-loss-law-explained',
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

describe('getStateCodeByName', () => {
  it('resolves a single-word state name to its code', () => {
    expect(getStateCodeByName('Pennsylvania')).toBe('PA')
  })

  it('resolves a two-word state name to its code', () => {
    expect(getStateCodeByName('New Mexico')).toBe('NM')
  })

  it('returns null for a name with no matching code (e.g. District of Columbia)', () => {
    expect(getStateCodeByName('District of Columbia')).toBeNull()
  })

  it('is the exact inverse of resolveStateArticle for every mapped state', () => {
    const codes = ['PA', 'CA', 'NY', 'FL', 'MD', 'WY', 'VT']
    for (const code of codes) {
      const { stateName } = resolveStateArticle(code)
      expect(getStateCodeByName(stateName)).toBe(code)
    }
  })
})
