/**
 * POST /api/auth/forgot-password
 *
 * Send password reset email to user.
 * Returns success even if email doesn't exist (security best practice).
 */

import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { NextResponse } from 'next/server'
import { apiLimiter } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limiting: 3 forgot password attempts per minute per IP
  try {
    await apiLimiter.check(request, 3)
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
    const { email } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Send password reset email
    // Note: Supabase sends users to /api/auth/callback first, which then redirects to /reset-password
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!appUrl) {
      console.error('NEXT_PUBLIC_APP_URL is not set! Password reset will fail.')
      return NextResponse.json(
        { error: 'Server configuration error. Please contact support.' },
        { status: 500 }
      )
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/api/auth/callback`,
    })

    if (resetError) {
      console.error('Password reset error:', resetError)
      // Don't reveal if email exists - return success anyway
    }

    // Always return success (don't reveal if email exists)
    return NextResponse.json(
      {
        message: 'If an account exists, a password reset email has been sent',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Forgot password exception:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
