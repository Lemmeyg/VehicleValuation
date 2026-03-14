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
import { logApiCall } from '@/lib/api/api-call-logger'

jest.mock('@/lib/api/api-call-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue(undefined),
}))
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

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
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    // Mock MarketCheck and AutoDev
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5 },
      },
    })
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    mockLogApiCall.mockResolvedValue(undefined)
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
          emailRedirectTo:
            'https://www.totallosstoolkit.com/auth/callback?next=/reports/report-abc/view',
        }),
      })
    )

    expect(mockLogApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'autodev',
        responseData: expect.objectContaining({ vinValid: expect.any(Boolean) }),
      })
    )
    expect(mockLogApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'marketcheck',
        responseData: expect.objectContaining({
          recent_comparables_found: expect.any(Number),
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
          emailRedirectTo:
            'https://totallosstoolkit.com/auth/callback?next=/reports/report-abc/view',
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
    expect(callArgs.options.emailRedirectTo).toContain('/auth/callback')
    expect(callArgs.options.emailRedirectTo).toContain('next=')
    expect(callArgs.options.emailRedirectTo).toContain('/view')
  })

  it('should write customer name to user_profiles on order_created', async () => {
    const reportId = 'report-abc'
    const userId = 'user-123'
    const customerName = 'Jane Smith'

    jest.spyOn(client, 'verifyWebhookSignature').mockReturnValue(true)
    jest.spyOn(autodev, 'fetchAutoDevVinDecode').mockResolvedValue({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { make: 'Toyota', model: 'Camry', vehicle: { year: 2020 } } as any,
    })
    jest.spyOn(marketcheck, 'fetchMarketCheckData').mockResolvedValue({
      success: false,
      error: 'no data',
    })
    jest.spyOn(pdfGenerator, 'generateAndUploadPDF').mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/report.pdf',
    })

    const mockSingle = jest.fn().mockResolvedValue({
      data: {
        vin: '1HGBH41JXMN109186',
        mileage: 50000,
        zip_code: '90210',
        marketcheck_valuation: null,
      },
      error: null,
    })
    const mockInsertSimple = jest.fn().mockResolvedValue({ error: null })
    const mockUpdate = jest
      .fn()
      .mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const mockUpsert = jest.fn().mockResolvedValue({ error: null })

    mockAdmin.from = jest.fn((table: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (table === 'user_profiles') return { upsert: mockUpsert } as any
      return {
        insert: mockInsertSimple,
        select: jest
          .fn()
          .mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) }),
        update: mockUpdate,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    })

    const body = JSON.stringify({
      meta: {
        event_name: 'order_created',
        custom_data: { reportId, userId, reportType: 'BASIC' },
        webhook_id: 'wh-1',
        test_mode: false,
      },
      data: {
        type: 'orders',
        id: 'order-1',
        attributes: {
          user_name: customerName,
          user_email: 'jane@example.com',
          status: 'paid',
          total: 2500,
          order_number: 1001,
        },
      },
    })

    const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      body,
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    expect(mockUpsert).toHaveBeenCalledWith(
      { id: userId, full_name: customerName },
      { onConflict: 'id' }
    )
  })

  it('should set status vin_decode_failed and skip PDF when VIN decode fails and report has no vehicle data', async () => {
    const reportId = 'report-vin-fail'
    const userId = 'user-456'

    jest.spyOn(client, 'verifyWebhookSignature').mockReturnValue(true)
    jest.spyOn(autodev, 'fetchAutoDevVinDecode').mockResolvedValue({
      success: false,
      error: 'VIN not found',
    })
    jest.spyOn(marketcheck, 'fetchMarketCheckData').mockResolvedValue({
      success: false,
      error: 'no data',
    })

    const mockGeneratePDF = jest.spyOn(pdfGenerator, 'generateAndUploadPDF').mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/report.pdf',
    })

    // Report has no vehicle data (VIN decode failed at creation too — no year field)
    const mockSingle = jest.fn().mockResolvedValue({
      data: {
        vin: 'BADVIN00000000000',
        mileage: 50000,
        zip_code: '90210',
        marketcheck_valuation: null,
        vehicle_data: { vin: 'BADVIN00000000000', mileage: 50000 }, // no year field
      },
      error: null,
    })

    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    })

    mockAdmin.from = jest.fn((_table: string) => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ single: mockSingle }),
      }),
      update: mockUpdate,
      upsert: jest.fn().mockResolvedValue({ error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any

    const body = JSON.stringify({
      meta: {
        event_name: 'order_created',
        custom_data: { reportId, userId, reportType: 'BASIC' },
        webhook_id: 'wh-2',
        test_mode: false,
      },
      data: {
        type: 'orders',
        id: 'order-2',
        attributes: {
          user_name: 'Test User',
          user_email: 'test@example.com',
          status: 'paid',
          total: 2500,
          order_number: 1002,
        },
      },
    })

    const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      body,
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'app.example.com',
        'x-forwarded-proto': 'https',
      },
    })

    await POST(request)

    // PDF should NOT have been generated
    expect(mockGeneratePDF).not.toHaveBeenCalled()

    // Report status should have been set to vin_decode_failed
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'vin_decode_failed' })
    )
  })
})
