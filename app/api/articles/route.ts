/**
 * API Route: GET /api/articles
 *
 * Fetches articles from database with optional filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllArticles } from '@/lib/knowledge-base-db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    // Fetch all published articles
    let articles = await getAllArticles()

    // Apply limit if specified
    if (limit) {
      articles = articles.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      articles,
      count: articles.length,
    })
  } catch (error) {
    console.error('Error fetching articles:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch articles',
      },
      { status: 500 }
    )
  }
}
