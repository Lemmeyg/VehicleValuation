/**
 * GET /api/auth/session
 *
 * Get the current authenticated user and session.
 * Returns user data and profile if authenticated, null otherwise.
 */

import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createRouteHandlerSupabaseClient()

    // Get current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Session error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to get session' },
        { status: 500 }
      )
    }

    // No active session
    if (!session) {
      return NextResponse.json(
        { user: null, session: null },
        { status: 200 }
      )
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      // Continue without profile
    }

    return NextResponse.json(
      {
        user: {
          id: session.user.id,
          email: session.user.email,
          profile,
        },
        session,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Session exception:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
