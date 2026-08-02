/**
 * Report Payment-Status API Tests
 * GET /api/reports/[id]/payment-status
 * No auth required — returns a confirmation boolean only, no report content.
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/reports/[id]/payment-status/route'
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeRequest(reportId: string) {
  return new Request(`http://localhost:3000/api/reports/${reportId}/payment-status`, {
    method: 'GET',
  })
}

function makeContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}

describe('GET /api/reports/[id]/payment-status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns confirmed: true when a succeeded payment exists for the report', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'payment-123' },
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.confirmed).toBe(true)
  })

  it('returns confirmed: false when no succeeded payment exists', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }) as any

    const response = await GET(makeRequest('report-123'), makeContext('report-123'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.confirmed).toBe(false)
  })
})
