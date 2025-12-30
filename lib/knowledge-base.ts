import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import { markdownToHtml } from './markdown'

const CONTENT_DIR = path.join(process.cwd(), 'content/knowledge-base')

export interface Article {
  slug: string
  title: string
  description: string
  category: string
  tags: string[]
  author: string
  datePublished: string
  dateModified: string
  featured: boolean
  published: boolean
  content: string
  htmlContent?: string
  readingTime: string
}

export async function getAllArticles(): Promise<Article[]> {
  const categories = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  const articles: Article[] = []

  for (const category of categories) {
    const categoryPath = path.join(CONTENT_DIR, category)
    const files = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.md') && file !== '_template.md')

    for (const file of files) {
      const filePath = path.join(categoryPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(fileContent)

      articles.push({
        slug: data.slug,
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        author: data.author,
        datePublished: data.datePublished,
        dateModified: data.dateModified,
        featured: data.featured || false,
        published: data.published !== false,
        content,
        readingTime: readingTime(content).text,
      })
    }
  }

  // Filter unpublished in production
  const filtered = process.env.NODE_ENV === 'production'
    ? articles.filter(a => a.published)
    : articles

  return filtered.sort((a, b) =>
    new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime()
  )
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const articles = await getAllArticles()
  const article = articles.find(a => a.slug === slug)

  if (!article) return null

  article.htmlContent = await markdownToHtml(article.content)

  return article
}
