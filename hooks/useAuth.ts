import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/db/supabase-client'
import type { User } from '@supabase/supabase-js'

/**
 * Authentication hook for Client Components
 *
 * Provides the current authenticated user and loading state.
 * Automatically updates when authentication state changes.
 *
 * @example
 * ```tsx
 * 'use client'
 *
 * import { useAuth } from '@/hooks/useAuth'
 *
 * export function MyComponent() {
 *   const { user, loading } = useAuth()
 *
 *   if (loading) return <div>Loading...</div>
 *   if (!user) return <div>Please log in</div>
 *
 *   return <div>Welcome {user.email}</div>
 * }
 * ```
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
