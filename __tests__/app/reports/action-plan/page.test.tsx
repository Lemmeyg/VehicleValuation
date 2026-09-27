jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))

const supabaseFromMock = jest.fn()
jest.mock('@/lib/db/supabase', () => ({ supabaseAdmin: { from: supabaseFromMock } }))
jest.mock('@/lib/utils/report-access', () => ({ canViewReport: jest.fn(() => true) }))
jest.mock('@/app/reports/[id]/action-plan/PrintChecklistButton', () => ({
  PrintChecklistButton: () => null,
}))
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
  autodev_vin_data: { make: 'Honda', model: 'Civic', vehicle: { year: 2020 } },
  status: 'pending',
  pdf_download_token: null,
}

const getActionPlanPage = () => import('@/app/reports/[id]/action-plan/page').then(m => m.default)

describe('Action-plan page — gating (PRD §9.5)', () => {
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
    })

    const ActionPlanPage = await getActionPlanPage()
    await expect(
      ActionPlanPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/reports/report-1/view')
  })

  it('shows the ExpiredScreen for an expired token', async () => {
    ;(getUser as jest.Mock).mockResolvedValue(null)
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { access_token: 'real-token', access_token_expires_at: '2020-01-01T00:00:00Z' },
        error: null,
      }),
    })

    const ActionPlanPage = await getActionPlanPage()
    const result = await ActionPlanPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({ token: 'real-token' }),
    })
    render(result as React.ReactElement)

    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
  })

  it('renders normally when the report is completed', async () => {
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { ...validReport, status: 'completed', pdf_download_token: 'tok-1' },
        error: null,
      }),
    })

    const ActionPlanPage = await getActionPlanPage()
    const result = await ActionPlanPage({
      params: Promise.resolve({ id: 'report-1' }),
      searchParams: Promise.resolve({}),
    })

    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
