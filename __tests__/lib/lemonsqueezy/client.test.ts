/**
 * @jest-environment node
 */
import { createCheckout } from '@/lib/lemonsqueezy/client'

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env.LEMONSQUEEZY_API_KEY = 'test-api-key'
  process.env.LEMONSQUEEZY_STORE_ID = 'test-store-id'
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: { id: 'checkout-1', attributes: { url: 'https://checkout.url' } },
    }),
  })
})

describe('createCheckout', () => {
  it('omits discount_code from checkout_data when discountCode is not provided', async () => {
    await createCheckout({
      variantId: '123',
      customData: { reportId: 'rep-1', reportType: 'BASIC' },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.data.attributes.checkout_data.discount_code).toBeUndefined()
  })

  it('includes discount_code in checkout_data when discountCode is provided', async () => {
    await createCheckout({
      variantId: '123',
      customData: { reportId: 'rep-1', reportType: 'BASIC' },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      discountCode: 'STAY19',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.data.attributes.checkout_data.discount_code).toBe('STAY19')
  })

  it('defaults test_mode to false when testMode is not provided', async () => {
    await createCheckout({
      variantId: '123',
      customData: { reportId: 'rep-1', reportType: 'BASIC' },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.data.attributes.test_mode).toBe(false)
  })

  it('sets test_mode to true when testMode is true', async () => {
    await createCheckout({
      variantId: '123',
      customData: { reportId: 'rep-1', reportType: 'BASIC' },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      testMode: true,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.data.attributes.test_mode).toBe(true)
  })
})
