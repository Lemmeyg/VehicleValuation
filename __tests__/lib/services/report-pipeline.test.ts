/**
 * @jest-environment node
 */
import { runReportPipeline } from '@/lib/services/report-pipeline'
import { supabaseAdmin } from '@/lib/db/supabase'
import * as marketcheck from '@/lib/api/marketcheck-client'
import * as autodev from '@/lib/api/autodev-client'
import * as pdfGenerator from '@/lib/services/pdf-generator'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'

jest.mock('@/lib/api/api-call-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))
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

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>
const mockValidateListingUrls = validateListingUrls as jest.MockedFunction<
  typeof validateListingUrls
>
const mockSupplementComparables = supplementComparables as jest.MockedFunction<
  typeof supplementComparables
>

function mockReportsTable(reportRow: Record<string, unknown>) {
  const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  const mockFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
    update: mockUpdate,
  })
  mockAdmin.from = mockFrom as unknown as typeof mockAdmin.from
  return { mockFrom, mockUpdate }
}

describe('runReportPipeline — payment-info guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5, listings: [] },
      },
    })
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/r.pdf',
    })
  })

  it('does not write price_paid/stripe_payment_id/user_id/email when called without opts.payment', async () => {
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    await runReportPipeline('report-1')

    const allUpdateArgs = mockUpdate.mock.calls.map(call => call[0])
    const reportUpdateArg = allUpdateArgs.find(arg => 'marketcheck_valuation' in arg)
    expect(reportUpdateArg).toBeDefined()
    expect(reportUpdateArg).not.toHaveProperty('price_paid')
    expect(reportUpdateArg).not.toHaveProperty('stripe_payment_id')
    expect(reportUpdateArg).not.toHaveProperty('user_id')
    expect(reportUpdateArg).not.toHaveProperty('email')
  })

  it('writes price_paid and stripe_payment_id when opts.payment is provided', async () => {
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    await runReportPipeline('report-1', {
      payment: { amount: 2900, orderId: 'order-123', rawUserId: 'user-1' },
    })

    const allUpdateArgs = mockUpdate.mock.calls.map(call => call[0])
    const reportUpdateArg = allUpdateArgs.find(arg => 'marketcheck_valuation' in arg)
    expect(reportUpdateArg).toMatchObject({ price_paid: 2900, stripe_payment_id: 'order-123' })
  })
})
