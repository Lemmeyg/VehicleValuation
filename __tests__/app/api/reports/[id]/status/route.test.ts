/**
 * Report Status API Tests
 * GET /api/reports/[id]/status
 * No auth required — returns readiness boolean only
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/reports/[id]/status/route'
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeRequest(reportId: string) {
  return new Request(`http://localhost:3000/api/reports/${reportId}/status`, {
    method: 'GET',
  })
}

function makeContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}

describe('GET /api/reports/[id]/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns ready: false when report has no price_paid', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { price_paid: null, marketcheck_valuation: null },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ready).toBe(false)
  })

  it('returns ready: false when price_paid set but marketcheck_valuation is null', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { price_paid: 2900, marketcheck_valuation: null },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.ready).toBe(false)
  })

  it('returns ready: true with pricePaid, vin, and email when report is complete', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          price_paid: 2900,
          marketcheck_valuation: { predictedPrice: 25000 },
          vin: '1HGCM82633A004352',
          email: 'buyer@example.com',
        },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.ready).toBe(true)
    expect(data.pricePaid).toBe(2900)
    expect(data.vin).toBe('1HGCM82633A004352')
    expect(data.email).toBe('buyer@example.com')
  })

  it('returns manualReview: true (and ready: false) when status is valuation_failed', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          price_paid: 2900,
          marketcheck_valuation: null,
          status: 'valuation_failed',
          vin: '1HGCM82633A004352',
          email: 'buyer@example.com',
        },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.ready).toBe(false)
    expect(data.manualReview).toBe(true)
    expect(data.email).toBe('buyer@example.com')
  })

  it('returns manualReview: true when status is vin_decode_failed even if a valuation exists', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          price_paid: 2900,
          marketcheck_valuation: { predictedPrice: 25000 },
          status: 'vin_decode_failed',
          vin: '1HGCM82633A004352',
          email: 'buyer@example.com',
        },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.manualReview).toBe(true)
    expect(data.ready).toBe(false)
  })

  it('returns 404 when report not found', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    }) as any

    const response = await GET(makeRequest('nonexistent'), makeContext('nonexistent'))

    expect(response.status).toBe(404)
  })
})
