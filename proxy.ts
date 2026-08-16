/**
 * Authentication Proxy
 *
 * Protects routes that require authentication.
 * Redirects unauthenticated users to the login page.
 *
 * Protected routes:
 * - /dashboard/*
 * - /reports/*
 * - /profile
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Skip proxy for API routes - they handle their own auth
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session if needed
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if route requires authentication
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/reports') ||
    request.nextUrl.pathname === '/profile'

  // Allow auth callback page without authentication (needed for magic link)
  const isAuthCallbackPage = request.nextUrl.pathname === '/auth/callback'
  // Allow the post-payment success page — anonymous buyers land here after purchase
  const isReportSuccessPage = /^\/reports\/[^/]+\/success(\/)?$/.test(request.nextUrl.pathname)
  // Allow the report view page — UUID is the access credential; page handles paid gate
  const isReportViewPage = /^\/reports\/[^/]+\/view(\/)?$/.test(request.nextUrl.pathname)
  // Allow the printable/PDF page — same anonymous-buyer path as /view, and the page
  // enforces its own access_token check before rendering anything
  const isReportPrintPage = /^\/reports\/[^/]+\/print(\/)?$/.test(request.nextUrl.pathname)
  // Allow the action-plan page — reached from a "Next Steps" link on the buyer's own
  // report and carrying the same ?token=, which the page validates before rendering.
  // Without this the guard bounced anonymous paying customers to /login (BL-129).
  const isReportActionPlanPage = /^\/reports\/[^/]+\/action-plan(\/)?$/.test(
    request.nextUrl.pathname
  )

  // Redirect to login if accessing protected route without authentication
  if (
    isProtectedRoute &&
    !user &&
    !isAuthCallbackPage &&
    !isReportSuccessPage &&
    !isReportViewPage &&
    !isReportPrintPage &&
    !isReportActionPlanPage
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    // Keep the query string — dropping it strands token-bearing URLs on a
    // tokenless destination that bounces the user straight back here
    redirectUrl.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to dashboard if accessing auth pages while already logged in
  const isAuthPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup'

  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (NOT excluded - they need auth checks too)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
