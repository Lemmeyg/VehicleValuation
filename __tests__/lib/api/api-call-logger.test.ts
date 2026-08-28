import { logApiCall, logSupplementOutcome } from '@/lib/api/api-call-logger'
import { supabaseAdmin } from '@/lib/db/supabase'

// Mock supabaseAdmin — factory must not reference outer variables (hoisting)
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

const mockFrom = supabaseAdmin.from as jest.Mock
const mockInsert = jest.fn()

describe('logApiCall', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockResolvedValue({ data: null, error: null })
  })

  it('inserts a row with correct column mapping', async () => {
    await logApiCall({
      reportId: 'report-123',
      provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: true,
      responseTimeMs: 450,
      cost: 0.0,
      requestData: { vin: '1HGBH41JXMN109186' },
      responseData: { make: 'Honda', model: 'Accord', year: 2021, vinValid: true },
    })

    expect(mockFrom).toHaveBeenCalledWith('api_call_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      report_id: 'report-123',
      api_provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: true,
      response_time_ms: 450,
      cost: 0.0,
      request_data: { vin: '1HGBH41JXMN109186' },
      response_data: { make: 'Honda', model: 'Accord', year: 2021, vinValid: true },
      error_message: null,
    })
  })

  it('writes null for omitted optional fields', async () => {
    await logApiCall({
      reportId: 'report-456',
      provider: 'marketcheck',
      endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
      success: false,
      responseTimeMs: 200,
      cost: 0.0,
      errorMessage: 'API timeout',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_data: null,
        response_data: null,
        error_message: 'API timeout',
      })
    )
  })

  it('never throws when supabase returns an error', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logApiCall({
        reportId: 'report-789',
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: 100,
        cost: 0.0,
      })
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[logApiCall]'),
      expect.anything()
    )
    consoleSpy.mockRestore()
  })

  it('never throws when an unexpected exception is raised', async () => {
    mockInsert.mockRejectedValue(new Error('network failure'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logApiCall({
        reportId: 'report-000',
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: 100,
        cost: 0.0,
      })
    ).resolves.toBeUndefined()

    consoleSpy.mockRestore()
  })
})

describe('logSupplementOutcome', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockResolvedValue({ data: null, error: null })
  })

  it('writes an api_call_logs row with provider "internal", endpoint "supplement:outcome" and the outcome object', async () => {
    await logSupplementOutcome({
      fn: 'supplementComparables',
      reportId: 'report-777',
      exitReason: 'post_filter_empty',
      validCountIn: 3,
      listingsOut: 0,
      supplemented: false,
    })

    expect(mockFrom).toHaveBeenCalledWith('api_call_logs')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: 'report-777',
        api_provider: 'internal',
        endpoint: 'supplement:outcome',
        success: false,
        cost: 0,
        response_data: {
          fn: 'supplementComparables',
          exitReason: 'post_filter_empty',
          validCountIn: 3,
          listingsOut: 0,
          supplemented: false,
        },
      })
    )
  })

  it('defaults report_id to "unset" when reportId is omitted and never throws', async () => {
    mockInsert.mockRejectedValue(new Error('db down'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logSupplementOutcome({
        fn: 'supplementWithAlternateDealerType',
        exitReason: 'supplemented',
        validCountIn: 2,
        listingsOut: 12,
        supplemented: true,
      })
    ).resolves.toBeUndefined()

    consoleSpy.mockRestore()
  })
})
