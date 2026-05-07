import React from 'react'
import { render } from '@testing-library/react'
import posthog from 'posthog-js'
import * as events from '@/lib/analytics/events'
import { PostHogPurchaseTracker } from '@/app/reports/[id]/success/PostHogPurchaseTracker'

jest.mock('posthog-js', () => ({
  __loaded: true,
  identify: jest.fn(),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackReportWorkflow: jest.fn(),
  trackPaymentSuccess: jest.fn(),
}))

const mockPosthog = posthog as jest.Mocked<typeof posthog>
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

  it('calls posthog.identify with email, vin, and plan when email is provided', () => {
    render(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="premium"
        amountCents={4900}
        email="buyer@example.com"
        vin="2T1BURHE0JC123456"
      />
    )

    expect(mockPosthog.identify).toHaveBeenCalledWith('buyer@example.com', {
      email: 'buyer@example.com',
      vin: '2T1BURHE0JC123456',
      plan: 'premium',
    })
  })

  it('does not call posthog.identify when email is not provided', () => {
    render(<PostHogPurchaseTracker reportId="rpt-1" planType="basic" amountCents={2900} />)

    expect(mockPosthog.identify).not.toHaveBeenCalled()
  })

  it('does not double-fire tracking on re-render', () => {
    const { rerender } = render(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={2900}
        email="buyer@example.com"
        vin="1HGCM82633A123456"
      />
    )

    rerender(
      <PostHogPurchaseTracker
        reportId="rpt-1"
        planType="basic"
        amountCents={2900}
        email="buyer@example.com"
        vin="1HGCM82633A123456"
      />
    )

    expect(mockEvents.trackPaymentSuccess).toHaveBeenCalledTimes(1)
    expect(mockPosthog.identify).toHaveBeenCalledTimes(1)
  })
})
