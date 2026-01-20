import { getAllArticles } from '@/lib/knowledge-base-db'
import { getAllSuppliers } from '@/lib/suppliers-db'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vehiclevaluationauthority.com'

  // Fetch dynamic content
  const [articles, suppliers] = await Promise.all([
    getAllArticles(),
    getAllSuppliers().catch(() => []), // Gracefully handle if suppliers fail
  ])

  // Knowledge base article pages
  const articleSitemaps = articles.map(article => ({
    url: `${baseUrl}/knowledge-base/${article.slug}`,
    lastModified: new Date(article.dateModified),
    changeFrequency: 'monthly' as const,
    priority: article.featured ? 0.9 : 0.7,
  }))

  // Supplier directory pages
  const supplierSitemaps = suppliers
    .filter(supplier => supplier.published)
    .map(supplier => ({
      url: `${baseUrl}/directory/${supplier.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: supplier.featured ? 0.8 : 0.6,
    }))

  return [
    // Core pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/knowledge-base`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/directory`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guarantee`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Legal pages
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    // Auth pages (lower priority for SEO)
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // Dynamic content
    ...articleSitemaps,
    ...supplierSitemaps,
  ]
}
