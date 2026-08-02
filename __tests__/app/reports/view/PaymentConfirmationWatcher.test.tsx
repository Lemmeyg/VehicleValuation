import { render, screen, act, waitFor } from '@testing-library/react'
import { PaymentConfirmationWatcher } from '@/app/reports/[id]/view/PaymentConfirmationWatcher'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// fetch is mocked globally in setup.ts — we override per test
const mockFetch = global.fetch as jest.Mock

describe('PaymentConfirmationWatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders nothing while polling', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: false }),
    })

    const { container } = render(<PaymentConfirmationWatcher reportId="report-abc" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('calls router.refresh() once the payment is confirmed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: true }),
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('keeps polling while not confirmed', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      return {
        ok: true,
        json: async () => ({ confirmed: callCount >= 3 }),
      }
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

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
      expect(mockRefresh).toHaveBeenCalled()
    })
    expect(callCount).toBe(3)
  })

  it('shows a timeout message after 30 failed polls and stops implying a redirect', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: false }),
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

    await act(async () => {
      jest.advanceTimersByTime(62000)
    })

    await waitFor(() => {
      expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
