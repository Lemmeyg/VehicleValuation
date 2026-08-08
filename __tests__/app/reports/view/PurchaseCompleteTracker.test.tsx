import React from 'react'
import { render } from '@testing-library/react'
import { useRouter, usePathname } from 'next/navigation'
import * as events from '@/lib/analytics/events'
import { PurchaseCompleteTracker } from '@/app/reports/[id]/view/PurchaseCompleteTracker'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackReportWorkflow: jest.fn(),
  trackPaymentSuccess: jest.fn(),
  identifyUser: jest.fn(),
}))

const mockEvents = events as jest.Mocked<typeof events>
const mockReplace = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(useRouter as jest.Mock).mockReturnValue({ replace: mockReplace })
  ;(usePathname as jest.Mock).mockReturnValue('/reports/rpt-1/view')
  history.pushState(null, '', '/reports/rpt-1/view')
})

describe('PurchaseCompleteTracker', () => {
  it('fires trackPaymentSuccess with plan, amount, email, and vin', () => {
    render(
      <PurchaseCompleteTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={1900}
        transactionId="ls-order-42"
        email="buyer@example.com"
        vin="1HGCM82633A123456"
      />
    )

    expect(mockEvents.trackPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'basic',
        amount: 19,
        currency: 'USD',
        paymentProcessor: 'lemonsqueezy',
        variantId: 'ls-order-42',
        email: 'buyer@example.com',
        vin: '1HGCM82633A123456',
      })
    )
  })

  it('fires trackReportWorkflow with step report_created', () => {
    render(<PurchaseCompleteTracker reportId="rpt-1" planType="premium" amountCents={2500} />)

    expect(mockEvents.trackReportWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'report_created', reportId: 'rpt-1', planType: 'premium' })
    )
  })

  it('calls identifyUser only when userId is provided', () => {
    render(
      <PurchaseCompleteTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={1900}
        userId="user-uuid-123"
        email="buyer@example.com"
        vin="1HGCM82633A123456"
      />
    )

    expect(mockEvents.identifyUser).toHaveBeenCalledWith('user-uuid-123', {
      email: 'buyer@example.com',
      vin: '1HGCM82633A123456',
      plan: 'basic',
    })
  })

  it('does not call identifyUser when userId is not provided', () => {
    render(<PurchaseCompleteTracker reportId="rpt-1" planType="basic" amountCents={1900} />)

    expect(mockEvents.identifyUser).not.toHaveBeenCalled()
  })

  it('strips the checkout=complete marker but preserves the token for anonymous buyers', () => {
    history.pushState(null, '', '/reports/rpt-1/view?token=abc123&checkout=complete')
    render(<PurchaseCompleteTracker reportId="rpt-1" planType="basic" amountCents={1900} />)

    expect(mockReplace).toHaveBeenCalledWith('/reports/rpt-1/view?token=abc123')
  })

  it('drops the checkout marker down to the bare path when no other params are present', () => {
    history.pushState(null, '', '/reports/rpt-1/view?checkout=complete')
    render(<PurchaseCompleteTracker reportId="rpt-1" planType="basic" amountCents={1900} />)

    expect(mockReplace).toHaveBeenCalledWith('/reports/rpt-1/view')
  })

  it('preserves every other param, not just token, alongside stripping checkout', () => {
    history.pushState(
      null,
      '',
      '/reports/rpt-1/view?token=abc123&utm_source=zoho&checkout=complete'
    )
    render(<PurchaseCompleteTracker reportId="rpt-1" planType="basic" amountCents={1900} />)

    expect(mockReplace).toHaveBeenCalledWith('/reports/rpt-1/view?token=abc123&utm_source=zoho')
  })

  it('does not double-fire tracking or the URL replace on re-render', () => {
    const { rerender } = render(
      <PurchaseCompleteTracker reportId="rpt-1" planType="basic" amountCents={1900} />
    )

    rerender(<PurchaseCompleteTracker reportId="rpt-1" planType="basic" amountCents={1900} />)

    expect(mockEvents.trackPaymentSuccess).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })
})
