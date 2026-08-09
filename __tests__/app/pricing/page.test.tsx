import { render, screen, act } from '@testing-library/react'
import PricingPage from '@/app/pricing/page'
import { trackEvent } from '@/lib/analytics/events'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/pricing',
}))

jest.mock('@/lib/analytics/events', () => ({
  trackReportWorkflow: jest.fn(),
  trackPaymentInitiated: jest.fn(),
  trackButtonClick: jest.fn(),
  trackCheckoutInitiated: jest.fn(),
  trackCheckoutAbandoned: jest.fn(),
  trackEvent: jest.fn(),
}))

jest.mock('@/lib/analytics/reddit-events', () => ({
  trackRedditViewContent: jest.fn(),
  trackRedditAddToCart: jest.fn(),
}))

jest.mock('@/lib/analytics/kb-attribution', () => ({
  getKBAttribution: () => null,
}))

function setPendingReport(
  vehicleData: { year: string | number; make: string; model: string } | null
) {
  sessionStorage.setItem(
    'pending_report',
    JSON.stringify({
      id: 'r1',
      vin: '1HGCM82633A123456',
      mileage: 50000,
      zip_code: '90210',
      vehicle_data: vehicleData,
      marketcheck_valuation: null,
    })
  )
}

describe('PricingPage — personalized headline', () => {
  afterEach(() => {
    sessionStorage.clear()
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('renders the personalized headline when vehicle data is complete', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)

    expect(await screen.findByText(/2019 Honda Civic/i)).toBeInTheDocument()
  })

  it('renders fallback copy when vehicle data is missing', async () => {
    setPendingReport({ year: 0, make: '', model: '' })
    render(<PricingPage />)

    expect(await screen.findByText(/get paid what your vehicle is worth/i)).toBeInTheDocument()
  })
})

describe('PricingPage — drip attribution capture', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    jest.clearAllMocks()
    // jest.clearAllMocks() clears call state but does NOT undo a mockReturnValue
    // set via jest.spyOn (only mockRestore()/restoreAllMocks() does). The first
    // test below spies on useSearchParams with mockReturnValue; without restoring
    // it here, that mocked URL leaks into the next test.
    jest.restoreAllMocks()
  })

  it('persists utm_source/utm_medium/utm_content from the URL into drip_last_touch', async () => {
    // Note: intentionally omits reportId — with it present, initializePricingPage
    // takes the fetchExistingReport branch (Option A) and never reaches the
    // pending_report hydration path this test relies on for the personalized
    // headline completion signal. Global fetch is blocked in tests (see
    // __tests__/setup.ts), so that branch would always fail regardless of the
    // drip-attribution feature under test here.
    // spyOn must target the same CommonJS module object the mocked component reads
    // from; an ES `import * as ns` produces a shallow-copy namespace object under
    // esModuleInterop, and mocking that copy does not patch the real module.
    jest
      .spyOn(jest.requireMock('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams('utm_source=zoho&utm_medium=email&utm_content=step_2'))
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)

    await screen.findByText(/2019 Honda Civic/i)

    const raw = localStorage.getItem('drip_last_touch')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.utm_source).toBe('zoho')
    expect(parsed.utm_medium).toBe('email')
    expect(parsed.utm_content).toBe('step_2')
  })

  it('does not write drip_last_touch when no utm params are present', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)

    await screen.findByText(/2019 Honda Civic/i)
    expect(localStorage.getItem('drip_last_touch')).toBeNull()
  })
})

describe('PricingPage — reportId flow via the new preview endpoint', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    jest.clearAllMocks()
    jest.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('loads and renders the report when the preview endpoint returns report data', async () => {
    jest
      .spyOn(jest.requireMock('next/navigation'), 'useSearchParams')
      .mockReturnValue(
        new URLSearchParams('reportId=r1&utm_source=zoho&utm_medium=email&utm_content=step_2')
      )
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        report: {
          id: 'r1',
          vin: '1HGCM82633A004352',
          mileage: 50000,
          zip_code: '90210',
          dealer_type: 'private',
          vehicle_data: { year: 2019, make: 'Honda', model: 'Civic' },
          marketcheck_valuation: null,
        },
      }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    expect(await screen.findByText(/2019 Honda Civic/i)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/reports/r1/preview')
  })

  it('shows an already-purchased message, not a redirect, when the report is already paid', async () => {
    jest
      .spyOn(jest.requireMock('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams('reportId=r1'))
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ alreadyPurchased: true }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    expect(await screen.findByText(/already purchased this report/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /return to homepage/i })).toBeInTheDocument()
  })

  it('tracks reason: existing_report_fetch_failed when the preview endpoint fails', async () => {
    jest
      .spyOn(jest.requireMock('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams('reportId=r1'))
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Report not found' }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    expect(await screen.findByText(/report not found/i)).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('pricing_data_missing', {
      reason: 'existing_report_fetch_failed',
    })
  })
})

describe('PricingPage — no vehicle data found', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // Reset useSearchParams mock: previous tests spy on it with mockReturnValue,
    // and jest.clearAllMocks() alone doesn't undo those spies. This test needs
    // the base mock (empty URLSearchParams) to trigger the no-data error path.
    jest
      .spyOn(jest.requireMock('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams())
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('does not automatically navigate home after showing the no-data message', async () => {
    render(<PricingPage />)

    // The pending_report retry window (Task 2) can take up to 1.2s
    // (MAX_PENDING_REPORT_RETRIES * PENDING_REPORT_RETRY_DELAY_MS) before the
    // no-data message appears. With jest.useFakeTimers() active, RTL's
    // waitFor schedules its own default 1000ms timeout on the same faked
    // clock and advances it in lockstep with its polling — so the default
    // findByText timeout is a *fake-time* budget, not a real-time one, and
    // 1000ms is no longer enough headroom for the up-to-1.2s retry path.
    // Widen it so this assertion reflects the new legitimate delay rather
    // than racing it.
    expect(
      await screen.findByText(/no vehicle data found/i, {}, { timeout: 2000 })
    ).toBeInTheDocument()

    await act(async () => {
      jest.advanceTimersByTime(4000)
    })

    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('PricingPage — pending_report retry window', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('hydrates successfully when pending_report appears shortly after mount', async () => {
    render(<PricingPage />)

    // Simulates Hero.tsx's sessionStorage write landing just after this
    // page's first check — the suspected production race.
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })

    await act(async () => {
      jest.advanceTimersByTime(1200)
    })

    expect(await screen.findByText(/2019 Honda Civic/i)).toBeInTheDocument()
    expect(screen.queryByText(/no vehicle data found/i)).not.toBeInTheDocument()
    // A successful hydration must never emit the pricing_data_missing
    // diagnostic — a false positive there would corrupt the production
    // signal this branch was built to collect.
    expect(trackEvent).not.toHaveBeenCalledWith('pricing_data_missing', expect.anything())
  })
})

describe('PricingPage — pricing_data_missing diagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('tracks reason: no_data_after_retry when nothing is found after retries', async () => {
    render(<PricingPage />)

    await act(async () => {
      jest.advanceTimersByTime(1200)
    })

    expect(await screen.findByText(/no vehicle data found/i)).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('pricing_data_missing', {
      reason: 'no_data_after_retry',
    })
  })

  it('tracks reason: parse_error and clears the corrupted key when pending_report is malformed', async () => {
    sessionStorage.setItem('pending_report', '{not valid json')

    render(<PricingPage />)

    expect(await screen.findByText(/no vehicle data found/i)).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('pricing_data_missing', { reason: 'parse_error' })
    expect(sessionStorage.getItem('pending_report')).toBeNull()
  })
})

describe('PricingPage — resuming a return visit via current_report_id', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    localStorage.clear()
    jest.clearAllMocks()
    jest.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('loads the report via current_report_id when pending_report is gone and no reportId is in the URL', async () => {
    sessionStorage.setItem('current_report_id', 'r1')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        report: {
          id: 'r1',
          vin: '1HGCM82633A004352',
          mileage: 50000,
          zip_code: '90210',
          dealer_type: 'private',
          vehicle_data: { year: 2019, make: 'Honda', model: 'Civic' },
          marketcheck_valuation: null,
        },
      }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    await act(async () => {
      jest.advanceTimersByTime(1200)
    })

    expect(await screen.findByText(/2019 Honda Civic/i)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/reports/r1/preview')
  })

  it('shows the already-purchased message, not payment buttons, on a return visit after purchase', async () => {
    sessionStorage.setItem('current_report_id', 'r1')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ alreadyPurchased: true }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    await act(async () => {
      jest.advanceTimersByTime(1200)
    })

    expect(await screen.findByText(/already purchased this report/i)).toBeInTheDocument()
  })

  it('prefers pending_report over current_report_id when both are present', async () => {
    // Both a valid pending_report (Option B) and a leftover current_report_id
    // from an earlier visit (Option C) are present. Option B must win — this
    // proves the precedence is enforced by behavior, not just code order.
    // Note: global.fetch also gets a call to /api/auth/session from Navbar's
    // own mount effect, unrelated to report hydration, so we assert on the
    // specific preview URL rather than on fetch never being called at all.
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    sessionStorage.setItem('current_report_id', 'some-other-id')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: null }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    expect(await screen.findByText(/2019 Honda Civic/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/reports/some-other-id/preview')
  })
})
