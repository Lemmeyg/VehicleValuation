'use client'

/**
 * Signup Page - Redirect to Unified Auth
 *
 * This page now redirects to the unified /auth page.
 * Kept for backwards compatibility with existing links.
 */

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignupRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Preserve all query parameters
    const params = new URLSearchParams()

    // Copy existing params
    searchParams.forEach((value, key) => {
      params.set(key, value)
    })

    // Redirect to unified auth page
    const redirectUrl = `/auth${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(redirectUrl)
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to create account...</p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <SignupRedirect />
    </Suspense>
  )
}
