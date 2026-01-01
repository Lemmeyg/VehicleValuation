import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/db/auth'
import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'

/**
 * GET /api/reports/[id]
 *
 * Retrieves a report by ID with ownership verification.
 * Only the report owner can access their own reports.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing report ID
 * @returns Report data or error response
 *
 * Security:
 * - Requires authentication
 * - Enforces ownership check (user_id match)
 *
 * Used by:
 * - Pricing page to display MarketCheck preview data
 * - Report details page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const user = await requireAuth()
    const { id: reportId } = await params

    // Fetch report from database with ownership check
    const supabase = await createRouteHandlerSupabaseClient()
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id) // SECURITY: Only allow access to own reports
      .single()

    if (error || !report) {
      return NextResponse.json(
        { error: 'Report not found or access denied' },
        { status: 404 }
      )
    }

    // Return report data
    return NextResponse.json({ report })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle unexpected errors
    console.error('Error fetching report:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
