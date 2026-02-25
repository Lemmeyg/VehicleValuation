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

  it('returns ready: true when both price_paid and marketcheck_valuation are set', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          price_paid: 2900,
          marketcheck_valuation: { predictedPrice: 25000 },
        },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(data.ready).toBe(true)
    expect(data.pricePaid).toBe(2900)
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
