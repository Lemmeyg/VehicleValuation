'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

/**
 * Client-side Auth Callback Page
 *
 * Handles magic link authentication by:
 * 1. Extracting hash parameters from URL (#access_token=...)
 * 2. Establishing the session with Supabase
 * 3. Linking anonymous reports to the authenticated user
 * 4. Redirecting to the report page
 */

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get environment variables - they must be NEXT_PUBLIC_ prefixed to be available client-side
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        console.log('Supabase URL available:', !!supabaseUrl)
        console.log('Supabase Anon Key available:', !!supabaseAnonKey)

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('Missing Supabase environment variables')
          setStatus('error')
          setMessage('Configuration error. Please contact support.')
          return
        }

        // Create Supabase client for browser
        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
        const reportId = searchParams?.get('reportId')
        const nextUrl = searchParams?.get('next') // For OAuth redirects
        const oauthError = searchParams?.get('error')
        const tokenHash = searchParams?.get('token_hash')
        const otpType = searchParams?.get('type')

        // Handle OAuth errors (e.g. user cancelled Google sign-in)
        if (oauthError) {
          const authUrl = `/auth${nextUrl ? `?redirect=${encodeURIComponent(nextUrl)}` : ''}`
          setRecoveryUrl(authUrl)
          setStatus('error')
          if (oauthError === 'access_denied') {
            setMessage(
              'Google sign-in was cancelled or failed. You can still access your report by entering your email and using the magic link option instead.'
            )
          } else {
            setMessage('Sign-in failed. Please try again using your email address.')
          }
          return
        }

        // Handle token_hash OTP flow — used by Supabase server-side signInWithOtp
        if (tokenHash && otpType) {
          console.log('[auth-callback] token_hash OTP flow, type:', otpType)
          const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as 'magiclink' | 'email' | 'recovery' | 'invite',
          })

          if (otpError || !otpData.session) {
            console.error('[auth-callback] OTP verification failed:', otpError?.message)
            setRecoveryUrl('/auth')
            setStatus('error')
            setMessage('Sign-in link is invalid or has expired. Please request a new one.')
            return
          }

          console.log('[auth-callback] OTP verified for:', otpData.session.user.email)

          if (otpData.session.user.email) {
            try {
              await fetch('/api/reports/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: otpData.session.user.id,
                  email: otpData.session.user.email,
                }),
              })
            } catch {
              // Non-fatal — continue to redirect
            }
          }

          setStatus('success')
          setMessage('Success! Redirecting...')
          const storedRedirect = localStorage.getItem('auth_redirect_to')
          let redirectUrl = '/'
          if (nextUrl) {
            redirectUrl = decodeURIComponent(nextUrl)
          } else if (storedRedirect) {
            redirectUrl = storedRedirect
          } else if (reportId) {
            redirectUrl = `/reports/${reportId}/view`
          }
          localStorage.removeItem('auth_redirect_to')
          setTimeout(() => router.push(redirectUrl), 1000)
          return
        }

        console.log('[auth-callback] Starting authentication callback')
        console.log('[auth-callback] Report ID from URL:', reportId)
        console.log('[auth-callback] Window hash:', window.location.hash)

        // Check if we have hash parameters (from magic link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        console.log('Access token present:', !!accessToken)

        // If we have tokens in the hash, set the session explicitly
        if (accessToken && refreshToken) {
          console.log('[auth-callback] Setting session from hash parameters')

          const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setSessionError) {
            console.error('[auth-callback] Set session error:', setSessionError)
            setStatus('error')
            setMessage('Authentication failed. Please try again.')
            setTimeout(() => router.push('/'), 3000)
            return
          }

          if (!sessionData.session) {
            console.log('No session after setting tokens')
            setStatus('error')
            setMessage('Failed to establish session. Please request a new magic link.')
            setTimeout(() => router.push('/'), 3000)
            return
          }

          console.log('[auth-callback] Session established for user:', sessionData.session.user.id)
          console.log('[auth-callback] User email:', sessionData.session.user.email)

          // Link anonymous reports to this user
          if (sessionData.session.user.email) {
            console.log(
              '[auth-callback] Linking reports for email:',
              sessionData.session.user.email
            )

            try {
              const response = await fetch('/api/reports/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: sessionData.session.user.id,
                  email: sessionData.session.user.email,
                }),
              })

              if (response.ok) {
                const data = await response.json()
                console.log(`[auth-callback] Successfully linked ${data.count} reports to user`)
              } else {
                console.error('[auth-callback] Failed to link reports:', await response.text())
              }
            } catch (err) {
              console.error('[auth-callback] Error linking reports:', err)
              // Continue anyway - we can still show the report
            }
          }

          // Success - redirect to appropriate destination
          setStatus('success')
          setMessage('Success! Redirecting...')

          // Priority: nextUrl (OAuth) > localStorage fallback > reportId > home page default
          const storedRedirect = localStorage.getItem('auth_redirect_to')
          let redirectUrl = '/'
          if (nextUrl) {
            redirectUrl = decodeURIComponent(nextUrl)
          } else if (storedRedirect) {
            redirectUrl = storedRedirect
          } else if (reportId) {
            redirectUrl = `/reports/${reportId}/view`
          }
          localStorage.removeItem('auth_redirect_to')
          console.log('[auth-callback] Redirecting to:', redirectUrl)

          // Small delay so user sees success message
          setTimeout(() => router.push(redirectUrl), 1000)
          return
        }

        // Fallback: try to get existing session (for OAuth flows)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setStatus('error')
          setMessage('Authentication failed. Please try again.')
          setTimeout(() => router.push('/'), 3000)
          return
        }

        if (!session) {
          console.log('No session found and no hash parameters')
          setRecoveryUrl('/auth')
          setStatus('error')
          setMessage('No active session found. Please request a new magic link.')
          return
        }

        console.log('Session established for user:', session.user.id)

        // Link anonymous reports to this user
        if (session.user.email) {
          try {
            const response = await fetch('/api/reports/link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: session.user.id,
                email: session.user.email,
              }),
            })

            if (response.ok) {
              const data = await response.json()
              console.log(`Linked ${data.count} reports to user`)
            }
          } catch (err) {
            console.error('Error linking reports:', err)
            // Continue anyway - we can still show the report
          }
        }

        // Success - redirect to appropriate destination
        setStatus('success')
        setMessage('Success! Redirecting...')

        // Priority: nextUrl (OAuth) > localStorage fallback > reportId > home page default
        const storedRedirect = localStorage.getItem('auth_redirect_to')
        let redirectUrl = '/'
        if (nextUrl) {
          redirectUrl = decodeURIComponent(nextUrl)
        } else if (storedRedirect) {
          redirectUrl = storedRedirect
        } else if (reportId) {
          redirectUrl = `/reports/${reportId}/view`
        }
        localStorage.removeItem('auth_redirect_to')
        console.log('Redirecting to:', redirectUrl)

        // Small delay so user sees success message
        setTimeout(() => router.push(redirectUrl), 1000)
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        setStatus('error')
        setMessage('An unexpected error occurred.')
        setTimeout(() => router.push('/'), 3000)
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying Your Email</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="rounded-full bg-green-100 p-3 inline-block mb-4">
              <svg
                className="h-16 w-16 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="rounded-full bg-red-100 p-3 inline-block mb-4">
              <svg
                className="h-16 w-16 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            {recoveryUrl ? (
              <Link
                href={recoveryUrl}
                className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign in with email instead
              </Link>
            ) : (
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                Return to home
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
