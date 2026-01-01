/**
 * POST /api/auth/signup
 *
 * Register a new user with email and password.
 * Automatically creates a user profile via database trigger.
 */

import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { NextResponse } from 'next/server'
import { signupLimiter } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limiting: 3 signup attempts per minute per IP
  try {
    await signupLimiter.check(request, 3)
  } catch {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again in a minute.' },
      { status: 429 }
    )
  }

  try {
    const supabase = await createRouteHandlerSupabaseClient()

    // Parse request body
    const body = await request.json()
    const { email, password, fullName, company } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Create user account
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company,
        },
      },
    })

    if (signUpError) {
      console.error('Signup error:', signUpError)

      // Handle specific error cases
      if (signUpError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
      }

      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    // If email confirmation is enabled, user needs to verify email
    if (data.user && !data.session) {
      return NextResponse.json(
        {
          message: 'Confirmation email sent. Please check your inbox.',
          requiresEmailConfirmation: true,
          user: {
            id: data.user.id,
            email: data.user.email,
          },
        },
        { status: 201 }
      )
    }

    // If email confirmation is disabled, user is signed in immediately
    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
        session: data.session,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup exception:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
