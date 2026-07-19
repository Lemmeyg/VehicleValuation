import { render, screen } from '@testing-library/react'
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
