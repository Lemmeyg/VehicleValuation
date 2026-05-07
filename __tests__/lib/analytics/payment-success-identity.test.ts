import posthog from 'posthog-js'
import { trackPaymentSuccess } from '@/lib/analytics/events'

jest.mock('posthog-js', () => ({
  __loaded: true,
  capture: jest.fn(),
}))

const mockPosthog = posthog as jest.Mocked<typeof posthog>

beforeEach(() => jest.clearAllMocks())

describe('trackPaymentSuccess with identity fields', () => {
  it('includes email in the captured event when provided', () => {
    trackPaymentSuccess({
      plan: 'basic',
      amount: 29,
      currency: 'USD',
      paymentProcessor: 'lemonsqueezy',
      email: 'buyer@example.com',
      vin: '1HGCM82633A123456',
    })

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'payment_success',
      expect.objectContaining({
        email: 'buyer@example.com',
        vin: '1HGCM82633A123456',
        plan: 'basic',
        amount: 29,
      })
    )
  })

  it('works without email and vin (existing callers not broken)', () => {
    trackPaymentSuccess({
      plan: 'premium',
      amount: 49,
      currency: 'USD',
      paymentProcessor: 'lemonsqueezy',
    })

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'payment_success',
      expect.objectContaining({ plan: 'premium', amount: 49 })
    )
  })
})
