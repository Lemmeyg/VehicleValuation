import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PricingPage from '@/app/pricing/page'
import { toast } from 'sonner'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/pricing',
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}))

// handleSelectPlan treats a missing/placeholder variantId as "beta mode" and skips
// the real checkout API call entirely (app/pricing/page.tsx's isBetaMode check).
// The real lib/pricing/constants.ts reads NEXT_PUBLIC_LEMONSQUEEZY_*_VARIANT_ID at
// module-load time, which is unset in the test environment. Mock with the same
// values (verified against lib/pricing/constants.ts) but a real-looking variantId,
// so tests that click a plan CTA exercise the real checkout path.
jest.mock('@/lib/pricing/constants', () => {
  const CORE_FEATURES = [
    'Real market data from 450M+ vehicle listings',
    'Valuations accurate to within 5% of actual sale price',
    'High/low range with actual vehicle valuation',
    '10 verified live listings for comparison',
    'Covers 25+ model years with equipment-level precision',
  ]
  return {
    PRICING_TIERS: [
      {
        id: 'BASIC',
        name: 'Basic Report',
        price: 19,
        variantId: 'test-basic-variant-id',
        features: CORE_FEATURES,
      },
      {
        id: 'PREMIUM',
        name: 'Premium Report',
        price: 25,
        variantId: 'test-premium-variant-id',
        features: [
          ...CORE_FEATURES,
          'Two free report refreshes with updated listings',
          "Money-back guarantee if we don't beat your insurer's offer",
        ],
        recommended: true,
      },
    ],
    TESTIMONIALS: [
      {
        quote:
          'First offer was $23.5K. I provided an updated list of comparable sales from the report and ended up receiving $28K — a $4,500 increase.',
        attribution: 'M.R., California — 2020 Honda Civic',
        outcome: '+$4,500',
      },
      {
        quote:
          'They initially tried to offer $9,800 for my car. An independent vehicle evaluation pegged it at $23,000. They cut me a check a week later.',
        attribution: 'T.K., Texas — 2018 Toyota Camry',
        outcome: '+$13,200',
      },
    ],
    WHATS_INCLUDED: [
      { label: 'Accurate market value from 450M+ real listings' },
      { label: '10 verified comparable vehicles with prices and locations' },
      { label: 'High/low value range with confidence score' },
      { label: 'VIN-decoded equipment and trim-level precision' },
      { label: 'Regional pricing factors specific to your ZIP code' },
      { label: 'Negotiation-ready PDF format with professional layout' },
    ],
  }
})

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

    // Personalized headline now renders in both the desktop and mobile trees
    // (both are always in the DOM in jsdom; only CSS breakpoints hide one).
    expect(await screen.findAllByText(/2019 Honda Civic/i)).toHaveLength(2)
  })

  it('renders fallback copy when vehicle data is missing', async () => {
    setPendingReport({ year: 0, make: '', model: '' })
    render(<PricingPage />)

    expect(await screen.findAllByText(/get paid what your vehicle is worth/i)).toHaveLength(2)
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

    // Wait for hydration to complete; personalized headline renders in both
    // the desktop and mobile trees (both are always in the DOM in jsdom).
    await screen.findAllByText(/2019 Honda Civic/i)

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

    await screen.findAllByText(/2019 Honda Civic/i)
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

    expect(await screen.findAllByText(/2019 Honda Civic/i)).toHaveLength(2)
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

describe('PricingPage — desktop/mobile split', () => {
  beforeEach(() => {
    // The preceding describe block's afterEach only calls jest.clearAllMocks(),
    // which does not undo a jest.spyOn(...).mockReturnValue() override (only
    // mockRestore()/restoreAllMocks() does — see the comment above in the
    // "drip attribution capture" block). That leaves useSearchParams spied to
    // return reportId=r1 from its last test, which leaks into whichever block
    // runs next. Restore explicitly so these tests get the default
    // `() => new URLSearchParams()` mock regardless of run order.
    jest.restoreAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('renders both the desktop tree (hidden md:block) and the mobile tree (md:hidden) simultaneously', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)

    // Desktop-only copy from the existing, untouched JSX
    expect(await screen.findByText("What's in your report")).toBeInTheDocument()

    // Mobile-only copy from MobilePricingView's FAQ section, which desktop doesn't render
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument()

    // Both trees show the same personalized headline text independently
    expect(screen.getAllByText(/2019 Honda Civic/).length).toBe(2)
  })

  it('keeps the desktop pricing card CTA copy exactly as it is today', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    render(<PricingPage />)
    expect(await screen.findAllByText('Get Premium Report — $25')).toHaveLength(2) // one desktop, one mobile
  })
})

describe('PricingPage — checkout failure feedback', () => {
  const originalFetch = global.fetch
  const originalBasicVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID
  const originalPremiumVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID

  beforeEach(() => {
    // handleSelectPlan reads NEXT_PUBLIC_LEMONSQUEEZY_*_VARIANT_ID directly from
    // process.env at call time (app/pricing/page.tsx's isBetaMode check) — not
    // via PRICING_TIERS — to decide whether to skip payment entirely as "beta
    // mode". Both are unset in the test environment, so without this, clicking
    // a plan CTA never reaches the real checkout code path this suite tests.
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID = 'test-basic-variant-id'
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID = 'test-premium-variant-id'
  })

  afterEach(() => {
    sessionStorage.clear()
    jest.clearAllMocks()
    global.fetch = originalFetch
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID = originalBasicVariantId
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID = originalPremiumVariantId
  })

  it('shows a visible toast when checkout creation fails (no checkoutUrl returned)', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'Failed to create checkout: Unprocessable Entity' }),
    }) as unknown as typeof fetch

    render(<PricingPage />)

    const [premiumButton] = await screen.findAllByRole('button', {
      name: /get premium report — \$25/i,
    })
    fireEvent.click(premiumButton)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "We couldn't start checkout. Please try again — if this keeps happening, contact us."
      )
    )
  })

  it('shows a visible toast when the checkout request itself throws', async () => {
    setPendingReport({ year: 2019, make: 'Honda', model: 'Civic' })
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

    render(<PricingPage />)

    const [premiumButton] = await screen.findAllByRole('button', {
      name: /get premium report — \$25/i,
    })
    fireEvent.click(premiumButton)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "We couldn't start checkout. Please try again — if this keeps happening, contact us."
      )
    )
  })
})
