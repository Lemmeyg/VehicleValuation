import { getAllArticles } from '@/lib/knowledge-base-db'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getAllArticles()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vehiclevaluationauthority.com'

  const articleSitemaps = articles.map(article => ({
    url: `${baseUrl}/knowledge-base/${article.slug}`,
    lastModified: new Date(article.dateModified),
    changeFrequency: 'monthly' as const,
    priority: article.featured ? 0.9 : 0.7,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/knowledge-base`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...articleSitemaps,
  ]
}
