/**
 * @jest-environment node
 */
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/services/pdf-generator', () => ({
  generateAndUploadPDF: jest.fn(),
}))
jest.mock('@/lib/utils/payment-tier', () => ({
  getPaidReportType: jest.fn(),
}))

import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { getPaidReportType } from '@/lib/utils/payment-tier'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/reports/[id]/manual-valuation-supplement/route'

const mockGeneratePDF = generateAndUploadPDF as jest.Mock
const mockGetPaidReportType = getPaidReportType as jest.Mock
const SECRET = 'test-manual-valuation-secret'
const REPORT_ID = 'a179e5c2-5640-4cf2-a081-a99ad3acf56b'

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    glNotes: 'Duplicate with supplemented comps',
    marketcheckValuation: {
      predictedPrice: 14500,
      priceRange: { min: 12700, max: 16500 },
      confidence: 'medium',
      dataSource: 'manual_research',
      requestParams: {
        vin: '2T2BK1BA0DC193577',
        miles: 70500,
        zip: '95452',
        dealer_type: 'franchise',
      },
      totalComparablesFound: 4,
      recentComparables: {
        num_found: 4,
        listings: [
          {
            year: 2013,
            make: 'Lexus',
            model: 'RX 350',
            miles: 103372,
            price: 11995,
            vdp_url: 'https://x.test/1',
          },
          { year: 2013, make: 'Lexus', model: 'RX 350', miles: 111705, price: 14945 },
          { year: 2013, make: 'Lexus', model: 'RX 350', miles: 148422, price: 12472 },
          { year: 2013, make: 'Lexus', model: 'RX 350', miles: 160110, price: 13950 },
        ],
      },
      generatedAt: '2026-09-23T12:00:00Z',
    },
    ...overrides,
  }
}

function makeRequest(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers.Authorization = `Bearer ${secret}`
  return new NextRequest(
    `https://www.totallosstoolkit.com/api/admin/reports/${REPORT_ID}/manual-valuation-supplement`,
    { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }
  )
}

const call = (req: NextRequest) => POST(req, { params: Promise.resolve({ id: REPORT_ID }) })

function wireSupabase(opts: {
  report?: Record<string, unknown> | null
  fetchError?: unknown
  insertResult?: { id: string } | null
  insertError?: unknown
  finalRow?: Record<string, unknown> | null
}) {
  const insertCalls: Record<string, unknown>[] = []
  // Calls happen in a fixed, deterministic order: (1) fetch the original
  // report, (2) insert().select().single() for the clone, (3) — success path
  // only — re-fetch pdf_admin_url on the new row. A plain counter avoids
  // guessing which chain call "means" which step.
  let singleCallCount = 0
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    single: jest.fn(() => {
      singleCallCount += 1
      if (singleCallCount === 1) {
        return Promise.resolve({ data: opts.report ?? null, error: opts.fetchError ?? null })
      }
      if (singleCallCount === 2) {
        return Promise.resolve({
          data: opts.insertResult !== undefined ? opts.insertResult : { id: 'new-id-123' },
          error: opts.insertError ?? null,
        })
      }
      return Promise.resolve({
        data: opts.finalRow ?? { pdf_admin_url: 'https://x.test/admin.pdf' },
        error: null,
      })
    }),
    insert: jest.fn((payload: Record<string, unknown>) => {
      insertCalls.push(payload)
      return chain
    }),
  }
  ;(supabaseAdmin.from as jest.Mock).mockImplementation(() => chain)
  return { insertCalls, chain }
}

describe('POST /api/admin/reports/[id]/manual-valuation-supplement', () => {
  const ORIG_SECRET = process.env.MANUAL_VALUATION_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.MANUAL_VALUATION_SECRET = SECRET
    mockGetPaidReportType.mockResolvedValue('PREMIUM')
    mockGeneratePDF.mockResolvedValue({ success: true, pdfUrl: 'https://x.test/report.pdf' })
  })
  afterAll(() => {
    process.env.MANUAL_VALUATION_SECRET = ORIG_SECRET
  })

  it('401 when no Authorization header', async () => {
    wireSupabase({ report: { status: 'completed' } })
    const res = await call(makeRequest(validPayload(), null))
    expect(res.status).toBe(401)
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('400 when glNotes is missing', async () => {
    wireSupabase({ report: { status: 'completed' } })
    const res = await call(makeRequest(validPayload({ glNotes: '' })))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining('glNotes')]))
  })

  it('400 when no listing has a vdp_url', async () => {
    wireSupabase({ report: { status: 'completed' } })
    const bad = validPayload()
    bad.marketcheckValuation.recentComparables.listings =
      bad.marketcheckValuation.recentComparables.listings.map((l: Record<string, unknown>) => ({
        ...l,
        vdp_url: undefined,
      }))
    const res = await call(makeRequest(bad))
    expect(res.status).toBe(400)
  })

  it('404 when the original report does not exist', async () => {
    wireSupabase({ report: null, fetchError: { code: 'PGRST116' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(404)
  })

  it('409 when the original report is not completed', async () => {
    wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(409)
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('200 happy path: clones the row, skips email, resolves the original tier', async () => {
    const { insertCalls } = wireSupabase({
      report: {
        id: REPORT_ID,
        status: 'completed',
        email: 'gigipaolini@gmail.com',
        vin: '2T2BK1BA0DC193577',
        'GL Notes': null,
      },
    })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      originalReportId: REPORT_ID,
      newReportId: 'new-id-123',
      pdfUrl: 'https://x.test/report.pdf',
      pdfAdminUrl: 'https://x.test/admin.pdf',
    })

    expect(mockGetPaidReportType).toHaveBeenCalledWith(expect.anything(), REPORT_ID)
    expect(mockGeneratePDF).toHaveBeenCalledWith({
      reportId: 'new-id-123',
      skipEmailEnrollment: true,
      reportTypeOverride: 'PREMIUM',
    })

    const clone = insertCalls[0]
    expect(clone.status).toBe('pending')
    expect(clone.email_date_sent).toBeNull()
    expect(clone.marketcheck_predicted_price).toBe(14500)
    expect(clone['GL Notes']).toBe('Duplicate with supplemented comps')
    expect(clone.comparables_supplemented).toBe(true)
  })

  it('500 when PDF generation fails, but reports the new row id for inspection', async () => {
    mockGeneratePDF.mockResolvedValue({ success: false, error: 'render blew up' })
    wireSupabase({ report: { status: 'completed' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.newReportId).toBe('new-id-123')
  })
})
