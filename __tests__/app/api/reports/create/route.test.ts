/**
 * Create Report API Integration Tests
 *
 * Tests report creation endpoint with mocked dependencies
 * CRITICAL: All external APIs are mocked to prevent costs
 */

import { POST } from '@/app/api/reports/create/route'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import * as rateLimitModule from '@/lib/rate-limit'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { logApiCall } from '@/lib/api/api-call-logger'

// Mock all dependencies
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/rate-limit')
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/utils/url-validator')
jest.mock('@/lib/api/api-call-logger')

const mockFetchAutoDevVinDecode = fetchAutoDevVinDecode as jest.MockedFunction<
  typeof fetchAutoDevVinDecode
>
const mockFetchMarketCheckData = fetchMarketCheckData as jest.MockedFunction<
  typeof fetchMarketCheckData
>
const mockValidateListingUrls = validateListingUrls as jest.MockedFunction<
  typeof validateListingUrls
>
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(rateLimitModule.reportCreationLimiter as any) = {
      check: jest.fn().mockResolvedValue(undefined),
    }

    mockLogApiCall.mockResolvedValue(undefined)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  describe('API Call Logging', () => {
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
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({
          data: { id: 'test-report-123' },
          error: null,
        }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      })

      mockFetchAutoDevVinDecode.mockResolvedValue({
        success: true,
        data: {
          make: 'Honda',
          model: 'Accord',
          trim: 'EX',
          body: 'Sedan',
          engine: '2.0L',
          transmission: 'Automatic',
          drive: 'FWD',
          type: 'Gasoline',
          vinValid: true,
          vehicle: { year: 2020 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockFetchMarketCheckData.mockResolvedValue({
        success: true,
        data: {
          predictedPrice: 22000,
          msrp: 25000,
          priceRange: { min: 20000, max: 24000 },
          confidence: 'high',
          totalComparablesFound: 50,
          recentComparables: { num_found: 30 },
          listingUrls: [],
        },
        fallbackUsed: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockValidateListingUrls.mockResolvedValue({
        prediction: {
          predictedPrice: 22000,
          msrp: 25000,
          priceRange: { min: 20000, max: 24000 },
          confidence: 'high',
          totalComparablesFound: 50,
          recentComparables: { num_found: 30 },
          listingUrls: [],
        },
        stats: {
          checkedCount: 0,
          failedCount: 0,
          failedUrls: [],
          validatedUrls: [],
          batchesUsed: 0,
        },
      })
    })

    it('should log AutoDev and MarketCheck calls with canonical endpoint strings and costs', async () => {
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

      await POST(request)

      expect(mockLogApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'autodev',
          endpoint: '/vin/{vin}',
          cost: 0.0,
          requestData: { vin: expect.any(String) },
          responseData: expect.objectContaining({
            make: expect.any(String),
            vinValid: expect.any(Boolean),
          }),
        })
      )
      expect(mockLogApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          cost: 0.09,
          requestData: expect.objectContaining({
            vin: expect.any(String),
            dealer_type: expect.any(String),
          }),
          responseData: expect.objectContaining({
            predicted_price: expect.any(Number),
            total_comparables_found: expect.any(Number),
            recent_comparables_found: expect.any(Number),
          }),
        })
      )
    })
  })
})
