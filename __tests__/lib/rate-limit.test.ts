/**
 * Rate Limit Unit Tests
 *
 * Tests rate limiting functionality and bypass flags
 */

import { rateLimit } from '@/lib/rate-limit'

// Mock Request object
class MockRequest {
  headers: Map<string, string>

  constructor(headers: Record<string, string> = {}) {
    this.headers = new Map(Object.entries(headers))
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null
  }
}

describe('Rate Limit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic rate limiting', () => {
    it('should allow requests within limit', async () => {
      const limiter = rateLimit({
        interval: 60000, // 1 minute
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-forwarded-for': '192.168.1.1' }) as any

      // First 3 requests should succeed
      await expect(limiter.check(request, 5)).resolves.toBeUndefined()
      await expect(limiter.check(request, 5)).resolves.toBeUndefined()
      await expect(limiter.check(request, 5)).resolves.toBeUndefined()
    })

    it('should block requests exceeding limit', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-forwarded-for': '192.168.1.2' }) as any

      // Make requests up to limit
      await limiter.check(request, 3)
      await limiter.check(request, 3)
      await limiter.check(request, 3)

      // Next request should be blocked
      await expect(limiter.check(request, 3)).rejects.toThrow('Rate limit exceeded')
    })

    it('should track different IPs separately', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request1 = new MockRequest({ 'x-forwarded-for': '192.168.1.1' }) as any
      const request2 = new MockRequest({ 'x-forwarded-for': '192.168.1.2' }) as any

      // Both IPs should have separate limits
      await expect(limiter.check(request1, 2)).resolves.toBeUndefined()
      await expect(limiter.check(request2, 2)).resolves.toBeUndefined()

      await expect(limiter.check(request1, 2)).resolves.toBeUndefined()
      await expect(limiter.check(request2, 2)).resolves.toBeUndefined()

      // Now both should be at limit
      await expect(limiter.check(request1, 2)).rejects.toThrow()
      await expect(limiter.check(request2, 2)).rejects.toThrow()
    })

    it('should use x-real-ip header as fallback', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-real-ip': '10.0.0.1' }) as any

      await expect(limiter.check(request, 2)).resolves.toBeUndefined()
      await expect(limiter.check(request, 2)).resolves.toBeUndefined()
      await expect(limiter.check(request, 2)).rejects.toThrow('Rate limit exceeded')
    })

    it('should use anonymous as last resort identifier', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({}) as any // No IP headers

      await expect(limiter.check(request, 2)).resolves.toBeUndefined()
      await expect(limiter.check(request, 2)).resolves.toBeUndefined()
      await expect(limiter.check(request, 2)).rejects.toThrow('Rate limit exceeded')
    })

    it('should use custom token when provided', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-forwarded-for': '192.168.1.1' }) as any

      // Use custom token (e.g., user ID)
      await expect(limiter.check(request, 2, 'user-123')).resolves.toBeUndefined()
      await expect(limiter.check(request, 2, 'user-123')).resolves.toBeUndefined()
      await expect(limiter.check(request, 2, 'user-123')).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Time-based expiration', () => {
    it('should reset limit after interval expires', async () => {
      jest.useFakeTimers()

      const limiter = rateLimit({
        interval: 1000, // 1 second for testing
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-forwarded-for': '192.168.1.1' }) as any

      // Hit limit
      await limiter.check(request, 2)
      await limiter.check(request, 2)
      await expect(limiter.check(request, 2)).rejects.toThrow()

      // Advance time past interval
      jest.advanceTimersByTime(1100)

      // Should be able to make requests again
      await expect(limiter.check(request, 2)).resolves.toBeUndefined()

      jest.useRealTimers()
    })
  })

  describe('Configuration', () => {
    it('should use default values when options not provided', () => {
      const limiter = rateLimit()
      expect(limiter).toBeDefined()
      expect(limiter.check).toBeDefined()
    })

    it('should respect custom interval', async () => {
      const limiter = rateLimit({
        interval: 500, // 0.5 seconds
        uniqueTokenPerInterval: 100,
      })

      expect(limiter).toBeDefined()
    })

    it('should respect custom uniqueTokenPerInterval', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 10, // Small cache
      })

      expect(limiter).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle limit of 1 correctly', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-forwarded-for': '192.168.1.1' }) as any

      await expect(limiter.check(request, 1)).resolves.toBeUndefined()
      await expect(limiter.check(request, 1)).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle concurrent requests from same IP', async () => {
      const limiter = rateLimit({
        interval: 60000,
        uniqueTokenPerInterval: 500,
      })

      const request = new MockRequest({ 'x-forwarded-for': '192.168.1.1' }) as any

      // Make concurrent requests
      const promises = [
        limiter.check(request, 3),
        limiter.check(request, 3),
        limiter.check(request, 3),
      ]

      await Promise.all(promises) // All should succeed (within limit)

      // Next request should fail
      await expect(limiter.check(request, 3)).rejects.toThrow()
    })
  })
})
