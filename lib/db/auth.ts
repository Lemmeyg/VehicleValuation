/**
 * Authentication Helper Functions
 *
 * Utility functions for handling authentication operations and session management.
 */

import { createServerSupabaseClient } from './supabase'
import type { User } from '@supabase/supabase-js'

/**
 * Get the current authenticated user from the session
 *
 * Use in Server Components, Server Actions, and API routes
 *
 * @returns User object if authenticated, null otherwise
 *
 * @example
 * ```tsx
 * import { getUser } from '@/lib/db/auth'
 *
 * export async function MyServerComponent() {
 *   const user = await getUser()
 *   if (!user) {
 *     redirect('/login')
 *   }
 *   // User is authenticated
 * }
 * ```
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Get the current session
 *
 * Returns session data including access token and refresh token
 *
 * @returns Session object if authenticated, null otherwise
 */
export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

/**
 * Require authentication for a page or API route
 *
 * Throws an error with a 401 status if user is not authenticated
 *
 * @throws Error with 401 status if not authenticated
 * @returns Authenticated user object
 *
 * @example
 * ```tsx
 * import { requireAuth } from '@/lib/db/auth'
 *
 * export async function GET(request: Request) {
 *   const user = await requireAuth()
 *   // User is guaranteed to be authenticated here
 * }
 * ```
 */
export async function requireAuth(): Promise<User> {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Check if a user is authenticated
 *
 * @returns true if user is authenticated, false otherwise
 *
 * @example
 * ```tsx
 * import { isAuthenticated } from '@/lib/db/auth'
 *
 * export async function MyComponent() {
 *   const authed = await isAuthenticated()
 *   return <div>{authed ? 'Welcome!' : 'Please login'}</div>
 * }
 * ```
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser()
  return user !== null
}

/**
 * Get user profile information
 *
 * Fetches extended user profile data from the user_profiles table
 *
 * @returns User profile object or null
 *
 * @example
 * ```tsx
 * import { getUserProfile } from '@/lib/db/auth'
 *
 * export async function ProfilePage() {
 *   const profile = await getUserProfile()
 *   return <div>Welcome, {profile?.full_name}</div>
 * }
 * ```
 */
export async function getUserProfile() {
  const user = await getUser()
  if (!user) {
    return null
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user profile:', error)
    // Return a fallback profile from auth.user data if user_profiles table doesn't exist or profile is missing
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      created_at: user.created_at,
      updated_at: user.updated_at,
    }
  }

  // If no profile exists, return fallback from auth.user
  if (!data) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      created_at: user.created_at,
      updated_at: user.updated_at,
    }
  }

  return data
}

/**
 * Sign out the current user
 *
 * Clears session and redirects to login page
 *
 * @example
 * ```tsx
 * import { signOut } from '@/lib/db/auth'
 *
 * async function handleSignOut() {
 *   await signOut()
 * }
 * ```
 */
export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
}

/**
 * Check if a user has admin privileges
 *
 * Checks user_metadata.is_admin flag to determine if user has admin access
 *
 * @param userId - The user ID to check
 * @returns true if user has admin privileges, false otherwise
 *
 * @example
 * ```tsx
 * import { checkIfUserIsAdmin } from '@/lib/db/auth'
 *
 * export async function GET(request: Request) {
 *   const user = await requireAuth()
 *   const isAdmin = await checkIfUserIsAdmin(user.id)
 *   if (!isAdmin) {
 *     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 *   }
 *   // Proceed with admin-only logic
 * }
 * ```
 */
export async function checkIfUserIsAdmin(userId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  try {
    // Get current user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user || user.id !== userId) {
      return false
    }

    // Check is_admin in user_metadata
    return user.user_metadata?.is_admin === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Type guard to check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === 'Unauthorized' || error.message.includes('auth')
  }
  return false
}
