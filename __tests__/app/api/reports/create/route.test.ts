/**
 * Create Report API Integration Tests
 *
 * Tests report creation endpoint with mocked dependencies
 * CRITICAL: All external APIs are mocked to prevent costs
 */

import { POST } from '@/app/api/reports/create/route'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import * as rateLimitModule from '@/lib/rate-limit'

// Mock all dependencies
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/rate-limit')
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/api/autodev-client')

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
}

describe('POST /api/reports/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)

    // Mock rate limiter to allow requests by default
    ;(rateLimitModule.reportCreationLimiter as any) = {
      check: jest.fn().mockResolvedValue(undefined),
    }
  })

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('authenticated')
    })

    it('should accept authenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      // Mock successful report creation
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'new-report-123' },
          error: null,
        }),
      })

      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('VIN Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'test-user-123', email: 'test@example.com' },
        },
        error: null,
      })
    })

    it('should reject invalid VIN format', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: 'INVALID',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('VIN')
    })

    it('should reject VIN with invalid checksum', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109187', // Invalid checksum
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('VIN')
    })

    it('should accept valid VIN', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'new-report-123' },
          error: null,
        }),
      })

      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Mileage Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'test-user-123', email: 'test@example.com' },
        },
        error: null,
      })
    })

    it('should reject negative mileage', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: -1000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('mileage')
    })

    it('should reject excessive mileage', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 1000000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('mileage')
    })
  })

  describe('ZIP Code Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'test-user-123', email: 'test@example.com' },
        },
        error: null,
      })
    })

    it('should reject invalid ZIP code format', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: 'INVALID',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('ZIP')
    })

    it('should accept valid 5-digit ZIP code', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'new-report-123' },
          error: null,
        }),
      })

      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'test-user-123', email: 'test@example.com' },
        },
        error: null,
      })
    })

    it('should reject requests exceeding rate limit', async () => {
      // Mock rate limiter to reject
      ;(rateLimitModule.reportCreationLimiter as any).check = jest
        .fn()
        .mockRejectedValue(new Error('Rate limit exceeded'))

      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('limit')
    })
  })

  describe('Report Type Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'test-user-123', email: 'test@example.com' },
        },
        error: null,
      })

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'new-report-123' },
          error: null,
        }),
      })
    })

    it('should accept basic report type', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'basic',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should accept premium report type', async () => {
      const request = new Request('http://localhost:3000/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zipCode: '10001',
          reportType: 'premium',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })
})
