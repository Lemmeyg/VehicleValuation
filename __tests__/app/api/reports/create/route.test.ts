/**
 * @jest-environment node
 *
 * Create Report API Integration Tests
 *
 * Tests report creation endpoint with mocked dependencies
 * CRITICAL: All external APIs are mocked to prevent costs
 */

import { POST } from '@/app/api/reports/create/route'
import {
  createServerSupabaseClient,
  createRouteHandlerSupabaseClient,
  supabaseAdmin,
} from '@/lib/db/supabase'
import * as rateLimitModule from '@/lib/rate-limit'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import { logApiCall } from '@/lib/api/api-call-logger'

// Mock all dependencies
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/rate-limit')
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/utils/url-validator')
jest.mock('@/lib/utils/comparables-supplementer', () => ({
  supplementComparables: jest.fn(),
}))
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
const mockSupplementComparables = supplementComparables as jest.MockedFunction<
  typeof supplementComparables
>
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
}

// .env.test sets NEXT_PUBLIC_APP_URL=http://localhost:3000 for all Jest suites
// (loaded via next/jest). buildKbArticleUrl falls back to the production URL
// only when this var is unset, so it must be cleared here to keep the
// exact-match assertions on personalization URLs stable.
const ORIG_APP_URL = process.env.NEXT_PUBLIC_APP_URL

describe('POST /api/reports/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createRouteHandlerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)

    // Mock rate limiter to allow requests by default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(rateLimitModule.reportCreationLimiter as any) = {
      check: jest.fn().mockResolvedValue(undefined),
    }

    mockLogApiCall.mockResolvedValue(undefined)

    // Default: VIN decode "fails" so the route stores user-entered data and
    // still creates the report. Tests that need a successful decode override
    // this. Without a default, `autoDevVinResult.success` throws (route:171).
    mockFetchAutoDevVinDecode.mockResolvedValue({ success: false, error: 'not mocked' })

    // Default: pass-through (no supplementation)
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  })

  afterEach(() => {
    if (ORIG_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = ORIG_APP_URL
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
      expect(data.error).toMatch(/unauthorized|authenticated/i)
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
        // route does .from('reports').insert({...}).select().single(), then later
        // .from('reports').update({...}).eq('id', ...)
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'new-report-123' }, error: null }),
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

      expect(response.status).toBe(201) // route returns 201 Created on success
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
        // route does .from('reports').insert({...}).select().single(), then later
        // .from('reports').update({...}).eq('id', ...)
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'new-report-123' }, error: null }),
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

      expect(response.status).toBe(201) // route returns 201 Created on success
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
        // route does .from('reports').insert({...}).select().single(), then later
        // .from('reports').update({...}).eq('id', ...)
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'new-report-123' }, error: null }),
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

      expect(response.status).toBe(201) // route returns 201 Created on success
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
      expect(data.error).toMatch(/too many|limit/i)
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
        // route does .from('reports').insert({...}).select().single(), then later
        // .from('reports').update({...}).eq('id', ...)
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'new-report-123' }, error: null }),
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

      expect(response.status).toBe(201) // route returns 201 Created on success
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

      expect(response.status).toBe(201) // route returns 201 Created on success
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

    it('logs the AutoDev call, and logs no MarketCheck call because none is made', async () => {
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
      // MarketCheck is a paid per-call API and is no longer hit at creation
      // time — the LemonSqueezy webhook fetches it after payment. So there is
      // no marketcheck call to log here, and nothing to charge for.
      expect(mockLogApiCall).not.toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'marketcheck' })
      )
    })
  })

  describe('Comparables Supplementation', () => {
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

    it('does not supplement comparables, and writes comparables_supplemented: false', async () => {
      // Supplementation only makes sense on MarketCheck results, which this
      // route no longer fetches. It moved to the webhook, after payment.
      mockSupplementComparables.mockImplementationOnce(async prediction => ({
        prediction,
        supplemented: true,
      }))

      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ error: null })
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: mockEq,
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({
          data: { id: 'test-report-123' },
          error: null,
        }),
        insert: jest.fn().mockReturnThis(),
        update: mockUpdate,
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

      await POST(request)

      expect(mockSupplementComparables).not.toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          comparables_supplemented: false,
          marketcheck_valuation: null,
        })
      )
    })

    it('writes vehicle_make/model/year to the report update when decode succeeds', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ error: null })
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: mockEq,
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: { id: 'test-report-123' }, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: mockUpdate,
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

      await POST(request)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicle_make: 'Honda',
          vehicle_model: 'Accord',
          vehicle_year: 2020,
        })
      )
    })

    it('writes state_article_url/state_name/vehicle_guide_url to the report update when decode succeeds', async () => {
      // Override the shared mock's year to 2010 so the vehicle-guide bucket
      // ("Older") stays stable regardless of when this suite runs.
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
          vehicle: { year: 2010 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ error: null })
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: mockEq,
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: { id: 'test-report-123' }, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: mockUpdate,
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

      await POST(request)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          state_article_url:
            'https://www.totallosstoolkit.com/knowledge-base/new-york-total-loss-law-explained?utm_source=zoho&utm_medium=email&utm_content=state_article',
          state_name: 'New York',
          vehicle_guide_url:
            'https://www.totallosstoolkit.com/knowledge-base/should-you-buy-back-your-totaled-car-hidden-costs?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide',
        })
      )
    })
  })
})

describe('lead capture on report creation (N6)', () => {
  const mockSingle = jest.fn()
  const mockSelect = jest.fn(() => ({ single: mockSingle }))
  const mockInsert = jest.fn(() => ({ select: mockSelect }))

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createRouteHandlerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-123', email: 'test@example.com' } },
      error: null,
    })
    mockSingle.mockResolvedValue({ data: { id: 'new-report-123' }, error: null })
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: mockSingle,
      insert: mockInsert,
      update: jest.fn().mockReturnThis(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(rateLimitModule.reportCreationLimiter as any) = {
      check: jest.fn().mockResolvedValue(undefined),
    }
    mockFetchAutoDevVinDecode.mockResolvedValue({ success: false, error: 'not relevant here' })
    mockLogApiCall.mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })
  })

  function makeRequest() {
    return new Request('http://localhost:3000/api/reports/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zipCode: '10001',
        reportType: 'basic',
      }),
    })
  }

  it('includes the authenticated user email on the reports insert', async () => {
    await POST(makeRequest())
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@example.com' }))
  })

  it('calls upsertLead with the authenticated user email as form_submitted', async () => {
    await POST(makeRequest())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'test@example.com',
      p_lead_type: 'form_submitted',
      p_source: undefined,
      p_kb_source_slug: undefined,
      p_utm_source: undefined,
      p_utm_medium: undefined,
      p_utm_campaign: undefined,
    })
  })

  it('still creates the report even if upsertLead rejects', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db down' } })
    const response = await POST(makeRequest())
    expect(response.status).toBe(201)
  })
})

/**
 * Parity with the anonymous create path.
 *
 * /api/reports/create-anonymous leaves price_paid null and never calls
 * MarketCheck — the LemonSqueezy webhook fetches valuation data after payment.
 * This authenticated path used to differ on both counts, which cost money on
 * unpaid reports and made those reports invisible to the abandoned-report cron
 * (it filters `.is('price_paid', null)`, and 0 is not null).
 */
describe('POST /api/reports/create — parity with the anonymous path', () => {
  const mockSingle = jest.fn()
  const mockSelect = jest.fn(() => ({ single: mockSingle }))
  const mockInsert = jest.fn(() => ({ select: mockSelect }))

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createRouteHandlerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-123', email: 'test@example.com' } },
      error: null,
    })
    mockSingle.mockResolvedValue({ data: { id: 'new-report-123' }, error: null })
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: mockSingle,
      insert: mockInsert,
      update: jest.fn().mockReturnThis(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(rateLimitModule.reportCreationLimiter as any) = {
      check: jest.fn().mockResolvedValue(undefined),
    }
    mockLogApiCall.mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

    // VIN decode SUCCEEDS here — that is the condition under which the old code
    // went on to call MarketCheck, so it is the case worth pinning.
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
  })

  function makeRequest() {
    return new Request('http://localhost:3000/api/reports/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zipCode: '10001',
        reportType: 'basic',
      }),
    })
  }

  it('leaves price_paid unset so the abandoned-report cron can see the report', async () => {
    await POST(makeRequest())

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted).not.toHaveProperty('price_paid')
  })

  it('does not call MarketCheck at creation time — the webhook fetches it after payment', async () => {
    await POST(makeRequest())

    expect(mockFetchMarketCheckData).not.toHaveBeenCalled()
  })
})
