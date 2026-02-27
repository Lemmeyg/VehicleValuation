/**
 * Tests for new checkout analytics functions
 */
import posthog from 'posthog-js'
import { trackCheckoutInitiated, trackCheckoutAbandoned } from '@/lib/analytics/events'

jest.mock('posthog-js', () => ({
  __loaded: true,
  capture: jest.fn(),
}))

const mockPosthog = posthog as jest.Mocked<typeof posthog>

describe('trackCheckoutInitiated', () => {
  it('calls posthog.capture with checkout_initiated and correct properties', () => {
    trackCheckoutInitiated({ reportId: 'rpt-1', plan: 'basic', price: 19 })

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'checkout_initiated',
      expect.objectContaining({
        reportId: 'rpt-1',
        plan: 'basic',
        price: 19,
      })
    )
  })

  it('includes isBetaMode when provided', () => {
    trackCheckoutInitiated({ reportId: 'rpt-2', plan: 'premium', price: 25, isBetaMode: true })

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'checkout_initiated',
      expect.objectContaining({ isBetaMode: true })
    )
  })
})

describe('trackCheckoutAbandoned', () => {
  it('calls posthog.capture with checkout_abandoned and step property', () => {
    trackCheckoutAbandoned({ reportId: 'rpt-1', plan: 'premium', price: 25, step: 'api_error' })

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'checkout_abandoned',
      expect.objectContaining({
        reportId: 'rpt-1',
        plan: 'premium',
        price: 25,
        step: 'api_error',
      })
    )
  })

  it('includes error message when provided', () => {
    trackCheckoutAbandoned({
      reportId: 'rpt-1',
      plan: 'basic',
      price: 19,
      step: 'api_error',
      error: 'Network timeout',
    })

    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'checkout_abandoned',
      expect.objectContaining({ error: 'Network timeout' })
    )
  })
})
