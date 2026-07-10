import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { upsertLead } from '@/lib/leads'

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
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Derive callback base URL from the request's actual host first — Vercel's
    // proxy always sets x-forwarded-host to whatever domain the browser
    // actually hit, so this is correct in every environment (production, each
    // Preview deployment, and local dev). NEXT_PUBLIC_APP_URL is only a
    // fallback for a request that arrives with no forwarding headers at all —
    // preferring it first would mean every magic link sent from a Preview
    // deployment silently redirects back to whatever fixed URL that env var
    // holds, which is exactly the bug this resolves.
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    const appUrl =
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // Build final redirect URL — must go to the API route handler which performs
    // the PKCE code exchange server-side (Supabase SSR uses PKCE by default)
    const redirectUrl = reportId
      ? `${appUrl}/api/auth/callback?reportId=${reportId}`
      : `${appUrl}/api/auth/callback`

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
            error:
              'Please wait a minute before requesting another magic link. Check your email for the previous one.',
            code: 'rate_limit',
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

      // Capture as a lead — non-fatal, must not block the magic link response
      try {
        await upsertLead(supabaseAdmin, email, 'form_submitted')
      } catch (leadErr) {
        console.error('[magic-link] Lead capture failed (non-fatal):', leadErr)
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
