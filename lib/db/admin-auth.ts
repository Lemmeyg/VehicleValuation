/**
 * Admin Authentication Utilities
 *
 * Functions for verifying admin access
 */

import { getUser } from './auth'
import { supabaseAdmin } from './supabase'

/**
 * Check if user is an admin
 *
 * SECURITY: This function queries the secure admins table instead of
 * user_metadata (which is user-editable). Only service role can modify
 * the admins table.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    // Query the secure admins table
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    if (error) {
      // Not found errors are expected for non-admin users
      if (error.code === 'PGRST116') {
        console.log('[ADMIN_CHECK] User is not an admin:', { userId })
        return false
      }

      // Log other errors
      console.error('[ADMIN_CHECK] Error checking admin status:', { userId, error: error.message })
      return false
    }

    // User exists in admins table
    console.log('[ADMIN_CHECK] User is an admin:', { userId })
    return true
  } catch (error) {
    console.error('[ADMIN_CHECK] Exception checking admin status:', error)
    return false
  }
}

/**
 * Require admin access (throws if not admin)
 */
export async function requireAdmin() {
  const user = await getUser()

  if (!user) {
    throw new Error('Unauthorized: Not authenticated')
  }

  const adminStatus = await isAdmin(user.id)

  if (!adminStatus) {
    throw new Error('Forbidden: Admin access required')
  }

  return user
}

/**
 * Check if current user is admin (returns boolean)
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const user = await getUser()
    if (!user) return false

    return await isAdmin(user.id)
  } catch {
    return false
  }
}
