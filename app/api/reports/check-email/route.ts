import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * Check Email for Existing Reports Endpoint
 *
 * Checks if an email address already has reports in the system.
 * Used in hero form to determine if user should login or proceed with new report.
 *
 * POST /api/reports/check-email
 * Body: { email }
 *
 * Returns:
 * - hasReports: boolean (true if email has any reports)
 * - reportCount: number (total reports for this email)
 * - hasUser: boolean (true if user exists in Supabase Auth)
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

    // Check if email has any reports in the database (case-insensitive)
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('id, user_id, created_at')
      .ilike('email', normalizedEmail)
      .order('created_at', { ascending: false })

    if (reportsError) {
      console.error('[check-email] Error checking reports:', reportsError)
      return NextResponse.json(
        { error: 'Failed to check email' },
        { status: 500 }
      )
    }

    const hasReports = reports && reports.length > 0
    const reportCount = reports?.length || 0

    console.log('[check-email] Found reports:', {
      email: normalizedEmail,
      hasReports,
      reportCount,
      reportIds: reports?.map(r => r.id)
    })

    // Check if user exists in Supabase Auth
    // We'll check by trying to list users with this email (admin only operation)
    let hasUser = false
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()

      if (!authError && authData?.users) {
        hasUser = authData.users.some(user => user.email?.toLowerCase() === normalizedEmail)
      }
    } catch (authCheckError) {
      console.warn('[check-email] Could not check auth status:', authCheckError)
      // Continue without auth check - we'll rely on reports check
    }

    console.log('[check-email] User exists in auth:', hasUser)

    return NextResponse.json({
      success: true,
      hasReports,
      reportCount,
      hasUser,
      message: hasReports
        ? 'Email has existing reports'
        : 'Email is new to the system',
    })

  } catch (error) {
    console.error('[check-email] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
