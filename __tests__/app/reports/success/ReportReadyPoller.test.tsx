/**
 * ReportReadyPoller Component Tests
 *
 * Verifies the polling loop and redirect behavior
 */
import { render, screen, act, waitFor } from '@testing-library/react'
import { ReportReadyPoller } from '@/app/reports/[id]/success/ReportReadyPoller'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

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

    render(<ReportReadyPoller reportId="test-report-id" />)

    expect(screen.getByText(/Processing|Fetching|valuation/i)).toBeInTheDocument()
  })

  it('redirects to /view when status is ready', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ready: true }),
    })

    render(<ReportReadyPoller reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(2100)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/reports/report-abc/view')
    })
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

    render(<ReportReadyPoller reportId="report-abc" />)

    // Advance through 3 polling cycles
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

    render(<ReportReadyPoller reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(62000)
    })

    await waitFor(() => {
      expect(screen.getByText(/Taking Longer Than Expected/i)).toBeInTheDocument()
    })
  })
})
