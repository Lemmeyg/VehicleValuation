/**
 * GET /api/auth/session
 *
 * Get the current authenticated user.
 * Returns user data and profile if authenticated, null otherwise.
 */

import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { NextResponse } from 'next/server'

export async function GET(_request: Request) {
  try {
    const supabase = await createRouteHandlerSupabaseClient()

    // getUser() validates against the Supabase Auth server on every call —
    // unlike getSession(), it can't be spoofed by a crafted cookie.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // getUser() returns AuthSessionMissingError for every anonymous visitor
    // with no session cookie at all — that's the expected, common case for
    // this endpoint (Navbar/PricingSection call it on every page load), not
    // a failure. Only a genuine other error should surface as a 500.
    if (userError && userError.name !== 'AuthSessionMissingError') {
      console.error('Session error:', userError)
      return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
    }

    // No active session
    if (!user) {
      return NextResponse.json({ user: null, session: null }, { status: 200 })
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      // Continue without profile
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          profile,
        },
        // Callers (Navbar, PricingSection) only check truthiness of `session`,
        // never read token fields from it — this presence marker is sufficient.
        session: { user },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Session exception:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
