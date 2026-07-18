jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))

jest.mock('@/lib/db/auth', () => ({
  getUser: jest.fn(),
}))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({ from: supabaseFromMock }),
  supabaseAdmin: { from: jest.fn() },
}))

jest.mock('@/app/reports/[id]/success/RedditPurchaseTracker', () => ({
  RedditPurchaseTracker: () => null,
}))
jest.mock('@/app/reports/[id]/success/PostHogPurchaseTracker', () => ({
  PostHogPurchaseTracker: (props: { planType: string }) => (
    <div data-testid="posthog-tracker" data-plan-type={props.planType} />
  ),
}))
jest.mock('@/app/reports/[id]/success/ReportReadyPoller', () => ({
  ReportReadyPoller: () => null,
}))
jest.mock('@/app/reports/[id]/success/AuthenticatedPaymentPoller', () => ({
  AuthenticatedPaymentPoller: () => null,
}))

jest.mock('next/link', () => {
  return function MockLink({ children }: { children: React.ReactNode }) {
    return children
  }
})

import { render, screen } from '@testing-library/react'
import { getUser } from '@/lib/db/auth'

const baseReport = {
  id: 'report-1',
  vin: '1HGBH41JXMN109186',
  status: 'complete',
}

const getSuccessPage = () => import('@/app/reports/[id]/success/page').then(m => m.default)

// reports.select('*').eq('id',..).eq('user_id',..).single()
// payments.select('metadata').eq('report_id',..).eq('status','succeeded').order(..).limit(1).maybeSingle()
function mockSupabaseFrom(reportRow: Record<string, unknown>, paymentReportType: string | null) {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'reports') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
      }
    }
    if (table === 'payments') {
      const paymentData = paymentReportType ? { metadata: { reportType: paymentReportType } } : null
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: paymentData, error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('Payment success page — money-back guarantee', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'buyer@example.com' })
  })

  it('does NOT render the guarantee card for a Basic report (real $19 price_paid, payment metadata BASIC)', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 1900 }, 'BASIC')

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByText(/100% Money-Back Guarantee/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Basic Report/i)).toBeInTheDocument()
  })

  it('renders the guarantee card for a Premium report (real $25+tax price_paid, payment metadata PREMIUM)', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 2650 }, 'PREMIUM')

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/100% Money-Back Guarantee/i)).toBeInTheDocument()
    expect(screen.getByText(/Premium Report/i)).toBeInTheDocument()
  })

  it('does NOT render the guarantee card when payment metadata has no reportType (e.g. admin free report)', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 0 }, null)

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.queryByText(/100% Money-Back Guarantee/i)).not.toBeInTheDocument()
  })

  it('passes the correct planType to PostHogPurchaseTracker for a Basic report', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 1900 }, 'BASIC')

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('posthog-tracker')).toHaveAttribute('data-plan-type', 'basic')
  })

  it('passes the correct planType to PostHogPurchaseTracker for a Premium report', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 2650 }, 'PREMIUM')

    const SuccessPage = await getSuccessPage()
    const result = await SuccessPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('posthog-tracker')).toHaveAttribute('data-plan-type', 'premium')
  })
})
