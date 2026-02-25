/**
 * Webhook appUrl resolution tests
 * @jest-environment node
 */
import { POST } from '@/app/api/lemonsqueezy/webhook/route'
import { supabaseAdmin } from '@/lib/db/supabase'
import * as client from '@/lib/lemonsqueezy/client'
import * as marketcheck from '@/lib/api/marketcheck-client'
import * as autodev from '@/lib/api/autodev-client'
import * as pdfGenerator from '@/lib/services/pdf-generator'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        listUsers: jest.fn(),
      },
      signInWithOtp: jest.fn(),
    },
  },
}))
jest.mock('@/lib/lemonsqueezy/client')
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/services/pdf-generator', () => ({
  generateAndUploadPDF: jest.fn(),
}))
jest.mock(
  '@react-pdf/renderer',
  () => ({
    StyleSheet: { create: jest.fn(() => ({})) },
    Document: jest.fn(),
    Page: jest.fn(),
    View: jest.fn(),
    Text: jest.fn(),
    Image: jest.fn(),
    Font: { register: jest.fn() },
  }),
  { virtual: true }
)

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeOrderCreatedBody(overrides = {}) {
  return JSON.stringify({
    meta: {
      event_name: 'order_created',
      custom_data: { reportId: 'report-abc', reportType: 'BASIC' },
      webhook_id: 'wh-1',
      test_mode: true,
    },
    data: {
      type: 'orders',
      id: 'order-123',
      attributes: {
        status: 'paid',
        total: 2900,
        user_email: 'buyer@example.com',
        user_name: 'Test Buyer',
        order_number: 1,
        ...overrides,
      },
    },
  })
}

describe('POST /api/lemonsqueezy/webhook — appUrl resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)

    // Mock report fetch
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zip_code: '90210',
          vehicle_data: null,
          marketcheck_valuation: null,
        },
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    // Mock MarketCheck and AutoDev
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: { predictedPrice: 25000, confidence: 'high', totalComparablesFound: 10 },
    })
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 } },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue(undefined)

    // Mock user creation (new user)
    ;(mockAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })
  })

  it('uses x-forwarded-host when NEXT_PUBLIC_APP_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.auth.signInWithOtp = signInWithOtpMock as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://internal-vercel-url/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })

    await POST(request)

    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://www.totallosstoolkit.com/reports/report-abc/view',
        }),
      })
    )
  })

  it('uses NEXT_PUBLIC_APP_URL when set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://totallosstoolkit.com'

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.auth.signInWithOtp = signInWithOtpMock as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://internal/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: { 'x-signature': 'valid' },
      body,
    })

    await POST(request)

    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://totallosstoolkit.com/reports/report-abc/view',
        }),
      })
    )

    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('magic link redirects to /reports/{id}/view not /reports/{id}', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.auth.signInWithOtp = signInWithOtpMock as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://internal/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })

    await POST(request)

    const callArgs = signInWithOtpMock.mock.calls[0][0]
    expect(callArgs.options.emailRedirectTo).toContain('/view')
    expect(callArgs.options.emailRedirectTo).not.toMatch(/\/reports\/[^/]+$/)
  })
})
