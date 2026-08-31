'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { trackReportWorkflow, trackPaymentSuccess, identifyUser } from '@/lib/analytics/events'
import { SUPPORT_EMAIL } from '@/lib/constants'

interface Props {
  reportId: string
  checkoutEmail: string | null
  pricePaid: number | null
}

type PollerState = 'polling' | 'setup' | 'magic-link-sent' | 'timedOut' | 'manualReview'

const MAX_POLLS = 30
const POLL_INTERVAL_MS = 2000

export function ReportReadyPoller({ reportId, checkoutEmail, pricePaid }: Props) {
  const attemptsRef = useRef(0)
  const [pollerState, setPollerState] = useState<PollerState>('polling')
  const purchaseTracked = useRef(false)

  // Account setup form state
  const [email, setEmail] = useState(checkoutEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (pollerState !== 'polling') return

    attemptsRef.current = 0

    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.ready || data.manualReview) {
          // ReportReadyPoller is only rendered for unauthenticated users. When
          // the report is ready we show the account setup form so the buyer can
          // claim it; when it needs manual review (BL-62) we show the "we need
          // more time" message. Either way the payment succeeded, so record it
          // once — otherwise an anonymous buyer whose report failed vanishes
          // from the funnel.
          // Use data.pricePaid from the API (fresh) — the pricePaid prop may be
          // stale (0) if the webhook processed after the server rendered this page.
          if (!purchaseTracked.current && data.pricePaid) {
            purchaseTracked.current = true
            const planType = data.pricePaid === 2900 ? 'basic' : 'premium'
            const buyerEmail = data.email ?? checkoutEmail ?? undefined
            trackReportWorkflow({ step: 'report_created', reportId, planType })
            trackPaymentSuccess({
              plan: planType,
              amount: data.pricePaid / 100,
              currency: 'USD',
              paymentProcessor: 'lemonsqueezy',
              email: buyerEmail,
              vin: data.vin ?? undefined,
            })
            // Anonymous buyers have no userId yet — identify by email so this
            // session's events link to a named PostHog person profile.
            if (buyerEmail) {
              identifyUser(buyerEmail, {
                email: buyerEmail,
                vin: data.vin ?? undefined,
                plan: planType,
              })
            }
          }
          setPollerState(data.manualReview ? 'manualReview' : 'setup')
          return
        }
      } catch {
        // Network error — keep polling
      }
      attemptsRef.current += 1
      if (attemptsRef.current >= MAX_POLLS) {
        setPollerState('timedOut')
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    poll()
    return () => clearInterval(timer)
  }, [reportId, pollerState, checkoutEmail])

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (password !== confirmPassword) {
      setFormError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }
    if (!agreedToTerms) {
      setFormError('Please agree to the Terms and Conditions')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Account already exists (created by the checkout webhook) — guide the
        // buyer to the explicit magic-link option instead of auto-sending one.
        if (
          data.error?.toLowerCase().includes('already registered') ||
          data.error?.toLowerCase().includes('already exists')
        ) {
          setFormError(
            "An account already exists for this email. Use 'Email me a sign-in link' below, or sign in if you already have a password."
          )
          return
        }
        setFormError(data.error || 'Failed to create account')
        return
      }

      // Link the report to the new account so canViewReport passes
      await fetch(`/api/reports/${reportId}/claim`, { method: 'POST' })
      // Hard navigation so the server reads the fresh session cookie
      window.location.href = `/reports/${reportId}/view`
    } catch {
      setFormError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sendMagicLink = async () => {
    try {
      await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setPollerState('magic-link-sent')
    } catch {
      setFormError('Failed to send sign-in link. Please try again.')
    }
  }

  if (pollerState === 'manualReview') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Report In Progress</h1>
          <p className="text-slate-600">
            We require more time to compile the data relevant to your vehicle. You will receive your
            report via email within 24 hours. Please email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-emerald-600 underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            using the email you used to purchase your report.
          </p>
        </div>
      </div>
    )
  }

  if (pollerState === 'timedOut') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Taking Longer Than Expected</h1>
          <p className="text-slate-600 mb-6">
            Your report is being prepared. Check your email for a link, or try refreshing.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
            <p className="text-sm text-slate-500">
              Still having trouble? Email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (pollerState === 'magic-link-sent') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-600 mb-2">
            We sent a sign-in link to <span className="font-medium">{email}</span>.
          </p>
          <p className="text-sm text-slate-400">
            Click the link to access your report. The link expires in 24 hours.
          </p>
        </div>
      </div>
    )
  }

  if (pollerState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Your report is ready!</h1>
            <p className="text-slate-600 mt-1">Create your account to access it.</p>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-4">
            {formError && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
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
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                disabled={loading}
              />
              <label htmlFor="terms" className="ml-3 text-sm text-gray-700 cursor-pointer">
                I agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  Terms and Conditions
                </a>
              </label>
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
                'Create account & view report'
              )}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
            >
              Email me a sign-in link instead
            </button>
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <a
                href={`/auth?redirect=/reports/${reportId}/view`}
                className="text-blue-600 hover:text-blue-500"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // pollerState === 'polling'
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6">
          <svg
            className="animate-spin w-16 h-16 text-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-600 mb-2">Fetching your vehicle&apos;s valuation data&hellip;</p>
        <p className="text-sm text-slate-400">This takes about 10 seconds.</p>
        <p className="text-sm text-slate-400 mt-1">
          We&apos;ll also email you a secure link to your report within 24 hours.
        </p>
      </div>
    </div>
  )
}
