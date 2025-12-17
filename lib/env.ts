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

    // Stripe (Optional - legacy payment processor)
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    // Lemon Squeezy (Preferred payment processor)
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

  // Check for at least one payment processor configured
  const hasStripe = env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
  const hasLemonSqueezy =
    env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID && env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!hasStripe && !hasLemonSqueezy) {
    missing.push('Payment processor configuration (either Stripe OR Lemon Squeezy required)')
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\nPlease check your .env.local file.`
    )
  }

  // Validate formats
  if (!env.SUPABASE_URL?.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must start with https://')
  }

  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY must start with sk_ (e.g., sk_test_ or sk_live_)')
  }

  if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must start with whsec_')
  }

  return env as {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string
    STRIPE_SECRET_KEY: string | undefined
    STRIPE_WEBHOOK_SECRET: string | undefined
    LEMONSQUEEZY_API_KEY: string | undefined
    LEMONSQUEEZY_STORE_ID: string | undefined
    LEMONSQUEEZY_WEBHOOK_SECRET: string | undefined
    APP_URL: string
  }
}

// Client-side environment variables
function getClientEnv() {
  const env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
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
    STRIPE_PUBLISHABLE_KEY: string | undefined
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
