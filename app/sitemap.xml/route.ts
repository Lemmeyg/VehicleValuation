import { getAllArticles } from '@/lib/knowledge-base-db'
import { getAllSuppliers } from '@/lib/suppliers-db'

const BASE_URL = 'https://www.totallosstoolkit.com'

const STATIC_PAGES = [
  { url: BASE_URL, changefreq: 'daily', priority: '1.0' },
  { url: `${BASE_URL}/pricing`, changefreq: 'weekly', priority: '0.9' },
  { url: `${BASE_URL}/knowledge-base`, changefreq: 'weekly', priority: '0.9' },
  { url: `${BASE_URL}/directory`, changefreq: 'weekly', priority: '0.8' },
  { url: `${BASE_URL}/guarantee`, changefreq: 'monthly', priority: '0.7' },
  { url: `${BASE_URL}/faq`, changefreq: 'monthly', priority: '0.7' },
  { url: `${BASE_URL}/privacy`, changefreq: 'monthly', priority: '0.4' },
  { url: `${BASE_URL}/terms`, changefreq: 'monthly', priority: '0.4' },
]

function urlEntry(url: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

export async function GET() {
  const now = new Date().toISOString()

  const [articles, suppliers] = await Promise.all([
    getAllArticles(),
    getAllSuppliers().catch(() => []),
  ])

  const staticEntries = STATIC_PAGES.map(p => urlEntry(p.url, now, p.changefreq, p.priority))

  const articleEntries = articles
    .filter(a => a.published)
    .map(a =>
      urlEntry(
        `${BASE_URL}/knowledge-base/${a.slug}`,
        new Date(a.dateModified).toISOString(),
        'monthly',
        a.featured ? '0.9' : '0.7'
      )
    )

  const supplierEntries = suppliers
    .filter(s => s.published)
    .map(s =>
      urlEntry(`${BASE_URL}/directory/${s.slug}`, now, 'monthly', s.featured ? '0.8' : '0.6')
    )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...articleEntries, ...supplierEntries].join('\n')}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
