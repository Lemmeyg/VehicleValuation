import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * Check Email for Existing User Endpoint
 *
 * Checks if an email address already exists in Supabase Auth.
 * Used in hero form to determine if user should login or signup.
 *
 * POST /api/reports/check-email
 * Body: { email }
 *
 * Returns:
 * - hasUser: boolean (true if user exists in Supabase Auth)
 * - hasReports: boolean (true if email has any reports)
 * - reportCount: number (total reports for this email)
 */

interface CheckEmailRequest {
  email: string
}

export async function POST(request: Request) {
  try {
    const body: CheckEmailRequest = await request.json()
    const { email } = body

    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email?.toLowerCase().trim()

    console.log('[check-email] Checking email:', normalizedEmail)

    // Validate email
    if (!normalizedEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // FIRST: Check if user exists in Supabase Auth (primary check)
    // This determines whether user should login or signup
    let hasUser = false
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()

      if (!authError && authData?.users) {
        hasUser = authData.users.some(user => user.email?.toLowerCase() === normalizedEmail)
      }
    } catch (authCheckError) {
      console.error('[check-email] Error checking auth status:', authCheckError)
      return NextResponse.json(
        { error: 'Failed to check user authentication status' },
        { status: 500 }
      )
    }

    console.log('[check-email] User exists in auth:', hasUser)

    // SECOND: Check if email has any reports in the database (optional info)
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('id, user_id, created_at')
      .ilike('email', normalizedEmail)
      .order('created_at', { ascending: false })

    if (reportsError) {
      console.error('[check-email] Error checking reports:', reportsError)
      // Don't fail the request - reports check is secondary
    }

    const hasReports = reports && reports.length > 0
    const reportCount = reports?.length || 0

    console.log('[check-email] Found reports:', {
      email: normalizedEmail,
      hasReports,
      reportCount,
      reportIds: reports?.map(r => r.id)
    })

    return NextResponse.json({
      success: true,
      hasUser,
      hasReports,
      reportCount,
      message: hasUser
        ? 'User account exists - please login'
        : 'New user - please create account',
    })

  } catch (error) {
    console.error('[check-email] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
