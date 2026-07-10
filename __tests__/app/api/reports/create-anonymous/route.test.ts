/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '@/app/api/reports/create-anonymous/route'

jest.mock('@/lib/api/api-call-logger')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/db/supabase')

import { logApiCall } from '@/lib/api/api-call-logger'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { supabaseAdmin } from '@/lib/db/supabase'

const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>
const mockFetchAutoDevVinDecode = fetchAutoDevVinDecode as jest.MockedFunction<
  typeof fetchAutoDevVinDecode
>

const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()
const mockSingle = jest.fn()

const mockAutoDevData = {
  vin: '1HGBH41JXMN109186',
  vinValid: true,
  wmi: '1HG',
  checkDigit: '6',
  checksum: true,
  origin: 'North America',
  make: 'Honda',
  model: 'Accord',
  trim: 'EX-L',
  body: 'Sedan',
  type: 'Gasoline',
  engine: '1.5L Turbo I4',
  drive: 'FWD',
  transmission: 'CVT',
  vehicle: { year: 2021 },
}

beforeEach(() => {
  jest.clearAllMocks()

  mockSingle.mockResolvedValue({
    data: {
      id: 'new-report-id',
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '10001',
      email: null,
      status: 'pending',
      vehicle_data: null,
      marketcheck_valuation: null,
      created_at: '2026-03-14T00:00:00.000Z',
    },
    error: null,
  })
  mockInsert.mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ data: null, error: null })
  mockSelect.mockReturnValue({
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: mockOrder,
  })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockLimit.mockResolvedValue({ data: [], error: null })
  ;(supabaseAdmin as any).from = jest.fn((table: string) => {
    if (table === 'reports') return { select: mockSelect, insert: mockInsert, update: mockUpdate }
    return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) }
  })

  mockFetchAutoDevVinDecode.mockResolvedValue({ success: true, data: mockAutoDevData })
  mockLogApiCall.mockResolvedValue(undefined)
  ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })
})

function makeRequest(body: object) {
  return new Request('http://localhost:3000/api/reports/create-anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

it('creates report, calls Auto.dev (not VinAudit), and logs the call', async () => {
  const response = await POST(
    makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' })
  )
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(mockFetchAutoDevVinDecode).toHaveBeenCalledWith('1HGBH41JXMN109186')
  expect(mockLogApiCall).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: true,
      reportId: 'new-report-id',
      requestData: { vin: '1HGBH41JXMN109186' },
      responseData: expect.objectContaining({ make: 'Honda', vinValid: true }),
    })
  )
  // Response includes vehicle data from memory
  expect(data.report.vehicle_data).toMatchObject({ make: 'Honda', model: 'Accord' })
})

it('logs failure and continues when Auto.dev fails', async () => {
  mockFetchAutoDevVinDecode.mockResolvedValue({ success: false, error: 'timeout' })

  const response = await POST(
    makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' })
  )
  expect(response.status).toBe(200)
  expect(mockLogApiCall).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'autodev',
      success: false,
      errorMessage: 'timeout',
    })
  )
})

it('does not call fetch() for marketcheck/valuation', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch')
  await POST(makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' }))
  const marketCheckCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('marketcheck'))
  expect(marketCheckCalls).toHaveLength(0)
  fetchSpy.mockRestore()
})

describe('Lead capture', () => {
  it('calls upsert_lead RPC with form_submitted when email is provided', async () => {
    const req = new Request('http://localhost/api/reports/create-anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vin: '1HGCM82633A004352',
        mileage: 50000,
        zipCode: '90210',
        email: 'user@example.com',
      }),
    })
    await POST(req)
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'form_submitted',
    })
  })

  it('does NOT call upsert_lead when no email is provided', async () => {
    const req = new Request('http://localhost/api/reports/create-anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vin: '1HGCM82633A004352',
        mileage: 50000,
        zipCode: '90210',
      }),
    })
    await POST(req)
    expect((supabaseAdmin as any).rpc).not.toHaveBeenCalledWith('upsert_lead', expect.anything())
  })

  it('still creates the report even if lead capture fails', async () => {
    ;(supabaseAdmin as any).rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'RPC error' } })

    const req = new Request('http://localhost/api/reports/create-anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vin: '1HGCM82633A004352',
        mileage: 50000,
        zipCode: '90210',
        email: 'user@example.com',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

describe('attribution (N5)', () => {
  it('stores source and kb_source_slug on the reports insert when provided', async () => {
    await POST(
      makeRequest({
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zipCode: '10001',
        source: 'homepage',
      })
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'homepage', kb_source_slug: null })
    )
  })

  it('stores kb_source_slug when provided alongside source', async () => {
    await POST(
      makeRequest({
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zipCode: '10001',
        source: 'kb_article',
        kbSourceSlug: 'pennsylvania-total-loss-law',
      })
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'kb_article',
        kb_source_slug: 'pennsylvania-total-loss-law',
      })
    )
  })

  it('passes source and kbSourceSlug into upsertLead when an email is provided', async () => {
    await POST(
      makeRequest({
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zipCode: '10001',
        email: 'shopper@example.com',
        source: 'kb_article',
        kbSourceSlug: 'pennsylvania-total-loss-law',
      })
    )
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'shopper@example.com',
      p_lead_type: 'form_submitted',
      p_source: 'kb_article',
      p_kb_source_slug: 'pennsylvania-total-loss-law',
      p_utm_source: undefined,
      p_utm_medium: undefined,
      p_utm_campaign: undefined,
    })
  })

  it('does not call upsertLead when no email is provided, regardless of attribution', async () => {
    await POST(
      makeRequest({
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zipCode: '10001',
        source: 'homepage',
      })
    )
    expect((supabaseAdmin as any).rpc).not.toHaveBeenCalled()
  })
})
