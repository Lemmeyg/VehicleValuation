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

    console.log('Reset password request - Code present:', !!code)
    console.log('Reset password request - Password length:', password?.length || 0)

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
      console.log('Attempting to exchange code for session...')
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('❌ Code exchange error:', exchangeError.message)
        console.error('Error details:', JSON.stringify(exchangeError, null, 2))

        // Code might already be exchanged - check if we have a session
        console.log('Checking for existing session...')
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          console.error('❌ No session found after failed code exchange')
          return NextResponse.json(
            { error: 'Invalid or expired reset link. Please request a new one.' },
            { status: 400 }
          )
        }
        // If we have a session, continue with password update
        console.log('✅ Code already exchanged, but session exists. Proceeding with password update.')
        console.log('Session user:', session.user.id)
      } else {
        console.log('✅ Code successfully exchanged for session')
      }
    } else {
      // No code provided - verify we have an active recovery session
      console.log('No code provided, checking for existing session...')
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.error('❌ No active session found')
        return NextResponse.json(
          { error: 'No active session. Please use the reset link from your email.' },
          { status: 401 }
        )
      }
      console.log('✅ Active session found:', session.user.id)
    }

    // Update the user's password
    console.log('Attempting to update password...')
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      console.error('❌ Password update error:', updateError.message)
      console.error('Error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 400 }
      )
    }

    console.log('✅ Password updated successfully!')
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
