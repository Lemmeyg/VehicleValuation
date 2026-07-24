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
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'

// Collects after() callbacks registered during each test so they can be drained explicitly.
let pendingAfterCallbacks: Array<() => Promise<void>> = []

async function drainAfterCallbacks(): Promise<void> {
  const cbs = [...pendingAfterCallbacks]
  pendingAfterCallbacks = []
  for (const cb of cbs) {
    try {
      await cb()
    } catch {
      // Mirrors production fire-and-forget semantics — errors in after() do not fail the request
    }
  }
}

jest.mock('@/lib/api/api-call-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue(undefined),
}))
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
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
jest.mock('@/lib/utils/url-validator', () => ({
  validateListingUrls: jest.fn(),
}))
jest.mock('@/lib/utils/comparables-supplementer', () => ({
  supplementComparables: jest.fn(),
}))
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return {
    ...actual,
    after: jest.fn((fn: () => Promise<void>) => {
      pendingAfterCallbacks.push(fn)
    }),
  }
})
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

const mockValidateListingUrls = validateListingUrls as jest.MockedFunction<
  typeof validateListingUrls
>
const mockSupplementComparables = supplementComparables as jest.MockedFunction<
  typeof supplementComparables
>

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

describe('POST /api/lemonsqueezy/webhook — order processing', () => {
  beforeEach(() => {
    pendingAfterCallbacks = []
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

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

    // Pass-through defaults for url-validator and comparables-supplementer
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  })

  it('does not send a magic link for an anonymous purchase', async () => {
    const signInWithOtpMock = jest.fn()
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
    await drainAfterCallbacks()

    expect(signInWithOtpMock).not.toHaveBeenCalled()
    // The account is still created/found — only the email send is gone.
    expect(mockAdmin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@example.com' })
    )
  })

  it('returns the response before running heavy API calls — deferred via after()', async () => {
    const body = makeOrderCreatedBody()
    const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })

    await POST(request)

    // The response must return before the heavy API calls run — they belong
    // inside the deferred after() callback, not on the synchronous request path.
    expect(autodev.fetchAutoDevVinDecode).not.toHaveBeenCalled()
    expect(marketcheck.fetchMarketCheckData).not.toHaveBeenCalled()

    await drainAfterCallbacks()

    // Once drained, the deferred work has actually run.
    expect(autodev.fetchAutoDevVinDecode).toHaveBeenCalled()
    expect(marketcheck.fetchMarketCheckData).toHaveBeenCalled()
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
    await drainAfterCallbacks()
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
    await drainAfterCallbacks()

    // PDF should NOT have been generated
    expect(mockGeneratePDF).not.toHaveBeenCalled()

    // Report status should have been set to vin_decode_failed
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'vin_decode_failed' })
    )
  })

  it('returns 200 silently when orderId already has a payment (idempotent retry)', async () => {
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
      insert: jest.fn().mockResolvedValue({
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "payments_stripe_payment_id_key"',
          details: 'Key (stripe_payment_id)=(order-123) already exists.',
        },
      }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    const body = makeOrderCreatedBody()
    const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    // Heavy API calls must NOT fire on a duplicate delivery
    expect(autodev.fetchAutoDevVinDecode).not.toHaveBeenCalled()
    expect(marketcheck.fetchMarketCheckData).not.toHaveBeenCalled()
  })
})

describe('POST /api/lemonsqueezy/webhook — URL validation and comparables supplement', () => {
  beforeEach(() => {
    pendingAfterCallbacks = []
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

    // Default report mock: no pre-existing marketcheck_valuation
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
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      fallbackUsed: false,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5, listings: [] },
      },
    })
    mockLogApiCall.mockResolvedValue(undefined)
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue(undefined)
    ;(mockAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    // Pass-through defaults
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  })

  function makeRequest(bodyOverrides: Record<string, unknown> = {}) {
    const body = makeOrderCreatedBody(bodyOverrides)
    return new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })
  }

  it('calls validateListingUrls when MarketCheck fetch is needed (no pre-existing data)', async () => {
    const request = makeRequest()
    await POST(request)
    await drainAfterCallbacks()
    expect(mockValidateListingUrls).toHaveBeenCalledTimes(1)
  })

  it('runs validateListingUrls on pre-existing MarketCheck data (from fetch-marketcheck before payment)', async () => {
    // Override report mock to return existing marketcheck_valuation (set by fetch-marketcheck pre-payment)
    const existingData = {
      predictedPrice: 20000,
      confidence: 'medium',
      totalComparablesFound: 8,
      recentComparables: { num_found: 4, listings: [] },
    }
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zip_code: '90210',
          vehicle_data: null,
          marketcheck_valuation: existingData,
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

    const request = makeRequest()
    await POST(request)
    await drainAfterCallbacks()
    // URL validation must run even on pre-existing data — the fetch-marketcheck route
    // stores raw unvalidated listings, so the webhook must validate + supplement them
    expect(mockValidateListingUrls).toHaveBeenCalledTimes(1)
    expect(mockValidateListingUrls).toHaveBeenCalledWith(existingData)
  })

  it('writes comparables_supplemented: true to updateData when supplement fires', async () => {
    const supplementedPrediction = {
      predictedPrice: 25000,
      confidence: 'high',
      totalComparablesFound: 15,
      recentComparables: { num_found: 5, listings: [] },
    }
    mockSupplementComparables.mockResolvedValue({
      prediction: supplementedPrediction,
      supplemented: true,
    })

    // Capture the update call
    let capturedUpdateArg: Record<string, unknown> | null = null
    const mockEq = jest.fn().mockResolvedValue({ error: null })
    const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      capturedUpdateArg = data
      return { eq: mockEq }
    })
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
      update: mockUpdate,
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    const request = makeRequest()
    await POST(request)
    await drainAfterCallbacks()

    expect(capturedUpdateArg).not.toBeNull()
    expect(capturedUpdateArg).toMatchObject({ comparables_supplemented: true })
  })

  it('writes marketcheck_fallback_used: true when VIN decode fallback was used', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      fallbackUsed: true,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5, listings: [] },
      },
    })

    let capturedUpdateArg: Record<string, unknown> | null = null
    const mockEq = jest.fn().mockResolvedValue({ error: null })
    const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      capturedUpdateArg = data
      return { eq: mockEq }
    })
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
      update: mockUpdate,
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    const request = makeRequest()
    await POST(request)
    await drainAfterCallbacks()

    expect(capturedUpdateArg).not.toBeNull()
    expect(capturedUpdateArg).toMatchObject({ marketcheck_fallback_used: true })
  })

  it('proceeds without supplement when validateListingUrls throws — no retry triggered', async () => {
    mockValidateListingUrls.mockRejectedValue(new Error('URL validation network error'))

    let capturedUpdateArg: Record<string, unknown> | null = null
    const mockEq = jest.fn().mockResolvedValue({ error: null })
    const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      capturedUpdateArg = data
      return { eq: mockEq }
    })
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
      update: mockUpdate,
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    const request = makeRequest()
    const response = await POST(request)
    await drainAfterCallbacks()

    // Should return 200 — non-fatal error
    expect(response.status).toBe(200)
    // supplementComparables must NOT have been called
    expect(mockSupplementComparables).not.toHaveBeenCalled()
    // comparables_supplemented should be false
    expect(capturedUpdateArg).not.toBeNull()
    expect(capturedUpdateArg).toMatchObject({ comparables_supplemented: false })
  })
})

describe('POST /api/lemonsqueezy/webhook — Lead capture on successful payment', () => {
  function makePaidOrderRequest(overrides: { customerEmail?: string } = {}) {
    const body = makeOrderCreatedBody({
      user_email: overrides.customerEmail ?? 'buyer@example.com',
      status: 'paid',
    })
    return new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body,
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

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
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      fallbackUsed: false,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5, listings: [] },
      },
    })
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    mockLogApiCall.mockResolvedValue(undefined)
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue(undefined)
    ;(mockAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  })

  it('calls upsert_lead with purchased lead type after payment confirmed', async () => {
    await POST(makePaidOrderRequest({ customerEmail: 'buyer@example.com' }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'buyer@example.com',
      p_lead_type: 'purchased',
    })
  })

  it('continues processing if lead capture fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'RPC error' } })

    const res = await POST(makePaidOrderRequest({ customerEmail: 'buyer@example.com' }))
    // Webhook should still return 200
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})

describe('POST /api/lemonsqueezy/webhook — Auto.dev guard', () => {
  beforeEach(() => {
    pendingAfterCallbacks = []
    jest.clearAllMocks()
    ;(client.verifyWebhookSignature as jest.Mock).mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

    // Default report mock: autodev_vin_data absent — hits the fallback (fetch) branch
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
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      fallbackUsed: false,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5, listings: [] },
      },
    })
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    mockLogApiCall.mockResolvedValue(undefined)
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue(undefined)
    ;(mockAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  })

  it('skips fetchAutoDevVinDecode when report.autodev_vin_data is already present', async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zip_code: '90210',
          vehicle_data: { year: '2021', make: 'Honda', model: 'Accord' },
          autodev_vin_data: {
            make: 'Honda',
            model: 'Accord',
            vehicle: { year: 2021 },
            vinValid: true,
          },
          marketcheck_valuation: null,
        },
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.from = mockFrom as any

    const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body: makeOrderCreatedBody(),
    })

    await POST(request)
    await drainAfterCallbacks()

    expect(autodev.fetchAutoDevVinDecode).not.toHaveBeenCalled()
    // MarketCheck's own guard is untouched — still driven by marketcheck_valuation, not this change
    expect(marketcheck.fetchMarketCheckData).toHaveBeenCalled()
  })

  it('still fetches via Auto.dev when report.autodev_vin_data is null (fallback path)', async () => {
    // Uses the default mock from this block's beforeEach (autodev_vin_data absent)
    const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'valid',
        'x-forwarded-host': 'www.totallosstoolkit.com',
        'x-forwarded-proto': 'https',
      },
      body: makeOrderCreatedBody(),
    })

    await POST(request)
    await drainAfterCallbacks()

    expect(autodev.fetchAutoDevVinDecode).toHaveBeenCalledWith('1HGBH41JXMN109186')
  })
})
