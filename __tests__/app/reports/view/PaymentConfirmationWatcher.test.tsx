import { render, screen, act, waitFor } from '@testing-library/react'
import { PaymentConfirmationWatcher } from '@/app/reports/[id]/view/PaymentConfirmationWatcher'

const mockRefresh = jest.fn()
// Real next/navigation's useRouter() returns a stable object reference across
// renders. Returning a fresh object on every call (as a naive mock would)
// breaks the component's `useEffect(..., [reportId, router])` dependency
// check — any re-render (e.g. from setTimedOut) would look like router
// changed, tearing down and restarting the poll interval. Use a
// module-level constant so the mock matches real router identity semantics.
const mockRouter = { refresh: mockRefresh }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
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

  it('stops polling after the timeout is reached', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ confirmed: false }),
    })

    render(<PaymentConfirmationWatcher reportId="report-abc" />)

    // Advance one interval tick at a time (mirroring the "keeps polling"
    // test above) so each poll's async fetch resolves — and increments
    // the attempt count — before the next tick fires. A single large
    // advanceTimersByTime jump would let every tick fire synchronously
    // before any promise settles, masking whether clearInterval actually
    // ran.
    for (let i = 0; i < 32; i++) {
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
    }

    await waitFor(() => {
      expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
    })

    const callCountAtTimeout = mockFetch.mock.calls.length

    // Advance well past the timeout. If the interval wasn't cleared, this
    // would trigger several more fetch calls.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
    }

    expect(mockFetch.mock.calls.length).toBe(callCountAtTimeout)
  })
})
