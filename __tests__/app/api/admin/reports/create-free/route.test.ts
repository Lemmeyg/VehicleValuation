/**
 * Admin Free Report Creation API Tests
 *
 * Tests the admin-only endpoint that creates reports without payment.
 * CRITICAL: All external APIs are mocked to prevent costs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { POST } from '@/app/api/admin/reports/create-free/route'

// Mock all dependencies
jest.mock('@/lib/db/admin-auth')
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/services/pdf-generator')
jest.mock('@/lib/utils/dealer-type-classifier')

import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { classifyDealerType } from '@/lib/utils/dealer-type-classifier'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockGeneratePDF = generateAndUploadPDF as jest.Mock
const mockFetchAutodev = fetchAutoDevVinDecode as jest.Mock
const mockFetchMarketcheck = fetchMarketCheckData as jest.Mock
const mockClassifyDealerType = classifyDealerType as jest.Mock

// Supabase admin mock — supports chained .from().insert().select().single() etc.
const mockSingle = jest.fn()
const mockSelect = jest.fn(() => ({ single: mockSingle }))
const mockInsert = jest.fn(() => ({ select: mockSelect, single: mockSingle }))
const mockEq = jest.fn().mockResolvedValue({ error: null })
const mockUpdate = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
}))

;(supabaseAdmin as any) = { from: mockFrom }

const VALID_VIN = '1HGBH41JXMN109186'

function makeRequest(body: object) {
  return new Request('http://localhost:3000/api/admin/reports/create-free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/reports/create-free', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset supabase mock (cleared above)
    ;(supabaseAdmin as any) = { from: mockFrom }
    mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate, select: mockSelect })
    mockInsert.mockReturnValue({ select: mockSelect, single: mockSingle })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'report-abc-123' }, error: null })
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })

    // Default: authenticated admin user
    mockRequireAdmin.mockResolvedValue({ id: 'admin-user-123', email: 'admin@example.com' })

    // Default: external APIs succeed
    mockFetchAutodev.mockResolvedValue({
      success: true,
      data: {
        make: 'Honda',
        model: 'Civic',
        trim: 'LX',
        body: 'Sedan',
        engine: '1.5L',
        transmission: 'CVT',
        drive: 'FWD',
        type: 'Gasoline',
        vehicle: { year: 2020 },
      },
    })
    mockFetchMarketcheck.mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 18000,
        confidence: 'high',
        totalComparablesFound: 50,
        recentComparables: { num_found: 20 },
        priceRange: { min: 16000, max: 20000 },
        msrp: 22000,
      },
    })
    mockClassifyDealerType.mockReturnValue({
      dealerType: 'franchise',
      confidence: 'high',
      reasoning: 'Honda',
    })
    mockGeneratePDF.mockResolvedValue({ success: true, pdfUrl: 'https://example.com/report.pdf' })
  })

  describe('Authentication & Authorization', () => {
    it('returns 401 when not authenticated', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Unauthorized: Not authenticated'))

      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: 35000, zipCode: '10001' }))
      expect(res.status).toBe(401)
    })

    it('returns 403 when authenticated but not admin', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Forbidden: Admin access required'))

      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: 35000, zipCode: '10001' }))
      expect(res.status).toBe(403)
    })
  })

  describe('Input Validation', () => {
    it('returns 400 for invalid VIN', async () => {
      const res = await POST(makeRequest({ vin: 'INVALID', mileage: 35000, zipCode: '10001' }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain('VIN')
    })

    it('returns 400 for negative mileage', async () => {
      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: -1, zipCode: '10001' }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain('mileage')
    })

    it('returns 400 for mileage over 999999', async () => {
      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: 1000000, zipCode: '10001' }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain('mileage')
    })

    it('returns 400 for invalid ZIP code', async () => {
      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: 35000, zipCode: 'ABCDE' }))
      const data = await res.json()
      expect(res.status).toBe(400)
      expect(data.error).toContain('ZIP')
    })
  })

  describe('Successful creation', () => {
    it('returns 201 with reportId on success', async () => {
      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: 35000, zipCode: '10001' }))
      const data = await res.json()
      expect(res.status).toBe(201)
      expect(data.reportId).toBe('report-abc-123')
    })

    it('calls generateAndUploadPDF with the created report id', async () => {
      await POST(makeRequest({ vin: VALID_VIN, mileage: 35000, zipCode: '10001' }))
      expect(mockGeneratePDF).toHaveBeenCalledWith({ reportId: 'report-abc-123' })
    })
  })

  describe('PDF failure handling', () => {
    it('returns 500 with reportId when PDF generation fails', async () => {
      mockGeneratePDF.mockResolvedValue({ success: false, error: 'PDF service unavailable' })

      const res = await POST(makeRequest({ vin: VALID_VIN, mileage: 35000, zipCode: '10001' }))
      const data = await res.json()
      expect(res.status).toBe(500)
      expect(data.reportId).toBe('report-abc-123')
    })
  })
})
