jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({ supabaseAdmin: { from: supabaseFromMock } }))
jest.mock('@/lib/utils/report-access', () => ({ canViewReport: jest.fn(() => true) }))
jest.mock('@/lib/utils/listing-filters', () => ({
  getLowestDOSActiveListings: jest.fn(() => []),
  getListingsStats: jest.fn(() => ({ count: 0 })),
}))
jest.mock('@/app/reports/[id]/print/PrintToolbar', () => ({ PrintToolbar: () => null }))
jest.mock('@/components/MarketCharts', () => ({ MarketCharts: () => null }))
jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'
import { redirect } from 'next/navigation'
import { canViewReport } from '@/lib/utils/report-access'

const validReport = {
  id: 'report-1',
  user_id: 'user-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  price_paid: 4900,
  created_at: '2026-06-01T12:00:00Z',
  autodev_vin_data: { make: 'Honda', model: 'Civic', vehicle: { year: 2020 } },
  marketcheck_valuation: null,
  status: 'pending',
  pdf_download_token: null,
}

const getPrintPage = () => import('@/app/reports/[id]/print/page').then(m => m.default)

describe('Print page — gating (PRD §9.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
    ;(canViewReport as jest.Mock).mockImplementation(() => true)
  })

  it('redirects to /view when the report is not completed', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: validReport, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
    })

    const PrintPage = await getPrintPage()
    await expect(
      PrintPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/reports/report-1/view')
  })

  it('shows the ExpiredScreen (not a redirect to /auth) for an expired token', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { access_token: 'real-token', access_token_expires_at: '2020-01-01T00:00:00Z' },
        error: null,
      }),
    })

    const PrintPage = await getPrintPage()
    const result = await PrintPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'real-token' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
  })

  it('renders normally when the report is completed with a pdf_download_token', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { ...validReport, status: 'completed', pdf_download_token: 'tok-1' },
        error: null,
      }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
    })

    const PrintPage = await getPrintPage()
    const result = await PrintPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })

    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
