'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

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
            console.log('[auth-callback] Linking reports for email:', sessionData.session.user.email)

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

          // Success - redirect to report
          setStatus('success')
          setMessage('Email verified! Redirecting to your report...')

          const redirectUrl = reportId ? `/reports/${reportId}/view` : '/dashboard'
          console.log('[auth-callback] Redirecting to:', redirectUrl)

          // Small delay so user sees success message
          setTimeout(() => router.push(redirectUrl), 1000)
          return
        }

        // Fallback: try to get existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setStatus('error')
          setMessage('Authentication failed. Please try again.')
          setTimeout(() => router.push('/'), 3000)
          return
        }

        if (!session) {
          console.log('No session found and no hash parameters')
          setStatus('error')
          setMessage('No active session. Please request a new magic link.')
          setTimeout(() => router.push('/'), 3000)
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

        // Success - redirect to report
        setStatus('success')
        setMessage('Email verified! Redirecting to your report...')

        const redirectUrl = reportId ? `/reports/${reportId}/view` : '/dashboard'
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Verifying Your Email
            </h2>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Success!
            </h2>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Verification Failed
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
