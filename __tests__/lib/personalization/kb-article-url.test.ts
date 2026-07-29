import { buildKbArticleUrl, PILLAR_ARTICLE_SLUG } from '@/lib/personalization/kb-article-url'

describe('buildKbArticleUrl', () => {
  const ORIG_APP_URL = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    if (ORIG_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = ORIG_APP_URL
  })

  it('builds a full KB article URL with the state_article UTM tag', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(buildKbArticleUrl('pennsylvania-total-loss-law-explained', 'state_article')).toBe(
      'https://www.totallosstoolkit.com/knowledge-base/pennsylvania-total-loss-law-explained?utm_source=zoho&utm_medium=email&utm_content=state_article'
    )
  })

  it('builds a full KB article URL with the vehicle_guide UTM tag', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(buildKbArticleUrl(PILLAR_ARTICLE_SLUG, 'vehicle_guide')).toBe(
      'https://www.totallosstoolkit.com/knowledge-base/vehicle-owners-guide-to-total-loss?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide'
    )
  })

  it('respects NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.example.com'
    expect(buildKbArticleUrl('ohio-total-loss-law-explained', 'state_article')).toBe(
      'https://preview.example.com/knowledge-base/ohio-total-loss-law-explained?utm_source=zoho&utm_medium=email&utm_content=state_article'
    )
  })
})
