import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * Link Reports API Endpoint
 *
 * Links anonymous reports to authenticated user accounts
 *
 * POST /api/reports/link
 * Body: { userId, email }
 */

interface LinkReportsRequest {
  userId: string
  email: string
}

export async function POST(request: Request) {
  try {
    const body: LinkReportsRequest = await request.json()
    const { userId, email } = body

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email?.toLowerCase().trim()

    // Validate inputs
    if (!userId || !normalizedEmail) {
      console.error('[link-reports] Missing required fields:', { userId: !!userId, email: !!normalizedEmail })
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
      )
    }

    console.log(`[link-reports] Linking reports for ${normalizedEmail} to user ${userId}`)

    // First, check if there are any reports with this email (case-insensitive)
    const { data: existingReports, error: checkError } = await supabaseAdmin
      .from('reports')
      .select('id, email, user_id, created_at')
      .ilike('email', normalizedEmail)
      .order('created_at', { ascending: false })

    if (checkError) {
      console.error('[link-reports] Error checking for existing reports:', checkError)
      return NextResponse.json(
        { error: 'Failed to check for existing reports' },
        { status: 500 }
      )
    }

    console.log('[link-reports] Found reports with email:', existingReports?.length || 0)
    if (existingReports && existingReports.length > 0) {
      console.log('[link-reports] Report details:', existingReports.map(r => ({
        id: r.id,
        email: r.email,
        user_id: r.user_id,
        is_anonymous: r.user_id === null,
        created_at: r.created_at
      })))
    }

    // Link all anonymous reports with this email to the user
    console.log('[link-reports] Attempting to link anonymous reports (user_id is null) to user:', userId)

    const { data: updatedReports, error: linkError } = await supabaseAdmin
      .from('reports')
      .update({ user_id: userId })
      .ilike('email', normalizedEmail)
      .is('user_id', null) // Only update reports that are still anonymous
      .select()

    if (linkError) {
      console.error('[link-reports] Error linking reports:', linkError)
      return NextResponse.json(
        { error: 'Failed to link reports' },
        { status: 500 }
      )
    }

    const count = updatedReports?.length || 0
    console.log(`[link-reports] Successfully linked ${count} report(s)`)

    if (count === 0 && existingReports && existingReports.length > 0) {
      const anonymousCount = existingReports.filter(r => r.user_id === null).length
      const linkedCount = existingReports.filter(r => r.user_id !== null).length

      console.log(`[link-reports] Found ${existingReports.length} total reports: ${anonymousCount} anonymous, ${linkedCount} already linked`)

      if (anonymousCount === 0) {
        console.log('[link-reports] All reports already have user_id set. No linking needed.')
      } else {
        console.warn('[link-reports] WARNING: Found anonymous reports but linked 0. This may indicate an issue.')
      }
    }

    if (updatedReports && updatedReports.length > 0) {
      console.log('[link-reports] Linked report IDs:', updatedReports.map(r => r.id))
    }

    return NextResponse.json({
      success: true,
      count,
      message: `Linked ${count} report(s) to your account`,
    })

  } catch (error) {
    console.error('Unexpected error in link reports:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
