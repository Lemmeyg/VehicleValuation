import { NextResponse } from 'next/server'
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
  const code = requestUrl.searchParams.get('code') // OAuth code
  const reportId = requestUrl.searchParams.get('reportId')
  const next = requestUrl.searchParams.get('next')

  console.log('Auth callback - URL:', requestUrl.toString())
  console.log('Auth callback - Code:', code ? 'present' : 'missing')
  console.log('Auth callback - ReportId:', reportId)
  console.log('Auth callback - Next:', next)

  // For magic links, the session is automatically established via hash params
  // We need to get the current session instead of exchanging a code
  const supabase = await createRouteHandlerSupabaseClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('Session check - User:', session?.user?.id || 'none')

  // Handle OAuth code exchange (if code is present)
  if (code && !session) {
    const { data: sessionData, error: codeError } = await supabase.auth.exchangeCodeForSession(code)

    if (codeError) {
      console.error('Code exchange error:', codeError)
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
    }

    if (sessionData?.session) {
      // Continue with the session data from code exchange
      const userId = sessionData.session.user.id
      const userEmail = sessionData.session.user.email

      console.log('User authenticated via OAuth:', userId, userEmail)

      // Link reports
      if (userEmail) {
        await linkReportsToUser(userId, userEmail)
      }

      return redirectToReport(reportId, next, requestUrl.origin)
    }
  }

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
      console.log(`Linked ${updatedReports?.length || 0} anonymous reports for ${userEmail} to user ${userId}`)
    }
  } catch (err) {
    console.error('Unexpected error linking reports:', err)
  }
}

// Helper function to determine redirect destination
function redirectToReport(reportId: string | null, next: string | null, origin: string) {
  let redirectUrl = '/dashboard'

  if (reportId) {
    redirectUrl = `/reports/${reportId}`
    console.log('Redirecting to specific report:', redirectUrl)
  } else if (next) {
    redirectUrl = next
    console.log('Redirecting to next URL:', redirectUrl)
  } else {
    console.log('Redirecting to dashboard')
  }

  return NextResponse.redirect(new URL(redirectUrl, origin))
}
