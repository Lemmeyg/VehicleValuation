import { render, screen, fireEvent } from '@testing-library/react'
import MobilePricingView from '@/components/pricing/MobilePricingView'
import { PRICING_TIERS } from '@/lib/pricing/constants'
import { trackEvent } from '@/lib/analytics/events'

jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}))

jest.mock('@/components/pricing/MobilePricingSampleReport', () => {
  function MockMobilePricingSampleReport({ onExpand }: { onExpand?: () => void }) {
    return (
      <div data-testid="sample-report">
        <button type="button" onClick={onExpand}>
          Tap to See Full Report
        </button>
      </div>
    )
  }
  return MockMobilePricingSampleReport
})

describe('MobilePricingView', () => {
  const onSelectPlan = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    Element.prototype.scrollIntoView = jest.fn()
  })

  it('personalizes the headline when vehicle data is present', () => {
    render(
      <MobilePricingView
        vehicleData={{ year: 2019, make: 'Honda', model: 'Civic' }}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    expect(screen.getByText(/2019 Honda Civic/)).toBeInTheDocument()
  })

  it('falls back to generic headline when vehicle data is missing', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    expect(screen.getByText('Get Paid What Your Vehicle Is Worth')).toBeInTheDocument()
  })

  it('calls onSelectPlan with the Premium tier when its CTA is clicked', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /get premium report — \$25/i }))
    expect(onSelectPlan).toHaveBeenCalledWith(PRICING_TIERS[1])
  })

  it('scrolls to the Premium card when "Purchase Now" is clicked', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /purchase now/i }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
  })

  it('disables both CTAs and shows "Processing..." while a payment is in flight', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={true}
      />
    )
    const processingButtons = screen.getAllByRole('button', { name: /processing/i })
    expect(processingButtons).toHaveLength(2)
    processingButtons.forEach(button => expect(button).toBeDisabled())
  })

  it('tracks report_preview_viewed with the reportId when the sample report is expanded', () => {
    render(
      <MobilePricingView
        vehicleData={null}
        tiers={PRICING_TIERS}
        onSelectPlan={onSelectPlan}
        processingPayment={false}
        reportId="report-123"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /tap to see full report/i }))
    expect(trackEvent).toHaveBeenCalledWith('report_preview_viewed', { reportId: 'report-123' })
  })
})
