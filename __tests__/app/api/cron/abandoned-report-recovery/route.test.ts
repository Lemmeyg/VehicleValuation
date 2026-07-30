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
// .env.test sets NEXT_PUBLIC_APP_URL=http://localhost:3000 for all Jest suites (loaded via
// next/jest). buildKbArticleUrl falls back to the production URL only when this var is unset,
// so it must be cleared here — same workaround already used in kb-article-url.test.ts — to keep
// the exact-match assertions below stable against the real https://www.totallosstoolkit.com URLs.
const ORIG_APP_URL = process.env.NEXT_PUBLIC_APP_URL

const PILLAR_URL =
  'https://www.totallosstoolkit.com/knowledge-base/vehicle-owners-guide-to-total-loss'

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
    delete process.env.NEXT_PUBLIC_APP_URL
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
    if (ORIG_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = ORIG_APP_URL
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

  it('enrolls an abandoned report with Year/Make/Model/state/vehicle-guide fields and marks it flagged', async () => {
    // vehicle_year 2010 is deliberately far enough in the past to stay in the
    // "Older" bucket indefinitely (age > 9 for the foreseeable future),
    // keeping this exact-match assertion stable regardless of when the suite runs.
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2010,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      zip_code: '19104',
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: {
        Year: '2010',
        Make: 'Honda',
        Model: '2010 Honda Civic',
        ReportId: 'report-1',
        StateArticleURL:
          'https://www.totallosstoolkit.com/knowledge-base/pennsylvania-total-loss-law-explained?utm_source=zoho&utm_medium=email&utm_content=state_article',
        StateName: 'Pennsylvania',
        VehicleGuideURL: `${PILLAR_URL.replace('vehicle-owners-guide-to-total-loss', 'should-you-buy-back-your-totaled-car-hidden-costs')}?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide`,
      },
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        abandoned_recovery_sent_at: expect.any(String),
        state_article_url:
          'https://www.totallosstoolkit.com/knowledge-base/pennsylvania-total-loss-law-explained?utm_source=zoho&utm_medium=email&utm_content=state_article',
        state_name: 'Pennsylvania',
        vehicle_guide_url: `${PILLAR_URL.replace('vehicle-owners-guide-to-total-loss', 'should-you-buy-back-your-totaled-car-hidden-costs')}?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide`,
      })
    )
    const body = await res.json()
    expect(body.enrolled).toBe(1)
  })

  it('reuses state_article_url/state_name/vehicle_guide_url already computed at submission time instead of recomputing', async () => {
    // These values deliberately do NOT match what the ZIP/vehicle_year would
    // resolve to (ZIP 19104 is Pennsylvania) — proving the route used the
    // stored values as-is rather than recomputing from zip_code/vehicle_year.
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2010,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      zip_code: '19104',
      state_article_url: 'https://www.totallosstoolkit.com/knowledge-base/stored-value-test',
      state_name: 'Stored State',
      vehicle_guide_url: 'https://www.totallosstoolkit.com/knowledge-base/stored-guide-test',
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    await GET(makeRequest())

    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: expect.objectContaining({
        StateArticleURL: 'https://www.totallosstoolkit.com/knowledge-base/stored-value-test',
        StateName: 'Stored State',
        VehicleGuideURL: 'https://www.totallosstoolkit.com/knowledge-base/stored-guide-test',
      }),
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        state_article_url: 'https://www.totallosstoolkit.com/knowledge-base/stored-value-test',
        state_name: 'Stored State',
        vehicle_guide_url: 'https://www.totallosstoolkit.com/knowledge-base/stored-guide-test',
      })
    )
  })

  it('persists the fallback pillar URLs and "your state" on the reports row when ZIP data is missing', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: null,
      vehicle_make: null,
      vehicle_model: null,
      zip_code: null,
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    await GET(makeRequest())

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        state_article_url: `${PILLAR_URL}?utm_source=zoho&utm_medium=email&utm_content=state_article`,
        state_name: 'your state',
        vehicle_guide_url: `${PILLAR_URL}?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide`,
      })
    )
  })

  it('falls back to pillar URLs and "your state"/"your vehicle" when decode and ZIP data are missing', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: null,
      vehicle_make: null,
      vehicle_model: null,
      zip_code: null,
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    await GET(makeRequest())

    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: {
        Year: '',
        Make: '',
        Model: 'your vehicle',
        ReportId: 'report-1',
        StateArticleURL: `${PILLAR_URL}?utm_source=zoho&utm_medium=email&utm_content=state_article`,
        StateName: 'your state',
        VehicleGuideURL: `${PILLAR_URL}?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide`,
      },
    })
  })

  it('falls back to "your vehicle" for Model when only some decode fields are present, but still resolves a real state/vehicle-year link', async () => {
    const report = {
      id: 'report-1',
      email: 'user@example.com',
      vehicle_year: 2010,
      vehicle_make: null,
      vehicle_model: null,
      zip_code: '44101', // Ohio
    }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
    await GET(makeRequest())

    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'abandoned-list-key',
      email: 'user@example.com',
      customFields: {
        Year: '2010',
        Make: '',
        Model: 'your vehicle',
        ReportId: 'report-1',
        StateArticleURL:
          'https://www.totallosstoolkit.com/knowledge-base/ohio-total-loss-law-explained?utm_source=zoho&utm_medium=email&utm_content=state_article',
        StateName: 'Ohio',
        VehicleGuideURL: `${PILLAR_URL.replace('vehicle-owners-guide-to-total-loss', 'should-you-buy-back-your-totaled-car-hidden-costs')}?utm_source=zoho&utm_medium=email&utm_content=vehicle_guide`,
      },
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
        zip_code: '19104',
      },
      {
        id: 'report-2',
        email: 'ok@example.com',
        vehicle_year: 2020,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        zip_code: '44101',
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
      zip_code: '19104',
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
      zip_code: '19104',
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
        zip_code: '19104',
      },
      {
        id: 'report-2',
        email: 'ok@example.com',
        vehicle_year: 2020,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        zip_code: '44101',
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
