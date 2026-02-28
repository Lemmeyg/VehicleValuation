/**
 * Tests for next.config.ts redirects
 *
 * Verifies that non-www requests are permanently redirected to www
 * to consolidate SEO authority onto a single canonical domain.
 */

import nextConfig from '../next.config'

describe('next.config redirects — canonical domain', () => {
  it('exports a redirects function', () => {
    expect(typeof nextConfig.redirects).toBe('function')
  })

  it('permanently redirects non-www to www', async () => {
    const redirects = await nextConfig.redirects!()

    const wwwRedirect = redirects.find(
      r => r.destination === 'https://www.totallosstoolkit.com/:path*' && r.permanent === true
    )

    expect(wwwRedirect).toBeDefined()
  })

  it('redirect applies only to the non-www host', async () => {
    const redirects = await nextConfig.redirects!()

    const wwwRedirect = redirects.find(
      r => r.destination === 'https://www.totallosstoolkit.com/:path*'
    )

    expect(wwwRedirect?.has).toContainEqual({ type: 'host', value: 'totallosstoolkit.com' })
  })
})
