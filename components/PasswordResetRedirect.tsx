'use client'

/**
 * Password Reset Redirect Component
 *
 * Workaround for Supabase password reset links landing on home page
 * when NEXT_PUBLIC_APP_URL is not properly configured in Netlify.
 *
 * Detects password reset codes in URL and redirects to /reset-password page.
 */

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PasswordResetRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')

    // If there's a code parameter on the home page, it's likely a password reset
    // Redirect to the reset-password page with the code
    if (code) {
      console.log('Password reset code detected on home page, redirecting to /reset-password')
      router.replace(`/reset-password?code=${code}`)
    }
  }, [searchParams, router])

  // This component doesn't render anything
  return null
}
