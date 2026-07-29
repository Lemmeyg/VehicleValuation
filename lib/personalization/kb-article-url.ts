export const PILLAR_ARTICLE_SLUG = 'vehicle-owners-guide-to-total-loss'

export function buildKbArticleUrl(slug: string, utmContent: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.totallosstoolkit.com'
  return `${siteUrl}/knowledge-base/${slug}?utm_source=zoho&utm_medium=email&utm_content=${utmContent}`
}
