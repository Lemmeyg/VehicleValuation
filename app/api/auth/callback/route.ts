import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * Auth Callback Handler
 *
 * Handles authentication callbacks from Supabase (magic link, OAuth, etc.)
 * Links anonymous reports to newly authenticated users
 */

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  // Get parameters
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const code = requestUrl.searchParams.get('code') // OAuth PKCE code
  const reportId = requestUrl.searchParams.get('reportId')
  const next = requestUrl.searchParams.get('next')

  console.log('Auth callback - URL:', requestUrl.toString())
  console.log('Auth callback - Code:', code ? 'present' : 'missing')
  console.log('Auth callback - Type:', type)
  console.log('Auth callback - ReportId:', reportId)
  console.log('Auth callback - Next:', next)

  // Handle magic link / OTP token_hash flow (Supabase default for server-generated OTPs)
  if (token_hash && type) {
    console.log('Auth callback - token_hash flow, type:', type)
    const supabase = await createRouteHandlerSupabaseClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
      console.error('❌ OTP verification error:', error.message)
      return NextResponse.redirect(new URL('/auth?error=auth_failed', requestUrl.origin))
    }

    if (data.session) {
      const userId = data.session.user.id
      const userEmail = data.session.user.email
      console.log('✅ OTP verified, user authenticated:', userId, userEmail)
      if (userEmail) await linkReportsToUser(userId, userEmail)
      return redirectToReport(reportId, next, requestUrl.origin)
    }

    console.error('❌ OTP verification succeeded but no session returned')
    return NextResponse.redirect(new URL('/auth?error=session_failed', requestUrl.origin))
  }

  // Handle password reset flow - exchange code for session server-side
  // This ensures session cookies are properly set before redirecting to reset-password page
  if (type === 'recovery' && code) {
    console.log('Password recovery flow detected, exchanging code for session...')

    const supabase = await createRouteHandlerSupabaseClient()
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('❌ Recovery code exchange error:', exchangeError.message)
      console.error('Error details:', JSON.stringify(exchangeError, null, 2))
      return NextResponse.redirect(new URL('/login?error=invalid_reset_link', requestUrl.origin))
    }

    if (sessionData?.session) {
      console.log('✅ Recovery session established for user:', sessionData.session.user.id)
      console.log('Redirecting to reset-password page (session cookies set)')
      return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
    }

    console.error('❌ Code exchange succeeded but no session returned')
    return NextResponse.redirect(new URL('/login?error=session_failed', requestUrl.origin))
  }

  // Handle OAuth / general code exchange (Google OAuth, email confirmation, etc.)
  // Supabase strips custom query params from redirectTo, so OAuth callbacks
  // arrive with just ?code=... and no type/next params. This is NOT a password reset.
  if (code) {
    console.log('Auth code present, exchanging for session...')

    const supabase = await createRouteHandlerSupabaseClient()
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('❌ Code exchange error:', exchangeError.message)
      console.error('Error details:', JSON.stringify(exchangeError, null, 2))
      return NextResponse.redirect(new URL('/auth?error=auth_failed', requestUrl.origin))
    }

    if (sessionData?.session) {
      const userId = sessionData.session.user.id
      const userEmail = sessionData.session.user.email

      console.log('✅ User authenticated:', userId, userEmail)

      // Link reports
      if (userEmail) {
        await linkReportsToUser(userId, userEmail)
      }

      // Redirect: next param > reportId > /pricing (hero flow default) > /dashboard
      return redirectToReport(reportId, next, requestUrl.origin)
    }

    console.error('❌ Code exchange succeeded but no session returned')
    return NextResponse.redirect(new URL('/auth?error=session_failed', requestUrl.origin))
  }

  // For magic links, the session is established via hash params on the client side
  const supabase = await createRouteHandlerSupabaseClient()
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  console.log('Session check - User:', session?.user?.id || 'none')

  // Handle magic link authentication (session already established)
  if (session?.user) {
    const userId = session.user.id
    const userEmail = session.user.email

    console.log('User authenticated via magic link:', userId, userEmail)

    // Link any anonymous reports with this email to the new user
    if (userEmail) {
      await linkReportsToUser(userId, userEmail)
    }

    return redirectToReport(reportId, next, requestUrl.origin)
  }

  // No authentication found
  console.log('No authentication found, redirecting to home')
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}

// Helper function to link reports to user
async function linkReportsToUser(userId: string, userEmail: string) {
  try {
    const { data: updatedReports, error: linkError } = await supabaseAdmin
      .from('reports')
      .update({ user_id: userId })
      .eq('email', userEmail)
      .is('user_id', null)
      .select()

    if (linkError) {
      console.error('Error linking reports to user:', linkError)
    } else {
      console.log(
        `Linked ${updatedReports?.length || 0} anonymous reports for ${userEmail} to user ${userId}`
      )
    }
  } catch (err) {
    console.error('Unexpected error linking reports:', err)
  }
}

// Helper function to determine redirect destination
function redirectToReport(reportId: string | null, next: string | null, origin: string) {
  let redirectUrl = '/'

  if (next) {
    redirectUrl = next
    console.log('Redirecting to next URL:', redirectUrl)
  } else if (reportId) {
    redirectUrl = `/reports/${reportId}`
    console.log('Redirecting to specific report:', redirectUrl)
  } else {
    console.log('Redirecting to home page (no next/reportId provided)')
  }

  return NextResponse.redirect(new URL(redirectUrl, origin))
}
