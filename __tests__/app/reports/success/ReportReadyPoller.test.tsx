/**
 * ReportReadyPoller Component Tests
 *
 * Verifies the polling loop, redirect behavior, and account setup form.
 */
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import * as events from '@/lib/analytics/events'
import { ReportReadyPoller } from '@/app/reports/[id]/success/ReportReadyPoller'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackReportWorkflow: jest.fn(),
  trackPaymentSuccess: jest.fn(),
  identifyUser: jest.fn(),
}))

const mockEvents = events as jest.Mocked<typeof events>

// fetch is mocked globally in setup.ts — we override per test
const mockFetch = global.fetch as jest.Mock

describe('ReportReadyPoller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows processing message initially', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: false }),
    })

    render(<ReportReadyPoller reportId="test-report-id" checkoutEmail={null} pricePaid={null} />)

    expect(screen.getByText(/Processing|Fetching|valuation/i)).toBeInTheDocument()
  })

  it('redirects to /view when ready and no checkoutEmail (authenticated user)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: true }),
    })

    render(<ReportReadyPoller reportId="report-abc" checkoutEmail={null} pricePaid={null} />)

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/reports/report-abc/view')
    })
  })

  it('shows account setup form when ready and checkoutEmail is provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: true }),
    })

    render(
      <ReportReadyPoller reportId="report-abc" checkoutEmail="buyer@example.com" pricePaid={4900} />
    )

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(screen.getByText(/Your report is ready/i)).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('buyer@example.com')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('continues polling when not ready', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      return {
        ok: true,
        json: async () => ({ ready: callCount >= 3 }),
      }
    })

    render(<ReportReadyPoller reportId="report-abc" checkoutEmail={null} pricePaid={null} />)

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })
    await act(async () => {
      jest.advanceTimersByTime(2000)
    })
    await act(async () => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/reports/report-abc/view')
    })
  })

  it('shows timeout message after 30 failed polls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: false }),
    })

    render(<ReportReadyPoller reportId="report-abc" checkoutEmail={null} pricePaid={null} />)

    await act(async () => {
      jest.advanceTimersByTime(62000)
    })

    await waitFor(() => {
      expect(screen.getByText(/Taking Longer Than Expected/i)).toBeInTheDocument()
    })
  })

  it('shows magic-link-sent state after clicking email link button', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ready: true }) }) // poll
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // magic-link request

    render(
      <ReportReadyPoller reportId="report-abc" checkoutEmail="buyer@example.com" pricePaid={4900} />
    )

    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    await waitFor(() => screen.getByText(/Your report is ready/i))

    const magicLinkBtn = screen.getByText(/Email me a sign-in link/i)
    await act(async () => {
      fireEvent.click(magicLinkBtn)
    })

    await waitFor(() => {
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument()
    })
  })

  it('identifies the buyer in PostHog by email once payment is confirmed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ready: true,
        pricePaid: 4900,
        email: 'buyer@example.com',
        vin: '1HGCM82633A123456',
      }),
    })

    render(
      <ReportReadyPoller reportId="report-abc" checkoutEmail="buyer@example.com" pricePaid={4900} />
    )

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(mockEvents.identifyUser).toHaveBeenCalledWith('buyer@example.com', {
        email: 'buyer@example.com',
        vin: '1HGCM82633A123456',
        plan: 'premium',
      })
    })
  })
})
