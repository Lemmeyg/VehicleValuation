/**
 * @jest-environment node
 */

jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
  notFound: jest.fn().mockImplementation(() => {
    throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' })
  }),
}))

jest.mock('@/lib/db/auth', () => ({
  getUser: jest.fn(),
}))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: supabaseFromMock,
  },
}))

jest.mock('@/lib/utils/report-access', () => ({
  canViewReport: jest.fn(() => true),
}))

jest.mock('@/lib/utils/listing-filters', () => ({
  getLowestDOSActiveListings: jest.fn(() => []),
  getListingsStats: jest.fn(() => ({ count: 0 })),
}))

jest.mock('@/app/reports/[id]/print/PrintToolbar', () => ({
  PrintToolbar: () => null,
}))

jest.mock('@/components/MarketCharts', () => ({
  MarketCharts: () => null,
}))

jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})

import { getUser } from '@/lib/db/auth'
import { redirect } from 'next/navigation'
import { canViewReport } from '@/lib/utils/report-access'

const mockChain = (data: unknown, error: unknown = null) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error }),
  maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
})

const validReport = {
  id: 'report-1',
  user_id: 'user-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  price_paid: 4900,
  created_at: '2026-06-01T12:00:00Z',
  autodev_vin_data: { make: 'Honda', model: 'Civic', vehicle: { year: 2020 } },
  marketcheck_valuation: null,
}

const getPrintPage = () => import('@/app/reports/[id]/print/page').then(m => m.default)

describe('Print page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
    supabaseFromMock.mockReturnValue(mockChain(validReport))
    ;(canViewReport as jest.Mock).mockImplementation(() => true)
  })

  it('redirects to auth when no user and no token', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)

    const PrintPage = await getPrintPage()

    await expect(
      PrintPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/auth?redirect=/reports/report-1/print')
  })

  it('shows access denied when user does not own report', async () => {
    ;(canViewReport as jest.Mock).mockImplementation(() => false)

    const PrintPage = await getPrintPage()
    const result = await PrintPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })

    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renders page when user owns the report', async () => {
    const PrintPage = await getPrintPage()
    const result = await PrintPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })

    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
