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
const ORIG_LIST_KEY = process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY

function makeRequest(secret = CRON_SECRET) {
  return new NextRequest('https://www.totallosstoolkit.com/api/cron/dispute-letter-recovery', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQueryChain(resolvedData: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  chain.select = jest.fn(() => chain)
  chain.eq = jest.fn(() => chain)
  chain.is = jest.fn(() => chain)
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

describe('GET /api/cron/dispute-letter-recovery', () => {
  let mockFrom: jest.Mock
  let mockUpdate: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY = 'dispute-letter-list-key'
    mockAddContactToList.mockResolvedValue(true)

    mockUpdate = jest.fn(() => makeUpdateChain())
    mockFrom = jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).from = mockFrom
  })

  afterEach(() => {
    if (ORIG_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIG_SECRET
    if (ORIG_LIST_KEY === undefined) delete process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY
    else process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY = ORIG_LIST_KEY
  })

  it('returns 401 when Authorization header is missing', async () => {
    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const req = new NextRequest('https://www.totallosstoolkit.com/api/cron/dispute-letter-recovery')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET does not match', async () => {
    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with enrolled:0 when no unenrolled dispute_letter leads are found', async () => {
    mockFrom.mockReturnValue({ ...makeQueryChain([]), update: mockUpdate })
    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enrolled).toBe(0)
  })

  it('enrolls an unflagged dispute_letter lead and stamps it', async () => {
    const lead = { email: 'user@example.com' }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([lead]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'dispute-letter-list-key',
      email: 'user@example.com',
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ dispute_letter_zoho_enrolled_at: expect.any(String) })
    )
    const body = await res.json()
    expect(body.enrolled).toBe(1)
  })

  it('does not stamp the row and does not count it when addContactToList returns false', async () => {
    const lead = { email: 'user@example.com' }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([lead]), update: mockUpdate }))
    mockAddContactToList.mockResolvedValueOnce(false)

    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const res = await GET(makeRequest())

    expect(mockUpdate).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.enrolled).toBe(0)
  })

  it('continues processing other leads if one enrollment throws', async () => {
    const leads = [{ email: 'fail@example.com' }, { email: 'ok@example.com' }]
    mockFrom.mockImplementation(() => ({ ...makeQueryChain(leads), update: mockUpdate }))
    mockAddContactToList.mockRejectedValueOnce(new Error('unexpected')).mockResolvedValueOnce(true)

    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(mockAddContactToList).toHaveBeenCalledTimes(2)
    const body = await res.json()
    expect(body.enrolled).toBe(1)
  })

  it('returns enrolled:0 without calling Zoho when the list key env var is missing', async () => {
    delete process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY
    const lead = { email: 'user@example.com' }
    mockFrom.mockImplementation(() => ({ ...makeQueryChain([lead]), update: mockUpdate }))

    const { GET } = await import('@/app/api/cron/dispute-letter-recovery/route')
    const res = await GET(makeRequest())

    expect(mockAddContactToList).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.enrolled).toBe(0)
  })
})
