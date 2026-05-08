import React from 'react'
import { render } from '@testing-library/react'
import * as events from '@/lib/analytics/events'
import { PostHogPurchaseTracker } from '@/app/reports/[id]/success/PostHogPurchaseTracker'

jest.mock('@/lib/analytics/events', () => ({
  trackReportWorkflow: jest.fn(),
  trackPaymentSuccess: jest.fn(),
  identifyUser: jest.fn(),
}))

const mockEvents = events as jest.Mocked<typeof events>

beforeEach(() => jest.clearAllMocks())

describe('PostHogPurchaseTracker', () => {
  it('passes email and vin to trackPaymentSuccess', () => {
    render(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={2900}
        email="buyer@example.com"
        vin="1HGCM82633A123456"
      />
    )

    expect(mockEvents.trackPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        vin: '1HGCM82633A123456',
        plan: 'basic',
        amount: 29,
        currency: 'USD',
        paymentProcessor: 'lemonsqueezy',
      })
    )
  })

  it('calls identifyUser with userId, email, vin, and plan when userId is provided', () => {
    render(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="premium"
        amountCents={4900}
        email="buyer@example.com"
        vin="2T1BURHE0JC123456"
        userId="user-uuid-123"
      />
    )

    expect(mockEvents.identifyUser).toHaveBeenCalledWith('user-uuid-123', {
      email: 'buyer@example.com',
      vin: '2T1BURHE0JC123456',
      plan: 'premium',
    })
  })

  it('does not call identifyUser when userId is not provided', () => {
    render(<PostHogPurchaseTracker reportId="rpt-1" planType="basic" amountCents={2900} />)

    expect(mockEvents.identifyUser).not.toHaveBeenCalled()
  })

  it('does not double-fire tracking on re-render', () => {
    const { rerender } = render(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={2900}
        email="buyer@example.com"
        vin="1HGCM82633A123456"
        userId="user-uuid-123"
      />
    )

    rerender(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={2900}
        email="buyer@example.com"
        vin="1HGCM82633A123456"
        userId="user-uuid-123"
      />
    )

    expect(mockEvents.trackPaymentSuccess).toHaveBeenCalledTimes(1)
    expect(mockEvents.identifyUser).toHaveBeenCalledTimes(1)
  })
})
