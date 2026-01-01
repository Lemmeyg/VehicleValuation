/**
 * POST /api/auth/login
 *
 * Authenticate a user with email and password.
 * Returns session data on success.
 */

import { createRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/db/supabase'
import { NextResponse } from 'next/server'
import { loginLimiter } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limiting: 5 login attempts per minute per IP
  try {
    await loginLimiter.check(request, 5)
  } catch {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again in a minute.' },
      { status: 429 }
    )
  }

  try {
    const supabase = await createRouteHandlerSupabaseClient()

    // Parse request body
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Attempt to sign in
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      console.error('Login error:', signInError)

      // Generic error message for security (don't reveal if email exists)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      // Profile should exist due to trigger, but continue anyway
    }

    // Link any anonymous reports with this email to the authenticated user
    if (data.user.email) {
      const normalizedEmail = data.user.email.toLowerCase().trim()

      console.log('[login] Linking anonymous reports for email:', normalizedEmail)

      try {
        const { data: linkedReports, error: linkError } = await supabaseAdmin
          .from('reports')
          .update({ user_id: data.user.id })
          .ilike('email', normalizedEmail)
          .is('user_id', null) // Only link anonymous reports
          .select()

        if (linkError) {
          console.error('[login] Error linking reports:', linkError)
          // Continue with login even if linking fails
        } else {
          const linkedCount = linkedReports?.length || 0
          console.log(`[login] Successfully linked ${linkedCount} anonymous report(s) to user ${data.user.id}`)

          if (linkedReports && linkedReports.length > 0) {
            console.log('[login] Linked report IDs:', linkedReports.map(r => r.id))
          }
        }
      } catch (linkException) {
        console.error('[login] Exception while linking reports:', linkException)
        // Continue with login even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          profile,
        },
        session: data.session,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login exception:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
