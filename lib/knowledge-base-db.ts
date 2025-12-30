/**
 * Knowledge Base - Database Version
 *
 * Reads articles from Supabase database instead of markdown files
 * This version works with Netlify and other static hosting platforms
 */

import { createServerSupabaseClient, supabase } from './db/supabase'
import { markdownToHtml } from './markdown'

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

/**
 * Get all articles from database
 */
export async function getAllArticles(): Promise<Article[]> {
  const supabase = await createServerSupabaseClient()

  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .order('date_published', { ascending: false })

  if (error) {
    console.error('Error fetching articles:', error)
    return []
  }

  if (!articles || articles.length === 0) {
    return []
  }

  // Transform database format to Article interface
  const transformedArticles: Article[] = articles.map(article => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags || [],
    author: article.author,
    datePublished: article.date_published,
    dateModified: article.date_modified,
    featured: article.featured || false,
    published: article.published !== false,
    content: article.content,
    readingTime: article.reading_time || '5 min read',
  }))

  // Filter unpublished in production
  const filtered =
    process.env.NODE_ENV === 'production'
      ? transformedArticles.filter(a => a.published)
      : transformedArticles

  return filtered
}

/**
 * Get article by slug from database
 */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = await createServerSupabaseClient()

  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !article) {
    console.error('Error fetching article:', error)
    return null
  }

  // Transform to Article interface
  const transformedArticle: Article = {
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags || [],
    author: article.author,
    datePublished: article.date_published,
    dateModified: article.date_modified,
    featured: article.featured || false,
    published: article.published !== false,
    content: article.content,
    readingTime: article.reading_time || '5 min read',
  }

  // Convert markdown to HTML
  transformedArticle.htmlContent = await markdownToHtml(transformedArticle.content)

  return transformedArticle
}

/**
 * Search articles by keyword
 */
export async function searchArticles(query: string): Promise<Article[]> {
  const supabase = await createServerSupabaseClient()

  const { data: results, error } = await supabase.rpc('search_articles', {
    search_query: query,
  })

  if (error || !results) {
    console.error('Error searching articles:', error)
    return []
  }

  // Transform results to Article interface
  return results.map((result: any) => ({
    slug: result.slug,
    title: result.title,
    description: result.description,
    category: result.category,
    tags: [],
    author: '',
    datePublished: result.date_published,
    dateModified: result.date_published,
    featured: false,
    published: true,
    content: '',
    readingTime: result.reading_time || '5 min read',
  }))
}

/**
 * Get articles by category
 */
export async function getArticlesByCategory(category: string): Promise<Article[]> {
  const supabase = await createServerSupabaseClient()

  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('category', category)
    .eq('published', true)
    .order('date_published', { ascending: false })

  if (error || !articles) {
    console.error('Error fetching articles by category:', error)
    return []
  }

  return articles.map(article => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags || [],
    author: article.author,
    datePublished: article.date_published,
    dateModified: article.date_modified,
    featured: article.featured || false,
    published: article.published !== false,
    content: article.content,
    readingTime: article.reading_time || '5 min read',
  }))
}

/**
 * Get featured articles
 */
export async function getFeaturedArticles(limit: number = 3): Promise<Article[]> {
  const supabase = await createServerSupabaseClient()

  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('featured', true)
    .eq('published', true)
    .order('date_published', { ascending: false })
    .limit(limit)

  if (error || !articles) {
    console.error('Error fetching featured articles:', error)
    return []
  }

  return articles.map(article => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags || [],
    author: article.author,
    datePublished: article.date_published,
    dateModified: article.date_modified,
    featured: article.featured || false,
    published: article.published !== false,
    content: article.content,
    readingTime: article.reading_time || '5 min read',
  }))
}

// ============================================================================
// STATIC GENERATION HELPERS
// These functions use the simple supabase client (no cookies)
// Safe to use in generateStaticParams and other build-time functions
// ============================================================================

/**
 * Get all article slugs for static generation
 * Uses simple client (no cookies) - safe for generateStaticParams
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('slug')
    .eq('published', true)

  if (error || !articles) {
    console.error('Error fetching article slugs:', error)
    return []
  }

  return articles.map(article => article.slug)
}

/**
 * Get article by slug for static generation
 * Uses simple client (no cookies) - safe for generateMetadata
 */
export async function getArticleBySlugStatic(slug: string): Promise<Article | null> {
  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !article) {
    console.error('Error fetching article:', error)
    return null
  }

  // Transform to Article interface
  const transformedArticle: Article = {
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags || [],
    author: article.author,
    datePublished: article.date_published,
    dateModified: article.date_modified,
    featured: article.featured || false,
    published: article.published !== false,
    content: article.content,
    readingTime: article.reading_time || '5 min read',
  }

  // Convert markdown to HTML
  transformedArticle.htmlContent = await markdownToHtml(transformedArticle.content)

  return transformedArticle
}
