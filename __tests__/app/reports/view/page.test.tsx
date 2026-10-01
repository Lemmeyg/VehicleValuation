jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: supabaseFromMock },
}))

jest.mock('@/lib/utils/report-access', () => ({
  canViewReport: jest.fn(() => true),
  getPaymentGateStatus: jest.fn(() => 'allowed'),
}))
jest.mock('@/components/MarketCharts', () => ({ MarketCharts: () => null }))
jest.mock('@/components/ReportViewTracker', () => ({ ReportViewTracker: () => null }))
jest.mock('@/app/reports/[id]/view/print-pdf-buttons', () => ({ PrintPdfButtons: () => null }))
jest.mock('@/app/reports/[id]/view/TokenAccessBanner', () => ({ TokenAccessBanner: () => null }))
jest.mock('@/app/reports/[id]/view/PurchaseCompleteTracker', () => ({
  PurchaseCompleteTracker: (props: {
    reportId: string
    planType: string
    amountCents: number
    transactionId?: string
    email?: string
    vin?: string
    userId?: string
  }) => (
    <div
      data-testid="purchase-complete-tracker"
      data-plan-type={props.planType}
      data-user-id={props.userId ?? ''}
      data-email={props.email ?? ''}
    />
  ),
}))
jest.mock('@/app/reports/[id]/view/RedditPurchaseTracker', () => ({
  RedditPurchaseTracker: (props: { value: number; currency: string; transactionId?: string }) => (
    <div data-testid="reddit-purchase-tracker" data-value={props.value} />
  ),
}))
jest.mock('@/app/reports/[id]/view/PaymentConfirmationWatcher', () => ({
  PaymentConfirmationWatcher: () => null,
}))
jest.mock('@/app/reports/[id]/view/screens/ProgressHeldGate', () => ({
  ProgressHeldGate: ({ initialState }: { initialState: string }) => (
    <div data-testid="progress-held-gate" data-initial-state={initialState} />
  ),
}))
jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})
jest.mock('next/image', () => {
  return function MockImage() {
    return null
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'

const baseReport = {
  id: 'report-1',
  user_id: 'user-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  zip_code: '90210',
  price_paid: 2900,
  created_at: '2026-09-20T12:00:00Z',
  paid_at: '2026-09-26T12:00:00Z',
  access_token: null,
  access_token_expires_at: null,
  autodev_vin_data: { make: 'Honda', model: 'CR-V', vehicle: { year: 2019 } },
  marketcheck_valuation: null,
  pdf_download_token: null,
}

function mockSupabase(
  reportRow: Record<string, unknown>,
  paymentRow: Record<string, unknown> | null = {
    id: 'pay-1',
    amount: 2900,
    stripe_payment_id: 'order-1',
    metadata: { reportType: 'BASIC' },
  }
) {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'reports') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
        update: jest.fn().mockReturnThis(),
      }
    }
    if (table === 'payments') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: paymentRow, error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

const getViewPage = () => import('@/app/reports/[id]/view/page').then(m => m.default)

describe('Report view page — gating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
  })

  it('shows the ProgressHeldGate with initialState progress for a pending report, never the report content', async () => {
    mockSupabase({ ...baseReport, status: 'pending', marketcheck_valuation: null })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('progress-held-gate')).toHaveAttribute(
      'data-initial-state',
      'progress'
    )
    expect(screen.queryByText(/vehicle specifications/i)).not.toBeInTheDocument()
  })

  it('shows the ProgressHeldGate with initialState held for a needs_review report, even with valuation data saved', async () => {
    mockSupabase({
      ...baseReport,
      status: 'needs_review',
      marketcheck_valuation: {
        predictedPrice: 25000,
        recentComparables: { listings: [{ vin: 'X', price: 25000, miles: 1 }] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('progress-held-gate')).toHaveAttribute('data-initial-state', 'held')
    expect(screen.queryByText(/vehicle specifications/i)).not.toBeInTheDocument()
    expect(screen.queryByText('25000')).not.toBeInTheDocument()
  })

  it('shows the RefundedScreen for a refunded report', async () => {
    mockSupabase({ ...baseReport, status: 'refunded' })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this order was refunded/i)).toBeInTheDocument()
  })

  it('shows the full report content for a completed report with a pdf_download_token', async () => {
    mockSupabase({
      ...baseReport,
      status: 'completed',
      pdf_download_token: 'tok-1',
      marketcheck_valuation: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { listings: [] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/vehicle specifications/i)).toBeInTheDocument()
    expect(screen.queryByTestId('progress-held-gate')).not.toBeInTheDocument()
  })

  it('does NOT show the full report content for a completed report with no pdf_download_token yet', async () => {
    mockSupabase({
      ...baseReport,
      status: 'completed',
      pdf_download_token: null,
      marketcheck_valuation: { predictedPrice: 25000, recentComparables: { listings: [] } },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByText(/vehicle specifications/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('progress-held-gate')).toBeInTheDocument()
  })

  it('lets an admin see the full report content for a held report (existing behavior, preserved)', async () => {
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'admin-1', user_metadata: { is_admin: true } })
    mockSupabase({
      ...baseReport,
      user_id: 'someone-else',
      status: 'needs_review',
      marketcheck_valuation: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { listings: [] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/vehicle specifications/i)).toBeInTheDocument()
  })

  it('fires purchase trackers for a token-access (anonymous) buyer with checkout=complete', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    mockSupabase({
      ...baseReport,
      user_id: null,
      email: 'buyer@example.com',
      access_token: 'tok-abc',
      access_token_expires_at: '2099-01-01T00:00:00Z',
      status: 'pending',
    })

    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'tok-abc', checkout: 'complete' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('purchase-complete-tracker')).toHaveAttribute(
      'data-email',
      'buyer@example.com'
    )
    expect(screen.getByTestId('purchase-complete-tracker')).toHaveAttribute('data-user-id', '')
    expect(screen.getByTestId('reddit-purchase-tracker')).toBeInTheDocument()
  })

  it('fires purchase trackers with userId for an authenticated buyer with no token and checkout=complete (identifyUser linking, PRD §10)', async () => {
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', user_metadata: {} })
    mockSupabase({ ...baseReport, status: 'pending' })

    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ checkout: 'complete' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('purchase-complete-tracker')).toHaveAttribute(
      'data-user-id',
      'user-1'
    )
  })

  it('does not fire purchase trackers when checkout=complete is absent', async () => {
    mockSupabase({ ...baseReport, status: 'pending' })

    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByTestId('purchase-complete-tracker')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reddit-purchase-tracker')).not.toBeInTheDocument()
  })

  it('shows the ExpiredScreen for an anonymous buyer whose access token has expired', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    mockSupabase({
      access_token: 'real-token',
      access_token_expires_at: '2020-01-01T00:00:00Z',
    })

    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'real-token' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
  })

  it('tells an anonymous (token-access) buyer their link is available for 7 days, on a ready report', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    mockSupabase({
      ...baseReport,
      user_id: null,
      status: 'completed',
      pdf_download_token: 'tok-1',
      access_token: 'tok-abc',
      access_token_expires_at: '2099-01-01T00:00:00Z',
      marketcheck_valuation: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { listings: [] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'tok-abc' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/available here for 7 days/i)).toBeInTheDocument()
  })

  it('does not show the 7-day expiry notice for a logged-in buyer (their page access never expires)', async () => {
    mockSupabase({
      ...baseReport,
      status: 'completed',
      pdf_download_token: 'tok-1',
      marketcheck_valuation: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { listings: [] },
      },
    })
    const ViewPage = await getViewPage()
    const result = await ViewPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByText(/available here for 7 days/i)).not.toBeInTheDocument()
  })
})
