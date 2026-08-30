const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({
  // The page uses the service-role client (`supabaseAdmin`) so it can read any
  // user's report past RLS — not `createServerSupabaseClient()`.
  supabaseAdmin: { from: supabaseFromMock },
  createServerSupabaseClient: jest.fn().mockResolvedValue({ from: supabaseFromMock }),
}))

jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
}))

import { render, screen } from '@testing-library/react'

const baseReport = {
  id: 'report-1',
  vin: '1HGBH41JXMN109186',
  status: 'completed',
  created_at: '2026-07-01T12:00:00Z',
  user_id: 'user-1',
  vehicle_data: null,
  accident_details: null,
  valuation_result: null,
  pdf_url: null,
}

const getAdminReportPage = () => import('@/app/admin/reports/[id]/page').then(m => m.default)

// reports.select('*').eq('id',..).single()
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

describe('Admin report details page — tier label', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows "Basic Report" for a Basic-tier payment, regardless of exact price_paid', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 1900 }, 'BASIC')

    const AdminReportPage = await getAdminReportPage()
    const result = await AdminReportPage({ params: Promise.resolve({ id: 'report-1' }) })
    render(result as React.ReactElement)

    expect(screen.getByText(/Basic Report/i)).toBeInTheDocument()
    expect(screen.queryByText(/Premium Report/i)).not.toBeInTheDocument()
  })

  it('shows "Premium Report" for a Premium-tier payment, regardless of exact price_paid', async () => {
    mockSupabaseFrom({ ...baseReport, price_paid: 2650 }, 'PREMIUM')

    const AdminReportPage = await getAdminReportPage()
    const result = await AdminReportPage({ params: Promise.resolve({ id: 'report-1' }) })
    render(result as React.ReactElement)

    expect(screen.getByText(/Premium Report/i)).toBeInTheDocument()
    expect(screen.queryByText(/Basic Report/i)).not.toBeInTheDocument()
  })
})
