/**
 * Rate Limit Check API Route
 *
 * GET /api/reports/can-create
 *
 * Checks if the authenticated user can create a new report based on weekly rate limit (7 days).
 * Admin users are exempt from rate limiting.
 *
 * Rate Limit: 1 report per 7 days (168 hours) for non-admin users
 */

import { NextResponse } from 'next/server'
import { requireAuth, checkIfUserIsAdmin } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'

const WEEKLY_LIMIT_HOURS = 168 // 7 days = 168 hours

export async function GET() {
  try {
    // 1. Authenticate user
    const user = await requireAuth()

    // 2. Check if admin (bypass rate limit)
    const isAdmin = await checkIfUserIsAdmin(user.id)
    if (isAdmin) {
      console.log('[RATE_LIMIT] Admin bypass:', { userId: user.id, email: user.email })
      return NextResponse.json({
        canCreate: true,
        isAdmin: true,
      })
    }

    // 3. Query most recent report for this user
    const supabase = await createServerSupabaseClient()
    const { data: lastReport, error } = await supabase
      .from('reports')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle() to avoid error when no rows found

    if (error) {
      console.error('[RATE_LIMIT] Database query error:', error)
      // Fail open: allow creation on database error to avoid blocking users
      return NextResponse.json({
        canCreate: true,
        error: 'Check failed',
      })
    }

    // 4. If no previous reports, allow creation
    if (!lastReport) {
      console.log('[RATE_LIMIT] First report:', { userId: user.id })
      return NextResponse.json({
        canCreate: true,
        isFirstReport: true,
      })
    }

    // 5. Calculate time difference
    const lastCreated = new Date(lastReport.created_at)
    const now = new Date()
    const hoursSinceLastReport = (now.getTime() - lastCreated.getTime()) / (1000 * 60 * 60)

    // 6. Check if 7 days (168 hours) have passed
    const canCreate = hoursSinceLastReport >= WEEKLY_LIMIT_HOURS

    // 7. Calculate remaining time
    const hoursRemaining = Math.max(0, WEEKLY_LIMIT_HOURS - hoursSinceLastReport)
    const daysRemaining = Math.floor(hoursRemaining / 24)
    const hoursRemainingAfterDays = Math.ceil(hoursRemaining % 24)

    // 8. Calculate next available date
    const nextAvailableDate = new Date(lastCreated.getTime() + WEEKLY_LIMIT_HOURS * 60 * 60 * 1000)

    // 9. Log result
    if (canCreate) {
      console.log('[RATE_LIMIT] User allowed:', {
        userId: user.id,
        hoursSinceLast: Math.round(hoursSinceLastReport),
      })
    } else {
      console.warn('[RATE_LIMIT] User blocked:', {
        userId: user.id,
        hoursRemaining: Math.ceil(hoursRemaining),
        daysRemaining,
        hoursRemainingAfterDays,
      })
    }

    return NextResponse.json({
      canCreate,
      lastReportCreatedAt: lastReport.created_at,
      hoursRemaining: Math.ceil(hoursRemaining),
      daysRemaining,
      hoursRemainingAfterDays,
      nextAvailableDate: nextAvailableDate.toISOString(),
    })
  } catch (error) {
    console.error('[RATE_LIMIT] Check failed:', error)

    // If auth error, return 401
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For other errors, fail open to avoid blocking users
    return NextResponse.json({ canCreate: true, error: 'Check failed' }, { status: 500 })
  }
}
