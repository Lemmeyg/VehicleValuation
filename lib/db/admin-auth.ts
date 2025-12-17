/**
 * Admin Authentication Utilities
 *
 * Functions for verifying admin access
 */

import { getUser } from './auth'
import { supabaseAdmin } from './supabase'

/**
 * Check if user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  // Use service role client for admin operations
  // This is required because auth.admin API requires service role key
  const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(userId)

  if (error || !user) {
    return false
  }

  // Check user_metadata for admin flag
  // In production, you'd query a separate admins or user_roles table
  const isAdmin = user.user.user_metadata?.is_admin === true

  return isAdmin
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
