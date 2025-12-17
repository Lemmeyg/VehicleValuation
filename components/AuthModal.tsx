'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { Button } from './ui/Button'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  redirectUrl?: string
  onSuccess?: () => void
}

export default function AuthModal({
  isOpen,
  onClose,
  redirectUrl = '/',
  onSuccess,
}: AuthModalProps) {
  const router = useRouter()
  const [isSignup, setIsSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignup) {
        // Signup validation
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }

        // Call signup API
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create account')
        }

        // After successful signup
        if (onSuccess) {
          onSuccess()
        } else {
          router.push(redirectUrl)
        }
      } else {
        // Login
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to login')
        }

        // After successful login
        if (onSuccess) {
          onSuccess()
        } else {
          router.push(redirectUrl)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsSignup(!isSignup)
    setError('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Header */}
        <div className="p-8 pb-4">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-slate-600">
            {isSignup
              ? 'Sign up to continue with your vehicle report'
              : 'Login to continue with your vehicle report'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isSignup ? 'Minimum 8 characters' : 'Enter your password'}
                  className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 text-lg font-semibold bg-gradient-to-r from-primary-600 to-emerald-600 hover:from-primary-700 hover:to-emerald-700"
          >
            {loading ? 'Processing...' : isSignup ? 'Create Account' : 'Login'}
          </Button>

          {!isSignup && (
            <div className="mt-4 text-center">
              <a href="/reset-password" className="text-sm text-primary-600 hover:text-primary-700">
                Forgot password?
              </a>
            </div>
          )}
        </form>

        {/* Toggle Mode */}
        <div className="px-8 pb-8 pt-4 border-t border-slate-200">
          <p className="text-center text-sm text-slate-600">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-primary-600 hover:text-primary-700 font-semibold"
            >
              {isSignup ? 'Login' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
