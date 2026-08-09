/**
 * Tests for next.config.ts redirects
 *
 * Regression guard: the "how-to-challenge-insurance-company-vehicle-valuation-
 * complete-guide" KB article was deleted, redirected to /knowledge-base, then
 * re-published (see commit 05d61fb — the redirect was removed because it was
 * intercepting requests to the now-live article). It must not come back
 * unless that article is deleted again.
 * Note: non-www → www redirect is handled by Vercel at domain level, not here.
 */

import nextConfig from '../next.config'

describe('next.config redirects', () => {
  it('does not redirect the re-published KB article away from itself', async () => {
    const redirects = nextConfig.redirects ? await nextConfig.redirects() : []

    const articleRedirect = redirects.find(
      r =>
        r.source ===
        '/knowledge-base/how-to-challenge-insurance-company-vehicle-valuation-complete-guide'
    )

    expect(articleRedirect).toBeUndefined()
  })

  it('does not contain a non-www to www redirect (Vercel handles this)', async () => {
    const redirects = nextConfig.redirects ? await nextConfig.redirects() : []

    const nonWwwRedirect = redirects.find(
      r => r.destination === 'https://www.totallosstoolkit.com/:path*'
    )

    expect(nonWwwRedirect).toBeUndefined()
  })
})
