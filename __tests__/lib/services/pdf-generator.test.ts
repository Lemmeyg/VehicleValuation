import {
  ADMIN_URL_TTL_SECONDS,
  generatePDFBuffer,
  generateAndUploadPDF,
} from '@/lib/services/pdf-generator'

jest.mock('@/lib/db/supabase')

import { supabaseAdmin } from '@/lib/db/supabase'
import { renderToBuffer } from '@react-pdf/renderer'

const mockRenderToBuffer = renderToBuffer as jest.Mock

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
