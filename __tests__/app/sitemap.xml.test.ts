/**
 * @jest-environment node
 *
 * Tests for the sitemap XML Route Handler
 *
 * Verifies correct content-type, valid XML structure,
 * and inclusion/exclusion of expected URLs.
 *
 * Uses node environment (not jsdom) because Response is a Node.js 18+ built-in
 * and Next.js Route Handlers run in a Node.js context.
 */

jest.mock('@/lib/knowledge-base-db', () => ({
  getAllArticles: jest.fn(),
}))

jest.mock('@/lib/suppliers-db', () => ({
  getAllSuppliers: jest.fn(),
}))

import { getAllArticles } from '@/lib/knowledge-base-db'
import { getAllSuppliers } from '@/lib/suppliers-db'
import { GET } from '@/app/sitemap.xml/route'

const mockArticles = [
  {
    slug: 'test-article',
    dateModified: '2026-01-01',
    featured: false,
    published: true,
  },
  {
    slug: 'featured-article',
    dateModified: '2026-02-01',
    featured: true,
    published: true,
  },
  {
    slug: 'unpublished-article',
    dateModified: '2026-02-01',
    featured: false,
    published: false,
  },
]

const mockSuppliers = [
  { slug: 'test-supplier', featured: false, published: true },
  { slug: 'featured-supplier', featured: true, published: true },
  { slug: 'unpublished-supplier', featured: false, published: false },
]

beforeEach(() => {
  ;(getAllArticles as jest.Mock).mockResolvedValue(mockArticles)
  ;(getAllSuppliers as jest.Mock).mockResolvedValue(mockSuppliers)
})

describe('GET /sitemap.xml', () => {
  it('returns Content-Type application/xml with UTF-8 charset', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toBe('application/xml; charset=UTF-8')
  })

  it('returns 200 status', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('starts with XML declaration', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text.trim()).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('includes urlset with sitemap namespace', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  })

  it('includes core static pages', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).toContain('<loc>https://www.totallosstoolkit.com</loc>')
    expect(text).toContain('<loc>https://www.totallosstoolkit.com/pricing</loc>')
    expect(text).toContain('<loc>https://www.totallosstoolkit.com/knowledge-base</loc>')
    expect(text).toContain('<loc>https://www.totallosstoolkit.com/directory</loc>')
  })

  it('does NOT include /login or /signup', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).not.toContain('/login')
    expect(text).not.toContain('/signup')
  })

  it('includes published articles with correct URLs', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).toContain(
      '<loc>https://www.totallosstoolkit.com/knowledge-base/test-article</loc>'
    )
    expect(text).toContain(
      '<loc>https://www.totallosstoolkit.com/knowledge-base/featured-article</loc>'
    )
  })

  it('excludes unpublished articles', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).not.toContain('unpublished-article')
  })

  it('includes published suppliers', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).toContain('<loc>https://www.totallosstoolkit.com/directory/test-supplier</loc>')
    expect(text).toContain(
      '<loc>https://www.totallosstoolkit.com/directory/featured-supplier</loc>'
    )
  })

  it('excludes unpublished suppliers', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).not.toContain('unpublished-supplier')
  })

  it('gracefully handles supplier fetch failure', async () => {
    ;(getAllSuppliers as jest.Mock).mockRejectedValue(new Error('DB error'))
    const response = await GET()
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('<loc>https://www.totallosstoolkit.com</loc>')
  })

  it('sets cache-control header', async () => {
    const response = await GET()
    expect(response.headers.get('cache-control')).toBeTruthy()
  })
})
