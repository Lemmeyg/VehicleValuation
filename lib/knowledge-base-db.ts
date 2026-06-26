/**
 * Knowledge Base - Database Version
 *
 * Reads articles from Supabase database instead of markdown files
 * This version works with Netlify and other static hosting platforms
 */

import { createServerSupabaseClient, supabase } from './db/supabase'
import { markdownToHtml } from './markdown'
import { unstable_cache } from 'next/cache'

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

export type ArticleListItem = Omit<Article, 'content' | 'htmlContent'>

const ARTICLE_LIST_SELECT =
  'slug, title, description, category, tags, author, date_published, date_modified, featured, published, reading_time'

// Uses plain supabase anon client (not createServerSupabaseClient) — unstable_cache
// persists across requests and cannot hold request-scoped cookie state.
export const getArticleListMetadata = unstable_cache(
  async (): Promise<ArticleListItem[]> => {
    const { data: articles, error } = await supabase
      .from('articles')
      .select(ARTICLE_LIST_SELECT)
      .eq('published', true)
      .order('date_published', { ascending: false })

    if (error || !articles) {
      console.error('Error fetching article list metadata:', error)
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
      published: true,
      readingTime: article.reading_time || '5 min read',
    }))
  },
  ['article-list-metadata'],
  { revalidate: 3600, tags: ['article-list-metadata'] }
)

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
 * Get article metadata only (no HTML conversion) — safe for Edge Runtime.
 * Use this in opengraph-image routes which only need title/category.
 */
export async function getArticleMetaBySlug(
  slug: string
): Promise<Pick<Article, 'slug' | 'title' | 'category' | 'description'> | null> {
  const { data: article, error } = await supabase
    .from('articles')
    .select('slug, title, category, description')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !article) {
    return null
  }

  return {
    slug: article.slug,
    title: article.title,
    category: article.category,
    description: article.description,
  }
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
  return results.map((result: Record<string, unknown>) => ({
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
export async function getArticlesByCategory(category: string): Promise<ArticleListItem[]> {
  const supabase = await createServerSupabaseClient()

  const { data: articles, error } = await supabase
    .from('articles')
    .select(ARTICLE_LIST_SELECT)
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
    published: true,
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
// Internal cached fetch — unstable_cache uses key + args as the cache key,
// so each slug gets its own cache entry.
const _getCachedArticleBySlug = unstable_cache(
  async (slug: string): Promise<Article | null> => {
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

    transformedArticle.htmlContent = await markdownToHtml(transformedArticle.content)
    return transformedArticle
  },
  ['article-by-slug'],
  { revalidate: 3600, tags: ['articles'] }
)

export function getArticleBySlugStatic(slug: string): Promise<Article | null> {
  return _getCachedArticleBySlug(slug)
}
