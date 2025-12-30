/**
 * Supabase Browser Client
 *
 * Client-side only Supabase utilities for use in Client Components.
 * This file can be safely imported in 'use client' components.
 */

'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser client for Client Components
 *
 * Use in client components that run in the browser.
 * Handles authentication state and cookie management automatically.
 *
 * @example
 * ```tsx
 * 'use client'
 *
 * import { createBrowserSupabaseClient } from '@/lib/db/supabase-client'
 *
 * export function MyClientComponent() {
 *   const supabase = createBrowserSupabaseClient()
 *   // Use supabase client...
 * }
 * ```
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
