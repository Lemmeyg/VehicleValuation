/**
 * @jest-environment node
 */
jest.mock('@/lib/db/supabase')

import { supabaseAdmin } from '@/lib/db/supabase'
import { NextRequest } from 'next/server'

function makeRequest(id: string) {
  return new NextRequest(`https://www.totallosstoolkit.com/api/reports/${id}/preview`)
}

function makeSelectChain(resolvedData: unknown, resolvedError: unknown = null) {
  const chain: {
    select: jest.Mock
    eq: jest.Mock
    single: jest.Mock
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: resolvedData, error: resolvedError })
  return chain
}

describe('GET /api/reports/[id]/preview', () => {
  let mockFrom: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom = jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).from = mockFrom
  })

  it('returns 404 when the report does not exist', async () => {
    mockFrom.mockReturnValue(makeSelectChain(null, { message: 'not found' }))

    const { GET } = await import('@/app/api/reports/[id]/preview/route')
    const res = await GET(makeRequest('missing-id'), {
      params: Promise.resolve({ id: 'missing-id' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Report not found')
  })

  it('returns the report preview when unpaid', async () => {
    const report = {
      id: 'report-1',
      vin: '1HGCM82633A004352',
      mileage: 50000,
      zip_code: '90210',
      email: 'buyer@example.com',
      dealer_type: 'private',
      vehicle_data: { year: 2019, make: 'Honda', model: 'Civic' },
      marketcheck_valuation: { predictedPrice: 12000 },
      price_paid: null,
    }
    mockFrom.mockReturnValue(makeSelectChain(report))

    const { GET } = await import('@/app/api/reports/[id]/preview/route')
    const res = await GET(makeRequest('report-1'), { params: Promise.resolve({ id: 'report-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report).toEqual({
      id: 'report-1',
      vin: '1HGCM82633A004352',
      mileage: 50000,
      zip_code: '90210',
      email: 'buyer@example.com',
      dealer_type: 'private',
      vehicle_data: { year: 2019, make: 'Honda', model: 'Civic' },
      marketcheck_valuation: { predictedPrice: 12000 },
    })
    expect(body.alreadyPurchased).toBeUndefined()
  })

  it('returns alreadyPurchased instead of report data once price_paid is set', async () => {
    const report = {
      id: 'report-1',
      vin: '1HGCM82633A004352',
      mileage: 50000,
      zip_code: '90210',
      email: 'buyer@example.com',
      dealer_type: 'private',
      vehicle_data: { year: 2019, make: 'Honda', model: 'Civic' },
      marketcheck_valuation: { predictedPrice: 12000 },
      price_paid: 25,
    }
    mockFrom.mockReturnValue(makeSelectChain(report))

    const { GET } = await import('@/app/api/reports/[id]/preview/route')
    const res = await GET(makeRequest('report-1'), { params: Promise.resolve({ id: 'report-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ alreadyPurchased: true })
  })

  it('does not require any Authorization header', async () => {
    const report = {
      id: 'report-1',
      vin: '1HGCM82633A004352',
      mileage: 50000,
      zip_code: '90210',
      email: null,
      dealer_type: 'private',
      vehicle_data: { year: 2019, make: 'Honda', model: 'Civic' },
      marketcheck_valuation: null,
      price_paid: null,
    }
    mockFrom.mockReturnValue(makeSelectChain(report))

    const { GET } = await import('@/app/api/reports/[id]/preview/route')
    // No Authorization header set on this request at all.
    const res = await GET(makeRequest('report-1'), { params: Promise.resolve({ id: 'report-1' }) })

    expect(res.status).toBe(200)
  })
})
