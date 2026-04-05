'use client'

/**
 * Unified Authentication Page
 *
 * Consolidates login and signup into a single smart flow:
 * 1. User enters email
 * 2. System checks if account exists
 * 3. Shows appropriate form (login vs signup)
 *
 * Also supports:
 * - Google OAuth ("Continue with Google")
 * - Magic Link ("Email me a login link")
 */

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  Mail,
  Loader2,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { trackAuthEvent, identifyUser, trackButtonClick } from '@/lib/analytics/events'
import { trackRedditSignUp } from '@/lib/analytics/reddit-events'

type AuthStep = 'email' | 'login' | 'signup' | 'magic-link-sent'

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('returnUrl') || searchParams.get('redirect') || '/dashboard'
  const prefilledEmail = searchParams.get('email')
  const isExistingUser = searchParams.get('existingUser') === 'true'
  const fromHero = searchParams.get('fromHero') === 'true'
  const tokenExpired = searchParams.get('reason') === 'token_expired'

  // Auth state
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)

  // Pre-fill email from URL params
  useEffect(() => {
    if (prefilledEmail) {
      setEmail(decodeURIComponent(prefilledEmail))
      setShowEmailForm(true) // Show email form if email is prefilled
      // If existingUser flag is set, go directly to login step
      if (isExistingUser) {
        setStep('login')
      }
    }
  }, [prefilledEmail, isExistingUser])

  // Check if email exists in the system
  const checkEmail = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setCheckingEmail(true)
    setError('')

    // Track auth started
    trackAuthEvent({ method: 'email', step: 'started' })

    try {
      const response = await fetch('/api/reports/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.hasUser) {
        setStep('login')
      } else {
        setStep('signup')
      }
    } catch (err) {
      console.error('Email check error:', err)
      setError('Unable to verify email. Please try again.')
      trackAuthEvent({ method: 'email', step: 'failed', error: 'email_check_failed' })
    } finally {
      setCheckingEmail(false)
    }
  }

  // Handle email form submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    checkEmail()
  }

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        trackAuthEvent({
          method: 'email',
          step: 'failed',
          isNewUser: false,
          error: data.error || 'login_failed',
        })
        return
      }

      // Track successful login and identify user
      trackAuthEvent({ method: 'email', step: 'completed', isNewUser: false })
      if (data.user?.id) {
        identifyUser(data.user.id, { email, login_method: 'email' })
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Login error:', err)
      trackAuthEvent({
        method: 'email',
        step: 'failed',
        isNewUser: false,
        error: 'unexpected_error',
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!agreedToTerms) {
      setError('Please agree to the Terms and Conditions')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Signup failed')
        trackAuthEvent({
          method: 'email',
          step: 'failed',
          isNewUser: true,
          error: data.error || 'signup_failed',
        })
        return
      }

      // If email confirmation required, show message
      if (data.requiresEmailConfirmation) {
        setStep('magic-link-sent')
        trackAuthEvent({ method: 'email', step: 'completed', isNewUser: true })
        trackRedditSignUp()
        return
      }

      // Track successful signup and identify user
      trackAuthEvent({ method: 'email', step: 'completed', isNewUser: true })
      trackRedditSignUp()
      if (data.user?.id) {
        identifyUser(data.user.id, { email, name: fullName, signup_method: 'email' })
      }

      // Otherwise, redirect to intended destination
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Signup error:', err)
      trackAuthEvent({
        method: 'email',
        step: 'failed',
        isNewUser: true,
        error: 'unexpected_error',
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle magic link request
  const handleMagicLink = async () => {
    setError('')
    setLoading(true)

    // Track magic link auth started
    trackAuthEvent({ method: 'magic_link', step: 'started' })

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send magic link')
        trackAuthEvent({
          method: 'magic_link',
          step: 'failed',
          error: data.error || 'magic_link_failed',
        })
        return
      }

      setStep('magic-link-sent')
      trackAuthEvent({ method: 'magic_link', step: 'completed' })
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Magic link error:', err)
      trackAuthEvent({ method: 'magic_link', step: 'failed', error: 'unexpected_error' })
    } finally {
      setLoading(false)
    }
  }

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')

    // Track Google auth started
    trackAuthEvent({ method: 'google', step: 'started' })
    trackButtonClick('google_signin', { page: 'auth' })

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setError('Configuration error. Please contact support.')
        trackAuthEvent({ method: 'google', step: 'failed', error: 'config_error' })
        return
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin

      // Store redirect target in localStorage as fallback — Supabase may strip
      // the ?next= query param from redirectTo during the OAuth flow
      localStorage.setItem('auth_redirect_to', redirectTo)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) {
        console.error('Google OAuth error:', error)
        setError('Failed to sign in with Google. Please try again.')
        trackAuthEvent({ method: 'google', step: 'failed', error: error.message })
      }
      // Note: successful Google auth will redirect, so tracking completion happens in callback
    } catch (err) {
      console.error('Google sign in error:', err)
      setError('An unexpected error occurred')
      trackAuthEvent({ method: 'google', step: 'failed', error: 'unexpected_error' })
    } finally {
      setGoogleLoading(false)
    }
  }

  // Go back to email step
  const handleBack = () => {
    setStep('email')
    setPassword('')
    setConfirmPassword('')
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Expired token banner */}
        {tokenExpired && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">Your report link has expired.</p>
            <p>Sign in or create a free account to access your report.</p>
          </div>
        )}

        {/* Header */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'email' && (fromHero ? 'Get Your Vehicle Report' : 'Welcome')}
            {step === 'login' && 'Welcome back'}
            {step === 'signup' && 'Create your account'}
            {step === 'magic-link-sent' && 'Check your email'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'email' &&
              (fromHero
                ? 'Sign in or create an account to continue'
                : 'Enter your email to get started')}
            {step === 'login' && 'Sign in to continue'}
            {step === 'signup' && 'Just a few details to get started'}
            {step === 'magic-link-sent' && `We sent a login link to ${email}`}
          </p>
        </div>

        {/* Magic Link Sent Success */}
        {step === 'magic-link-sent' && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm">
                Click the link in your email to sign in. The link will expire in 24 hours.
              </p>
            </div>
            <button
              onClick={() => setStep('email')}
              className="text-blue-600 hover:text-blue-500 text-sm font-medium"
            >
              Use a different email
            </button>
          </div>
        )}

        {/* Email Step */}
        {step === 'email' && (
          <div className="space-y-6">
            {/* Google OAuth Button - Prominent */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider with collapsible email option */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">or</span>
              </div>
            </div>

            {/* Collapsible Email Section */}
            <div>
              <button
                type="button"
                onClick={() => setShowEmailForm(!showEmailForm)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Mail className="w-5 h-5" />
                Continue with email
                {showEmailForm ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </button>

              {/* Email Form - Collapsible */}
              {showEmailForm && (
                <form onSubmit={handleEmailSubmit} className="mt-4 space-y-4">
                  {error && (
                    <div className="rounded-md bg-red-50 p-4">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="you@example.com"
                      disabled={checkingEmail}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={checkingEmail || !email}
                    className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {checkingEmail ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Checking...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Login Step */}
        {step === 'login' && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Use a different email
            </button>

            {/* Email display */}
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-600">Signing in as</p>
              <p className="font-medium text-gray-900">{email}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Alternative options */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">or</span>
                </div>
              </div>

              {/* Magic Link Button */}
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                <Mail className="w-5 h-5" />
                Email me a login link
              </button>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Signup Step */}
        {step === 'signup' && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Use a different email
            </button>

            {/* Email display */}
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-600">Creating account for</p>
              <p className="font-medium text-gray-900">{email}</p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="John Doe"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="At least 8 characters"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Re-enter password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    disabled={loading}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="text-gray-700 cursor-pointer">
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="text-blue-600 hover:text-blue-500 underline"
                    >
                      Terms and Conditions
                    </Link>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !agreedToTerms}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer link */}
        {step !== 'magic-link-sent' && (
          <div className="text-center">
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-500">
              Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
