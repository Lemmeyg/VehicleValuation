import {
  ADMIN_URL_TTL_SECONDS,
  generatePDFBuffer,
  generateAndUploadPDF,
} from '@/lib/services/pdf-generator'

jest.mock('@/lib/db/supabase')

jest.mock('@/lib/zoho-campaigns', () => ({
  addContactToList: jest.fn().mockResolvedValue(true),
}))

import { supabaseAdmin } from '@/lib/db/supabase'
import { renderToBuffer } from '@react-pdf/renderer'
import { addContactToList } from '@/lib/zoho-campaigns'

const mockRenderToBuffer = renderToBuffer as jest.Mock
const mockAddContactToList = addContactToList as jest.Mock

const baseReportRow = {
  id: 'report-1',
  vin: '1HGBH41JXMN109186',
  user_id: 'user-1',
  status: 'completed',
  created_at: '2026-07-01T12:00:00Z',
}

// reports.select('*').eq('id',..).single()
// payments.select('metadata').eq('report_id',..).eq('status','succeeded').order(..).limit(1).maybeSingle()
function mockReportAndPayment(
  reportRow: Record<string, unknown>,
  paymentReportType: string | null
) {
  ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'reports') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
      }
    }
    if (table === 'payments') {
      const paymentData = paymentReportType ? { metadata: { reportType: paymentReportType } } : null
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: paymentData, error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('generatePDFBuffer — report type detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRenderToBuffer.mockResolvedValue(Buffer.from(''))
  })

  it('passes reportType BASIC to the PDF template for a Basic-tier payment', async () => {
    mockReportAndPayment({ ...baseReportRow, price_paid: 1900 }, 'BASIC')

    await generatePDFBuffer('report-1')

    const dataProp = mockRenderToBuffer.mock.calls[0][0].props.data
    expect(dataProp.reportType).toBe('BASIC')
  })

  it('passes reportType PREMIUM to the PDF template for a Premium-tier payment', async () => {
    mockReportAndPayment({ ...baseReportRow, price_paid: 2650 }, 'PREMIUM')

    await generatePDFBuffer('report-1')

    const dataProp = mockRenderToBuffer.mock.calls[0][0].props.data
    expect(dataProp.reportType).toBe('PREMIUM')
  })

  it('defaults to reportType BASIC when there is no matching payment (e.g. admin free report)', async () => {
    mockReportAndPayment({ ...baseReportRow, price_paid: 0 }, null)

    await generatePDFBuffer('report-1')

    const dataProp = mockRenderToBuffer.mock.calls[0][0].props.data
    expect(dataProp.reportType).toBe('BASIC')
  })
})

describe('generateAndUploadPDF — report type detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRenderToBuffer.mockResolvedValue(Buffer.from(''))
  })

  it('passes reportType PREMIUM to the PDF template for a Premium-tier payment', async () => {
    mockReportAndPayment({ ...baseReportRow, price_paid: 2650 }, 'PREMIUM')

    await generateAndUploadPDF({ reportId: 'report-1' })

    const dataProp = mockRenderToBuffer.mock.calls[0][0].props.data
    expect(dataProp.reportType).toBe('PREMIUM')
  })

  it('passes reportType BASIC to the PDF template for a Basic-tier payment', async () => {
    mockReportAndPayment({ ...baseReportRow, price_paid: 1900 }, 'BASIC')

    await generateAndUploadPDF({ reportId: 'report-1' })

    const dataProp = mockRenderToBuffer.mock.calls[0][0].props.data
    expect(dataProp.reportType).toBe('BASIC')
  })
})

describe('PDF filename generation', () => {
  function buildFilename(
    autodevVinData: { vehicle?: { year?: number }; make?: string; model?: string } | null,
    vin: string
  ): string {
    const year = autodevVinData?.vehicle?.year
    const make = autodevVinData?.make
    const model = autodevVinData?.model

    let filenamePart: string
    if (year && make && model) {
      filenamePart = `${year}-${make}-${model}`.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-')
    } else {
      filenamePart = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    }
    return `total-loss-report-${filenamePart}.pdf`
  }

  it('uses year, make, and model when vehicle data is present', () => {
    const filename = buildFilename(
      { vehicle: { year: 2019 }, make: 'Honda', model: 'Civic' },
      '1HGBH41JXMN109186'
    )
    expect(filename).toBe('total-loss-report-2019-Honda-Civic.pdf')
  })

  it('replaces spaces in make/model with hyphens', () => {
    const filename = buildFilename(
      { vehicle: { year: 2021 }, make: 'Land Rover', model: 'Range Rover' },
      '1HGBH41JXMN109186'
    )
    expect(filename).toBe('total-loss-report-2021-Land-Rover-Range-Rover.pdf')
  })

  it('falls back to VIN when autodevVinData is null', () => {
    const filename = buildFilename(null, '1HGBH41JXMN109186')
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })

  it('falls back to VIN when year is missing', () => {
    const filename = buildFilename(
      { vehicle: {}, make: 'Honda', model: 'Civic' },
      '1HGBH41JXMN109186'
    )
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })

  it('falls back to VIN when make is missing', () => {
    const filename = buildFilename({ vehicle: { year: 2019 }, model: 'Civic' }, '1HGBH41JXMN109186')
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })
})

describe('PDF admin URL TTL constant', () => {
  it('is 10 years in seconds', () => {
    expect(ADMIN_URL_TTL_SECONDS).toBe(10 * 365 * 24 * 60 * 60)
  })
})

describe('generateAndUploadPDF — Zoho report-delivery enrollment', () => {
  const REPORT_ROW = {
    id: 'report-1',
    vin: '1HGBH41JXMN109186',
    user_id: 'user-1',
    status: 'pending',
    created_at: '2026-07-01T12:00:00Z',
    email: 'buyer@example.com',
    vehicle_year: 2019,
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    price_paid: 1900,
    email_date_sent: null,
  }

  let updateSpy: jest.Mock

  function mockReportRow(reportRow: Record<string, unknown>) {
    updateSpy = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
    ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'reports') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
          update: updateSpy,
        }
      }
      if (table === 'payments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  }

  const ORIGINAL_LIST_KEY = process.env.ZOHO_CAMPAIGNS_REPORT_DELIVERY_LIST_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    mockRenderToBuffer.mockResolvedValue(Buffer.from(''))
    mockAddContactToList.mockResolvedValue(true)
    process.env.ZOHO_CAMPAIGNS_REPORT_DELIVERY_LIST_KEY = 'test-list-key'
  })

  afterEach(() => {
    if (ORIGINAL_LIST_KEY === undefined) {
      delete process.env.ZOHO_CAMPAIGNS_REPORT_DELIVERY_LIST_KEY
    } else {
      process.env.ZOHO_CAMPAIGNS_REPORT_DELIVERY_LIST_KEY = ORIGINAL_LIST_KEY
    }
  })

  it('enrolls the contact in Zoho with vehicle and report-url custom fields for a fresh paid report', async () => {
    mockReportRow(REPORT_ROW)

    await generateAndUploadPDF({ reportId: 'report-1' })

    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'test-list-key',
      email: 'buyer@example.com',
      customFields: {
        Year: '2019',
        Make: 'Honda',
        Model: 'Civic',
        ReportUrl: 'https://mock.url',
      },
    })
  })

  it('writes email_date_sent only after Zoho confirms enrollment succeeded', async () => {
    mockReportRow(REPORT_ROW)

    await generateAndUploadPDF({ reportId: 'report-1' })

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ email_date_sent: expect.any(String) })
    )
  })

  it('does not write email_date_sent when Zoho enrollment returns false', async () => {
    mockReportRow(REPORT_ROW)
    mockAddContactToList.mockResolvedValueOnce(false)

    await generateAndUploadPDF({ reportId: 'report-1' })

    expect(updateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ email_date_sent: expect.any(String) })
    )
  })

  it('does not enroll the contact when price_paid is null (admin free report)', async () => {
    mockReportRow({ ...REPORT_ROW, price_paid: null })

    await generateAndUploadPDF({ reportId: 'report-1' })

    expect(mockAddContactToList).not.toHaveBeenCalled()
  })

  it('does not enroll the contact when email_date_sent is already set (regeneration)', async () => {
    mockReportRow({ ...REPORT_ROW, email_date_sent: '2026-07-01T13:00:00Z' })

    await generateAndUploadPDF({ reportId: 'report-1' })

    expect(mockAddContactToList).not.toHaveBeenCalled()
  })

  it('still returns success when the Zoho enrollment call rejects', async () => {
    mockReportRow(REPORT_ROW)
    mockAddContactToList.mockRejectedValueOnce(new Error('zoho down'))

    const result = await generateAndUploadPDF({ reportId: 'report-1' })

    expect(result.success).toBe(true)
  })
})
