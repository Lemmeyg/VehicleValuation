/**
 * Rate Limiting Utility
 *
 * Implements in-memory rate limiting using LRU cache.
 * Prevents brute force attacks and API abuse.
 *
 * Usage:
 * ```typescript
 * import { rateLimit } from '@/lib/rate-limit'
 *
 * const limiter = rateLimit({
 *   interval: 60 * 1000, // 1 minute
 *   uniqueTokenPerInterval: 500,
 * })
 *
 * export async function POST(request: Request) {
 *   try {
 *     await limiter.check(request, 5) // 5 requests per minute
 *     // ... handle request
 *   } catch {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 *   }
 * }
 * ```
 */

import { LRUCache } from 'lru-cache'

type Options = {
  uniqueTokenPerInterval?: number
  interval?: number
}

export function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000, // 1 minute default
  })

  return {
    check: (request: Request, limit: number, token?: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        // Use IP address as token, fallback to provided token or 'anonymous'
        const identifier =
          token ||
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'anonymous'

        const tokenCount = (tokenCache.get(identifier) as number[]) || [0]
        if (tokenCount[0] === 0) {
          tokenCache.set(identifier, tokenCount)
        }
        tokenCount[0] += 1

        const currentUsage = tokenCount[0]
        const isRateLimited = currentUsage >= limit

        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'))
        } else {
          resolve()
        }
      }),
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Login attempts: 5 per minute
export const loginLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

// Signup attempts: 3 per minute
export const signupLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

// Report creation: 10 per hour
export const reportCreationLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500,
})

// Generic API: 100 per minute
export const apiLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})
