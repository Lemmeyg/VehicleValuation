/**
 * @jest-environment node
 */
import { GET } from '@/app/api/reports/check-vin-count/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db/supabase')

import { supabaseAdmin } from '@/lib/db/supabase'

const mockEq = jest.fn()
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

beforeEach(() => {
  jest.clearAllMocks()
  ;(supabaseAdmin as jest.Mocked<typeof supabaseAdmin>).from = mockFrom as never
})

function makeRequest(vin?: string) {
  const url = vin
    ? `https://example.com/api/reports/check-vin-count?vin=${encodeURIComponent(vin)}`
    : 'https://example.com/api/reports/check-vin-count'
  return new NextRequest(url)
}

describe('GET /api/reports/check-vin-count', () => {
  it('returns 400 when vin param is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing vin parameter')
  })

  it('returns count of 1 for a VIN that appears once', async () => {
    mockEq.mockResolvedValueOnce({ count: 1, error: null })

    const res = await GET(makeRequest('1HGBH41JXMN109186'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.count).toBe(1)
  })

  it('returns count of 2 for a VIN that appears twice', async () => {
    mockEq.mockResolvedValueOnce({ count: 2, error: null })

    const res = await GET(makeRequest('1HGBH41JXMN109186'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.count).toBe(2)
  })

  it('returns 500 when Supabase returns an error', async () => {
    mockEq.mockResolvedValueOnce({ count: null, error: { message: 'DB error' } })

    const res = await GET(makeRequest('1HGBH41JXMN109186'))
    expect(res.status).toBe(500)
  })

  it('queries supabase with count: exact and head: true', async () => {
    mockEq.mockResolvedValueOnce({ count: 0, error: null })

    await GET(makeRequest('1HGBH41JXMN109186'))

    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    expect(mockEq).toHaveBeenCalledWith('vin', '1HGBH41JXMN109186')
  })
})
