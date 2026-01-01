/**
 * Environment Variable Validation
 *
 * Validates and exports environment variables with TypeScript type safety
 */

// Server-side only environment variables
function getServerEnv() {
  const env = {
    // Supabase
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

    // Lemon Squeezy (payment processor)
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY,
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID,
    LEMONSQUEEZY_WEBHOOK_SECRET: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,

    // App
    APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }

  // Validation
  const missing: string[] = []

  if (!env.SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!env.SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!env.APP_URL) missing.push('NEXT_PUBLIC_APP_URL')

  // Check for Lemon Squeezy payment processor
  if (!env.LEMONSQUEEZY_API_KEY) missing.push('LEMONSQUEEZY_API_KEY')
  if (!env.LEMONSQUEEZY_STORE_ID) missing.push('LEMONSQUEEZY_STORE_ID')
  if (!env.LEMONSQUEEZY_WEBHOOK_SECRET) missing.push('LEMONSQUEEZY_WEBHOOK_SECRET')

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\nPlease check your .env.local file.`
    )
  }

  // Validate formats
  if (!env.SUPABASE_URL?.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must start with https://')
  }

  return env as {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string
    LEMONSQUEEZY_API_KEY: string
    LEMONSQUEEZY_STORE_ID: string
    LEMONSQUEEZY_WEBHOOK_SECRET: string
    APP_URL: string
  }
}

// Client-side environment variables
function getClientEnv() {
  const env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    LEMONSQUEEZY_BASIC_VARIANT_ID: process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID,
    LEMONSQUEEZY_PREMIUM_VARIANT_ID: process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID,
    APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }

  // Client-side validation (only for public vars)
  if (typeof window !== 'undefined') {
    const missing: string[] = []

    if (!env.SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!env.SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (!env.APP_URL) missing.push('NEXT_PUBLIC_APP_URL')

    if (missing.length > 0) {
      console.error(
        `Missing required public environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}`
      )
    }
  }

  return env as {
    SUPABASE_URL: string | undefined
    SUPABASE_ANON_KEY: string | undefined
    LEMONSQUEEZY_BASIC_VARIANT_ID: string | undefined
    LEMONSQUEEZY_PREMIUM_VARIANT_ID: string | undefined
    APP_URL: string | undefined
  }
}

// Export validated environment variables
export const serverEnv =
  typeof window === 'undefined' ? getServerEnv() : ({} as ReturnType<typeof getServerEnv>)
export const clientEnv = getClientEnv()

// Type-safe environment variable access
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// Check if running in development
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'
export const isTest = process.env.NODE_ENV === 'test'

/**
 * Validate production environment configuration
 *
 * SECURITY: Ensures dangerous development flags are disabled in production
 */
export function validateProductionEnv(): void {
  // Only run validation in production and on server-side
  if (!isProduction || typeof window !== 'undefined') {
    return
  }

  const errors: string[] = []

  // Check for dangerous development flags
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    errors.push('DISABLE_RATE_LIMIT must be false or unset in production')
  }

  if (process.env.DISABLE_PAYMENT_CHECK === 'true') {
    errors.push('DISABLE_PAYMENT_CHECK must be false or unset in production')
  }

  // Ensure critical secrets are set
  if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    errors.push('LEMONSQUEEZY_WEBHOOK_SECRET is required in production')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production')
  }

  // Throw if any validation errors
  if (errors.length > 0) {
    throw new Error(
      `❌ PRODUCTION ENVIRONMENT VALIDATION FAILED:\n\n${errors.map(e => `  - ${e}`).join('\n')}\n\nPlease fix your environment variables before deploying to production.`
    )
  }

  console.log('✅ Production environment validation passed')
}

// Run validation immediately on server-side
if (typeof window === 'undefined') {
  validateProductionEnv()
}
