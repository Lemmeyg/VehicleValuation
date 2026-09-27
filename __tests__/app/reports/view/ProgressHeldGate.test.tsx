import { render, screen, act } from '@testing-library/react'
import { ProgressHeldGate } from '@/app/reports/[id]/view/screens/ProgressHeldGate'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('ProgressHeldGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'working', step: 'comps', paidAt: null }),
    }) as jest.Mock
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the held message immediately when initialState is held, even at 0 elapsed time', async () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="held"
      />
    )
    expect(screen.getByText(/we're double-checking your data/i)).toBeInTheDocument()
    expect(screen.getByText(/2019 Honda CR-V/)).toBeInTheDocument()

    await flushMicrotasks()
  })

  it('shows the progress steps when initialState is progress and under 120s have elapsed', async () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )
    expect(screen.getByText(/building your report for 2019 Honda CR-V/i)).toBeInTheDocument()
    expect(screen.getByText(/finding comparable vehicles/i)).toBeInTheDocument()
    expect(screen.getByText(/this usually takes under a minute/i)).toBeInTheDocument()

    await flushMicrotasks()
  })

  it('flips to the held message purely from elapsed time at 120s, with no new server response', async () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )
    expect(screen.queryByText(/we're double-checking your data/i)).not.toBeInTheDocument()

    await flushMicrotasks()

    await act(async () => {
      jest.advanceTimersByTime(121_000)
    })

    expect(screen.getByText(/we're double-checking your data/i)).toBeInTheDocument()
  })

  it('calls router.refresh() when the poller sees a non-working state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'ready', step: null, paidAt: null }),
    })

    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )

    await flushMicrotasks()

    expect(refreshMock).toHaveBeenCalled()
  })

  it('does not call router.refresh() while the poller keeps seeing working', async () => {
    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )

    await flushMicrotasks()

    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('marks the current step from the polled response as active', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'working', step: 'valuation', paidAt: null }),
    })

    render(
      <ProgressHeldGate
        reportId="r1"
        vehicleLabel="2019 Honda CR-V"
        paidAt={new Date().toISOString()}
        initialState="progress"
      />
    )

    await flushMicrotasks()

    const valuationStep = screen.getByText(/calculating vehicle valuation/i)
    expect(valuationStep.className).toContain('text-slate-900')
  })
})
