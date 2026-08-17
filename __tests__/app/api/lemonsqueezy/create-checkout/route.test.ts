/**
 * @jest-environment node
 */
import { POST } from '@/app/api/lemonsqueezy/create-checkout/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/lemonsqueezy/client')
jest.mock('@/lib/db/auth')
jest.mock('@/lib/db/supabase')

import { createCheckout } from '@/lib/lemonsqueezy/client'
import { getUser } from '@/lib/db/auth'
import { supabaseAdmin } from '@/lib/db/supabase'

const mockCreateCheckout = createCheckout as jest.MockedFunction<typeof createCheckout>
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>

const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID = 'basic-variant-123'
  process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID = 'premium-variant-456'
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'

  mockGetUser.mockResolvedValue(null)
  ;(supabaseAdmin as jest.Mocked<typeof supabaseAdmin>).from = mockFrom as never

  mockSingle.mockResolvedValue({
    data: {
      id: 'report-1',
      vin: '1HGBH41JXMN109186',
      user_id: null,
      price_paid: null,
      access_token: 'token-abc',
    },
    error: null,
  })

  mockCreateCheckout.mockResolvedValue({
    data: {
      id: 'checkout-1',
      type: 'checkouts',
      attributes: { url: 'https://lemonsqueezy.com/checkout/123' } as never,
    },
  })
})

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('https://example.com/api/lemonsqueezy/create-checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/lemonsqueezy/create-checkout', () => {
  it('calls createCheckout without discountCode when not provided', async () => {
    const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC' })
    await POST(req)

    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ discountCode: undefined })
    )
  })

  it('passes discountCode to createCheckout when provided', async () => {
    const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC', discountCode: 'STAY19' })
    await POST(req)

    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ discountCode: 'STAY19' })
    )
  })

  it('returns checkoutUrl on success', async () => {
    const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC', discountCode: 'STAY19' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.checkoutUrl).toBe('https://lemonsqueezy.com/checkout/123')
  })

  it('passes testMode: false to createCheckout when LEMONSQUEEZY_TEST_MODE is not set', async () => {
    delete process.env.LEMONSQUEEZY_TEST_MODE

    const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC' })
    await POST(req)

    expect(mockCreateCheckout).toHaveBeenCalledWith(expect.objectContaining({ testMode: false }))
  })

  it('passes testMode: true to createCheckout when LEMONSQUEEZY_TEST_MODE=true', async () => {
    process.env.LEMONSQUEEZY_TEST_MODE = 'true'

    const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC' })
    await POST(req)

    expect(mockCreateCheckout).toHaveBeenCalledWith(expect.objectContaining({ testMode: true }))

    delete process.env.LEMONSQUEEZY_TEST_MODE
  })

  describe('checkout=complete on successUrl (BL-85 abandonment-marker fix)', () => {
    it('carries checkout=complete on the authenticated-user success URL', async () => {
      mockGetUser.mockResolvedValue({ id: 'user-1' } as never)
      mockSingle.mockResolvedValue({
        data: {
          id: 'report-1',
          vin: '1HGBH41JXMN109186',
          user_id: 'user-1',
          price_paid: null,
          access_token: null,
        },
        error: null,
      })

      const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC' })
      await POST(req)

      expect(mockCreateCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: 'https://example.com/reports/report-1/success?checkout=complete',
        })
      )
    })

    it('preserves the /view?token=...&checkout=complete shape for the anonymous-with-token branch', async () => {
      // mockGetUser resolves null (anonymous) and mockSingle has access_token: 'token-abc'
      // per beforeEach — this is the existing, must-not-change behaviour.
      const req = makeRequest({ reportId: 'report-1', reportType: 'BASIC' })
      await POST(req)

      expect(mockCreateCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: 'https://example.com/reports/report-1/view?token=token-abc&checkout=complete',
        })
      )
    })
  })
})
