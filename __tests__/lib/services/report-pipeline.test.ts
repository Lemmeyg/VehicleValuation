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
import { enrollHeldReportBuyer } from '@/lib/services/report-held-email'

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
jest.mock('@/lib/services/report-held-email', () => ({
  enrollHeldReportBuyer: jest.fn().mockResolvedValue('enrolled'),
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

describe('runReportPipeline — progress_step writes', () => {
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
        priceRange: { min: 22000, max: 28000 },
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
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

  it('writes progress_step comps, listings, valuation, then pdf, in order', async () => {
    const progressSteps: string[] = []
    const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      if (typeof data.progress_step === 'string') progressSteps.push(data.progress_step)
      return { eq: jest.fn().mockResolvedValue({ error: null }) }
    })
    mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
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
      update: mockUpdate,
    })

    await runReportPipeline('report-1')

    expect(progressSteps).toEqual(['comps', 'listings', 'valuation', 'pdf'])
  })
})

describe('runReportPipeline — QA gate', () => {
  function setupHappyPathMocks() {
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupHappyPathMocks()
  })

  it('holds as needs_review with ten_comps_displayed failed when fewer than 10 comps are displayed', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 3,
          listings: Array.from({ length: 3 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toContain('ten_comps_displayed')
    expect(pdfGenerator.generateAndUploadPDF).not.toHaveBeenCalled()
  })

  it('enrols the buyer in the Report Held email on a hold, passing the payment context', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: { num_found: 0, listings: [] },
      },
    })
    mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1', {
      payment: { amount: 2500, orderId: 'order-1', customerEmail: 'buyer@example.com' },
    })

    expect(outcome).toBe('held')
    expect(enrollHeldReportBuyer).toHaveBeenCalledTimes(1)
    expect(enrollHeldReportBuyer).toHaveBeenCalledWith('report-1', {
      paid: true,
      fallbackEmail: 'buyer@example.com',
    })
  })

  it('holds as needs_review with valuation_complete failed when priceRange is missing (the ±10% fallback trap)', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        // no priceRange — the pipeline's own valuation_result fallback would
        // fill lowValue/highValue, but the raw priceRange is what must be checked.
        recentComparables: { num_found: 0, listings: [] },
      },
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate.qa_failed_checks).toContain('valuation_complete')
  })

  it('releases (completed via generateAndUploadPDF) when all four checks pass', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/r.pdf',
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('completed')
    expect(pdfGenerator.generateAndUploadPDF).toHaveBeenCalledWith({ reportId: 'report-1' })
    const releaseUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => 'access_token_expires_at' in arg)
    expect(releaseUpdate).toBeDefined()
    // PRD §7 / AC-8: every result, pass or fail, is saved — a released report
    // must not leave qa_results empty just because it took the happy path.
    expect(releaseUpdate.qa_results).toHaveLength(4)
    expect(releaseUpdate.qa_results.map((r: { key: string }) => r.key)).toEqual([
      'vehicle_identified',
      'valuation_complete',
      'ten_comps_displayed',
      'pdf_built',
    ])
    expect(releaseUpdate.qa_failed_checks).toEqual([])
    expect(releaseUpdate.qa_evaluated_at).toBeDefined()
    // A released report gets the ready email (Report Delivery), never the checking email.
    expect(enrollHeldReportBuyer).not.toHaveBeenCalled()
  })

  it('holds as needs_review with pdf_built failed when generateAndUploadPDF returns success: false (the silent-failure bug)', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Failed to upload PDF',
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toContain('pdf_built')
    // Must never leave the report silently pending forever (PRD §17 bug 3).
    expect(
      mockUpdate.mock.calls.some(c => c[0].status === 'pending' && Object.keys(c[0]).length === 1)
    ).toBe(false)
  })

  it('holds as needs_review with a pipeline_error check when generateAndUploadPDF throws', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockRejectedValue(
      new Error('renderToBuffer crashed')
    )
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate.qa_failed_checks).toContain('pdf_built')
  })

  it('holds as needs_review with pipeline_error when an unrelated exception is thrown mid-pipeline', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockRejectedValue(new Error('network down'))
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toContain('pipeline_error')
  })

  it('still writes vin_decode_failed (not needs_review) when the vehicle cannot be identified', async () => {
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: false,
      error: 'VIN not found',
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: false,
      error: 'no data',
    })
    const { mockUpdate } = mockReportsTable({
      vin: 'BADVIN00000000000',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: { vin: 'BADVIN00000000000' },
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'vin_decode_failed')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toEqual(['vehicle_identified'])
  })

  it('still writes valuation_failed (not needs_review) when MarketCheck returns nothing at all', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: false,
      error: 'no data',
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: { year: 2020 },
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'valuation_failed')
    expect(holdUpdate).toBeDefined()
    // The reason must be recorded — an admin (or the future daily batch) reading
    // qa_failed_checks needs to see why, not just that vehicle_identified passed.
    expect(holdUpdate.qa_failed_checks).toContain('valuation_complete')
  })

  it('retries with status-only when the combined hold write fails (e.g. migration not applied yet)', async () => {
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: false,
      error: 'VIN not found',
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: false,
      error: 'no data',
    })
    // Every other write in the pipeline (progress_step, the main marketcheck
    // update) succeeds — only the combined hold write (identified by qa_results
    // being present) fails, simulating the qa_* columns not existing yet.
    const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      if ('qa_results' in data) {
        return {
          eq: jest
            .fn()
            .mockResolvedValue({ error: { message: 'column reports.qa_results does not exist' } }),
        }
      }
      return { eq: jest.fn().mockResolvedValue({ error: null }) }
    })
    ;(mockAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          vin: 'BADVIN00000000000',
          mileage: 35000,
          zip_code: '90210',
          vehicle_data: { vin: 'BADVIN00000000000' },
          marketcheck_valuation: null,
        },
        error: null,
      }),
      update: mockUpdate,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const statusOnlyRetry = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => Object.keys(arg).length === 1 && arg.status === 'vin_decode_failed')
    expect(statusOnlyRetry).toBeDefined()
  })
})
