/**
 * Supabase Client Utilities
 *
 * This file provides different Supabase client configurations for various use cases:
 * - Browser client (client-side)
 * - Server component client (Server Components)
 * - Route handler client (API routes)
 * - Admin client (service role for privileged operations)
 *
 * Use the appropriate client based on your context to ensure proper authentication
 * and security.
 */

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Simple server-side client (use for basic queries without auth context)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Admin client with service role key
 *
 * ⚠️ WARNING: Only use for privileged operations that bypass RLS
 * Use cases:
 * - Webhook handlers (Stripe)
 * - Admin operations
 * - Background jobs
 *
 * NEVER expose this client to the browser or client components
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

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
 * import { createBrowserSupabaseClient } from '@/lib/db/supabase'
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

/**
 * Server client for Server Components
 *
 * Use in Server Components and Server Actions.
 * Handles cookie-based authentication with proper security.
 *
 * @example
 * ```tsx
 * import { createServerSupabaseClient } from '@/lib/db/supabase'
 *
 * export async function MyServerComponent() {
 *   const supabase = await createServerSupabaseClient()
 *   const { data } = await supabase.from('reports').select('*')
 *   // ...
 * }
 * ```
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // Cookie setting may fail in Server Components
            // This is expected and can be safely ignored
          }
        },
      },
    }
  )
}

/**
 * Route Handler client for API routes
 *
 * Use in Next.js API route handlers (app/api/*).
 * Handles authentication and cookie management for API endpoints.
 *
 * @example
 * ```tsx
 * import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
 * import { NextResponse } from 'next/server'
 *
 * export async function GET(request: Request) {
 *   const supabase = await createRouteHandlerSupabaseClient()
 *   const { data, error } = await supabase.from('reports').select('*')
 *   return NextResponse.json({ data, error })
 * }
 * ```
 */
export async function createRouteHandlerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
