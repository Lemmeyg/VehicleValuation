/**
 * @jest-environment node
 */
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/zoho-campaigns', () => ({
  addContactToList: jest.fn().mockResolvedValue(true),
}))

import { supabaseAdmin } from '@/lib/db/supabase'
import { addContactToList } from '@/lib/zoho-campaigns'
import { NextRequest } from 'next/server'

const mockAddContactToList = addContactToList as jest.Mock

const CRON_SECRET = 'test-cron-secret'
const ORIG_SECRET = process.env.CRON_SECRET
const ORIG_LIST_KEY = process.env.ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY

function makeRequest(secret = CRON_SECRET) {
  return new NextRequest('https://www.totallosstoolkit.com/api/cron/abandoned-report-recovery', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQueryChain(resolvedData: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  chain.select = jest.fn(() => chain)
  chain.is = jest.fn(() => chain)
  chain.not = jest.fn(() => chain)
  chain.lte = jest.fn(() => chain)
  chain.gte = jest.fn(() => chain)
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: resolvedData, error: null }).then(resolve),
    configurable: true,
  })
  return chain
}

function makeUpdateChain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  chain.eq = jest.fn(() => chain)
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    configurable: true,
  })
  return chain
}

describe('GET /api/cron/abandoned-report-recovery', () => {
  let mockFrom: jest.Mock
  let mockUpdate: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    process.env.ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY = 'abandoned-list-key'
    mockAddContactToList.mockResolvedValue(true)

    mockUpdate = jest.fn(() => makeUpdateChain())
    mockFrom = jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).from = mockFrom
  })

  afterEach(() => {
    if (ORIG_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIG_SECRET
    if (ORIG_LIST_KEY === undefined) delete process.env.ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY
    else process.env.ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY = ORIG_LIST_KEY
  })

  it('returns 401 when Authorization header is missing', async () => {
    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const req = new NextRequest(
      'https://www.totallosstoolkit.com/api/cron/abandoned-report-recovery'
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET does not match', async () => {
    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with enrolled:0 when no abandoned reports are found', async () => {
    mockFrom.mockReturnValue({ ...makeQueryChain([]), update: mockUpdate })
    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enrolled).toBe(0)
  })

  it('enrolls an abandoned report with Year/Make/Model and marks it flagged', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2019,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: {
        Year: '2019',
        Make: 'Honda',
        Model: '2019 Honda Civic',
        ReportId: 'report-1',
      },
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ abandoned_recovery_sent_at: expect.any(String) })
    )
    const body = await res.json()
    expect(body.enrolled).toBe(1)
  })

  it('falls back to "your vehicle" for Model and empty strings for Year/Make when decode data is missing', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: null,
      vehicle_make: null,
      vehicle_model: null,
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    await GET(makeRequest())

    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: { Year: '', Make: '', Model: 'your vehicle', ReportId: 'report-1' },
    })
  })

  it('falls back to "your vehicle" when only some decode fields are present', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2019,
      vehicle_make: null,
      vehicle_model: null,
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    await GET(makeRequest())

    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: { Year: '2019', Make: '', Model: 'your vehicle', ReportId: 'report-1' },
    })
  })

  it('continues processing other reports if one enrollment throws', async () => {
    const reports = [
      {
        id: 'report-1',
        email: 'fail@example.com',
        vehicle_year: 2019,
        vehicle_make: 'Honda',
        vehicle_model: 'Civic',
      },
      {
        id: 'report-2',
        email: 'ok@example.com',
        vehicle_year: 2020,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
      },
    ]
    mockFrom.mockImplementation(() => ({ ...makeQueryChain(reports), update: mockUpdate }))
    mockAddContactToList.mockRejectedValueOnce(new Error('Zoho down')).mockResolvedValueOnce(true)

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledTimes(2)
    const body = await res.json()
    expect(body.enrolled).toBe(1) // only the successful one counted
  })

  it('returns enrolled:0 without calling Zoho when the list key env var is missing', async () => {
    delete process.env.ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2019,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())

    expect(mockAddContactToList).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.enrolled).toBe(0)
  })

  it('does not update the DB or count the report when addContactToList resolves false', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2019,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))
    mockAddContactToList.mockResolvedValueOnce(false)

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.enrolled).toBe(0)
  })

  it('does not count a report as enrolled if the update call returns an error', async () => {
    const reports = [
      {
        id: 'report-1',
        email: 'error@example.com',
        vehicle_year: 2019,
        vehicle_make: 'Honda',
        vehicle_model: 'Civic',
      },
      {
        id: 'report-2',
        email: 'ok@example.com',
        vehicle_year: 2020,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
      },
    ]
    mockFrom.mockImplementation(() => ({ ...makeQueryChain(reports), update: mockUpdate }))

    function makeUpdateChainWithError(shouldError: boolean) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {}
      chain.eq = jest.fn(() => chain)
      Object.defineProperty(chain, 'then', {
        get: () => (resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: null,
            error: shouldError ? { message: 'DB constraint violation' } : null,
          }).then(resolve),
        configurable: true,
      })
      return chain
    }

    let updateCallCount = 0
    mockUpdate.mockImplementation(() => {
      const shouldError = updateCallCount === 0
      updateCallCount++
      return makeUpdateChainWithError(shouldError)
    })

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledTimes(2)
    const body = await res.json()
    expect(body.enrolled).toBe(1) // only the second report (with successful update) counted
  })
})
