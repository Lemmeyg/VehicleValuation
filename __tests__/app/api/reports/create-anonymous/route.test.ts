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
const mockMaybeSingle = jest.fn()
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

  mockMaybeSingle.mockResolvedValue({ data: null, error: null }) // no duplicate
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
  mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle })
  ;(supabaseAdmin as any).from = jest.fn((table: string) => {
    if (table === 'reports') return { select: mockSelect, insert: mockInsert, update: mockUpdate }
    return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) }
  })

  mockFetchAutoDevVinDecode.mockResolvedValue({ success: true, data: mockAutoDevData })
  mockLogApiCall.mockResolvedValue(undefined)
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
