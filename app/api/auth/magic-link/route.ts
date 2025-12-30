import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * Magic Link Authentication Endpoint
 *
 * Sends a passwordless login link to the user's email.
 * Used for anonymous report access - creates account if doesn't exist.
 *
 * POST /api/auth/magic-link
 * Body: { email, reportId }
 */

interface MagicLinkRequest {
  email: string
  reportId?: string
}

export async function POST(request: Request) {
  try {
    const body: MagicLinkRequest = await request.json()
    const { email, reportId } = body

    console.log('[magic-link] Request received:', { email, reportId })

    // Validate email
    if (!email) {
      console.error('[magic-link] Missing email')
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Get the app URL for callback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Build final redirect URL - must go to client-side page to access hash params
    // Magic link tokens are in URL hash (#access_token=...) which is only available client-side
    const redirectUrl = reportId
      ? `${appUrl}/auth/callback?reportId=${reportId}`
      : `${appUrl}/auth/callback`

    console.log('[magic-link] Sending magic link to:', email)
    console.log('[magic-link] Redirect URL:', redirectUrl)

    // Send magic link using Supabase Auth
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true, // Create user if doesn't exist
      },
    })

    if (error) {
      console.error('[magic-link] Supabase error:', error)

      // Handle rate limiting specifically
      if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
        return NextResponse.json(
          {
            error: 'Please wait a minute before requesting another magic link. Check your email for the previous one.',
            code: 'rate_limit'
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to send magic link. Please try again.' },
        { status: 500 }
      )
    }

    console.log('[magic-link] Magic link sent successfully')

    // If reportId provided, link the report to this email in case user is new
    if (reportId) {
      console.log('[magic-link] Ensuring report', reportId, 'is linked to email:', email)

      // The report should already have this email from anonymous creation
      // This is just a safety check to ensure it's linked
      const { error: updateError } = await supabaseAdmin
        .from('reports')
        .update({ email })
        .eq('id', reportId)
        .is('user_id', null) // Only update if still anonymous

      if (updateError) {
        console.error('[magic-link] Report email update error:', updateError)
        // Don't fail the request - magic link was still sent
      } else {
        console.log('[magic-link] Report email confirmed')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Magic link sent! Check your email to access your report.',
    })

  } catch (error) {
    console.error('Unexpected error in magic-link:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
