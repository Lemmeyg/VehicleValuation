'use client'

/**
 * Forgot Password Page
 *
 * Allows users to request a password reset link.
 * Sends email with reset token.
 */

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email')
        return
      }

      setSuccess(true)
      setEmail('')
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Forgot password error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="rounded-md bg-green-50 p-4">
            <h3 className="text-lg font-medium text-green-800">Check your email</h3>
            <p className="mt-2 text-sm text-green-700">
              If an account exists with that email address, we&apos;ve sent password reset
              instructions. Please check your inbox and spam folder.
            </p>
          </div>
          <div className="text-center space-y-2">
            <div>
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Back to login
              </Link>
            </div>
            <div>
              <button
                onClick={() => setSuccess(false)}
                className="font-medium text-gray-600 hover:text-gray-500"
              >
                Send another email
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
              className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>

          <div className="text-sm text-center space-y-2">
            <div>
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Back to login
              </Link>
            </div>
            <div>
              <Link href="/signup" className="font-medium text-gray-600 hover:text-gray-500">
                Don&apos;t have an account? Sign up
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
