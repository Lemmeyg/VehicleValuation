/**
 * @jest-environment node
 */
jest.mock('@/lib/db/supabase')
jest.mock('@/lib/services/pdf-generator', () => ({
  generateAndUploadPDF: jest.fn(),
}))

import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/reports/[id]/manual-valuation/route'

const mockGeneratePDF = generateAndUploadPDF as jest.Mock
const SECRET = 'test-manual-valuation-secret'
const REPORT_ID = '267209dd-c4a7-44fb-8b23-81ad89bf6d9f'

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    predictedPrice: 11500,
    msrp: null,
    priceRange: { min: 9000, max: 14000 },
    confidence: 'medium',
    dataSource: 'manual_research',
    requestParams: { vin: '1B7MC3364YJ131612', miles: 272543, zip: '30512', dealer_type: 'both' },
    totalComparablesFound: 5,
    recentComparables: {
      num_found: 4,
      listings: [
        {
          year: 2001,
          make: 'Dodge',
          model: 'Ram 3500',
          miles: 210000,
          price: 13500,
          vdp_url: 'https://x.test/1',
        },
        { year: 1999, make: 'Dodge', model: 'Ram 3500', miles: 240000, price: 9500 },
        { year: 2000, make: 'Dodge', model: 'Ram 3500', miles: 200000, price: 11000 },
        { year: 2002, make: 'Dodge', model: 'Ram 3500', miles: 180000, price: 15000 },
      ],
    },
    generatedAt: '2026-08-30T23:00:00Z',
    manualResearch: {
      recommendation: 'FULFIL',
      reason: '4 usable comps clustered',
      bookAnchors: [],
      adjustments: 'x',
    },
    ...overrides,
  }
}

function makeRequest(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers.Authorization = `Bearer ${secret}`
  return new NextRequest(
    `https://www.totallosstoolkit.com/api/admin/reports/${REPORT_ID}/manual-valuation`,
    { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }
  )
}

const call = (req: NextRequest) => POST(req, { params: Promise.resolve({ id: REPORT_ID }) })

/**
 * supabaseAdmin.from() mock: .select().eq().single() resolves to `report`,
 * .update().eq() resolves to `{ error: updateError }`. update payloads are captured.
 */
function wireSupabase(opts: {
  report?: Record<string, unknown> | null
  fetchError?: unknown
  updateError?: unknown
}) {
  const updateCalls: Record<string, unknown>[] = []
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    single: jest.fn(() =>
      Promise.resolve({ data: opts.report ?? null, error: opts.fetchError ?? null })
    ),
    update: jest.fn((payload: Record<string, unknown>) => {
      updateCalls.push(payload)
      return { eq: jest.fn(() => Promise.resolve({ error: opts.updateError ?? null })) }
    }),
  }
  ;(supabaseAdmin.from as jest.Mock).mockReturnValue(chain)
  return { updateCalls, chain }
}

describe('POST /api/admin/reports/[id]/manual-valuation', () => {
  const ORIG_SECRET = process.env.MANUAL_VALUATION_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.MANUAL_VALUATION_SECRET = SECRET
    mockGeneratePDF.mockResolvedValue({ success: true, pdfUrl: 'https://x.test/report.pdf' })
  })
  afterAll(() => {
    process.env.MANUAL_VALUATION_SECRET = ORIG_SECRET
  })

  it('401 when no Authorization header', async () => {
    wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload(), null))
    expect(res.status).toBe(401)
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('401 when the secret is wrong', async () => {
    wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload(), 'nope'))
    expect(res.status).toBe(401)
  })

  it('401 when the server has no secret configured', async () => {
    delete process.env.MANUAL_VALUATION_SECRET
    wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(401)
  })

  it('400 when the payload is mis-shaped (no vdp_url on any listing)', async () => {
    wireSupabase({ report: { status: 'valuation_failed' } })
    const bad = validPayload({
      recentComparables: {
        num_found: 1,
        listings: [{ year: 2001, make: 'Dodge', model: 'Ram 3500', miles: 210000, price: 13500 }],
      },
      totalComparablesFound: 1,
    })
    const res = await call(makeRequest(bad))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining('vdp_url')]))
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('400 when dataSource is not manual_research', async () => {
    wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload({ dataSource: 'marketcheck' })))
    expect(res.status).toBe(400)
  })

  it('404 when the report does not exist', async () => {
    wireSupabase({ report: null, fetchError: { code: 'PGRST116' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(404)
  })

  it('409 when the report is a healthy completed report', async () => {
    wireSupabase({
      report: {
        status: 'completed',
        valuation_result: { predictedPrice: 1 },
        marketcheck_valuation: {},
      },
    })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(409)
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('200 happy path: writes valuation, calls PDF gen, returns pdfUrl', async () => {
    const { updateCalls } = wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ reportId: REPORT_ID, pdfUrl: 'https://x.test/report.pdf' })

    const valuationWrite = updateCalls.find(u => 'marketcheck_valuation' in u)
    expect(valuationWrite).toBeDefined()
    expect(valuationWrite!.marketcheck_predicted_price).toBe(11500)
    expect(valuationWrite!.marketcheck_recent_comparables_found).toBe(4)
    expect((valuationWrite!.valuation_result as Record<string, unknown>).dataSource).toBe(
      'manual_research'
    )

    expect(mockGeneratePDF).toHaveBeenCalledWith({ reportId: REPORT_ID })
    expect(updateCalls.some(u => u.status === 'completed')).toBe(true)
  })

  it('200 also accepts a legacy blank completed report', async () => {
    wireSupabase({
      report: { status: 'completed', valuation_result: null, marketcheck_valuation: null },
    })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(200)
  })

  it('500 and resets status to valuation_failed when PDF generation fails', async () => {
    mockGeneratePDF.mockResolvedValue({ success: false, error: 'render blew up' })
    const { updateCalls } = wireSupabase({ report: { status: 'valuation_failed' } })
    const res = await call(makeRequest(validPayload()))
    expect(res.status).toBe(500)
    expect(updateCalls.some(u => u.status === 'valuation_failed')).toBe(true)
    expect(updateCalls.some(u => u.status === 'completed')).toBe(false)
  })
})
