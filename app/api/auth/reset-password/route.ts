/**
 * POST /api/auth/reset-password
 *
 * Reset user password with valid token from email.
 * Token is automatically validated by Supabase.
 */

import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { NextResponse } from 'next/server'
import { apiLimiter } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limiting: 5 reset attempts per minute per IP
  try {
    await apiLimiter.check(request, 5)
  } catch {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a minute.' },
      { status: 429 }
    )
  }

  try {
    const supabase = await createRouteHandlerSupabaseClient()

    // Parse request body
    const body = await request.json()
    const { code, password } = body

    // Validate required fields
    if (!password) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // If code is provided, try to exchange it for a session first
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        // Code might already be exchanged - check if we have a session
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          return NextResponse.json(
            { error: 'Invalid or expired reset link. Please request a new one.' },
            { status: 400 }
          )
        }
        // If we have a session, continue with password update
        console.log('Code already exchanged, but session exists. Proceeding with password update.')
      }
    } else {
      // No code provided - verify we have an active recovery session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        return NextResponse.json(
          { error: 'No active session. Please use the reset link from your email.' },
          { status: 401 }
        )
      }
    }

    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        message: 'Password reset successful',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Reset password exception:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
