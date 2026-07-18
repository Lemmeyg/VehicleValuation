const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockTrackCheckoutAbandoned = jest.fn()
jest.mock('@/lib/analytics/events', () => ({
  trackCheckoutAbandoned: (...args: unknown[]) => mockTrackCheckoutAbandoned(...args),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { NotReadySection } from '@/app/reports/[id]/view/NotReadySection'

describe('NotReadySection — not cancelled', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockReplace.mockClear()
    mockTrackCheckoutAbandoned.mockClear()
  })

  it('renders the generating skeleton and does not fire tracking', () => {
    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={false} />)

    expect(screen.getByTestId('report-skeleton')).toBeInTheDocument()
    expect(mockTrackCheckoutAbandoned).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('NotReadySection — cancelled checkout', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockReplace.mockClear()
    mockTrackCheckoutAbandoned.mockClear()
  })

  it('fires checkout_abandoned once with step lemon_squeezy_cancel', () => {
    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />)

    expect(mockTrackCheckoutAbandoned).toHaveBeenCalledTimes(1)
    expect(mockTrackCheckoutAbandoned).toHaveBeenCalledWith({
      reportId: 'report-1',
      plan: 'basic',
      price: 19,
      step: 'lemon_squeezy_cancel',
    })
  })

  it('strips checkout_status/plan/price from the URL, preserving token', () => {
    render(
      <NotReadySection
        reportId="report-1"
        token="tok-abc"
        plan="basic"
        price={19}
        initialCancelled={true}
      />
    )

    expect(mockReplace).toHaveBeenCalledWith('/reports/report-1/view?token=tok-abc')
  })

  it('strips the URL down to the bare view path when there is no token', () => {
    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />)

    expect(mockReplace).toHaveBeenCalledWith('/reports/report-1/view')
  })

  it('shows the welcome-back banner', () => {
    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('dismisses the banner when the close button is clicked', () => {
    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a Complete Your Purchase CTA instead of the skeleton/watcher', () => {
    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />)

    expect(screen.getByRole('link', { name: /complete your purchase/i })).toBeInTheDocument()
    expect(screen.queryByTestId('report-skeleton')).not.toBeInTheDocument()
  })

  it('does not re-fire tracking on a second mount for the same report in the same session', () => {
    const { unmount } = render(
      <NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />
    )
    unmount()

    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={false} />)

    expect(mockTrackCheckoutAbandoned).toHaveBeenCalledTimes(1)
  })

  it('keeps showing the Complete Your Purchase CTA on a later mount even once initialCancelled is false', () => {
    const { unmount } = render(
      <NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={true} />
    )
    unmount()

    render(<NotReadySection reportId="report-1" plan="basic" price={19} initialCancelled={false} />)

    expect(screen.getByRole('link', { name: /complete your purchase/i })).toBeInTheDocument()
  })
})
