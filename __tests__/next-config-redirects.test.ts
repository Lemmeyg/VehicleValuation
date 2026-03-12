/**
 * Tests for next.config.ts redirects
 *
 * Verifies targeted redirects for removed pages.
 * Note: non-www → www redirect is handled by Vercel at domain level, not here.
 */

import nextConfig from '../next.config'

describe('next.config redirects', () => {
  it('exports a redirects function', () => {
    expect(typeof nextConfig.redirects).toBe('function')
  })

  it('redirects deleted KB article to /knowledge-base with 301', async () => {
    const redirects = await nextConfig.redirects!()

    const articleRedirect = redirects.find(
      r =>
        r.source ===
        '/knowledge-base/how-to-challenge-insurance-company-vehicle-valuation-complete-guide'
    )

    expect(articleRedirect).toBeDefined()
    expect(articleRedirect?.destination).toBe('/knowledge-base')
    expect(articleRedirect?.permanent).toBe(true)
  })

  it('does not contain a non-www to www redirect (Vercel handles this)', async () => {
    const redirects = await nextConfig.redirects!()

    const nonWwwRedirect = redirects.find(
      r => r.destination === 'https://www.totallosstoolkit.com/:path*'
    )

    expect(nonWwwRedirect).toBeUndefined()
  })
})
