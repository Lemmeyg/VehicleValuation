import { render, screen, act } from '@testing-library/react'
import PricingPage from '@/app/pricing/page'

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

    expect(await screen.findByText(/no vehicle data found/i)).toBeInTheDocument()

    await act(async () => {
      jest.advanceTimersByTime(4000)
    })

    expect(mockPush).not.toHaveBeenCalled()
  })
})
