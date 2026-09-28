/**
 * Report Status API Tests
 * GET /api/reports/[id]/status
 * No auth required — returns only enough to drive the page's screens, never
 * email/VIN/price (docs/Inbox/report-delivery-prd.md §9.1, bug 7).
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/reports/[id]/status/route'
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>

function makeRequest(reportId: string) {
  return new Request(`http://localhost:3000/api/reports/${reportId}/status`, { method: 'GET' })
}
function makeContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}
function mockReport(row: Record<string, unknown>) {
  mockAdmin.from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: row, error: null }),
  }) as any
}

describe('GET /api/reports/[id]/status', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 404 when report not found', async () => {
    mockAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }) as any

    const response = await GET(makeRequest('nope'), makeContext('nope'))
    expect(response.status).toBe(404)
  })

  it('returns awaiting_payment when there is no price_paid yet', async () => {
    mockReport({
      price_paid: null,
      status: 'draft',
      progress_step: null,
      paid_at: null,
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'awaiting_payment', step: null, paidAt: null })
  })

  it('returns working with the current progress_step for a paid, in-progress report', async () => {
    mockReport({
      price_paid: 2900,
      status: 'pending',
      progress_step: 'listings',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'working', step: 'listings', paidAt: '2026-09-26T12:00:00Z' })
  })

  it('returns working with step comps during the comps/listings stages, when price_paid has not been written yet', async () => {
    // price_paid is only written once the pipeline reaches the valuation stage
    // (lib/services/report-pipeline.ts) — paid_at is set immediately by the
    // webhook, before comps/listings run. Gating "paid" on price_paid alone
    // left every step grey during the two longest stages.
    mockReport({
      price_paid: null,
      status: 'pending',
      progress_step: 'comps',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'working', step: 'comps', paidAt: '2026-09-26T12:00:00Z' })
  })

  it.each(['needs_review', 'vin_decode_failed', 'valuation_failed', 'failed'])(
    'returns held (with step: null) for status %s',
    async status => {
      mockReport({
        price_paid: 2900,
        status,
        progress_step: 'valuation',
        paid_at: '2026-09-26T12:00:00Z',
        pdf_download_token: null,
      })
      const response = await GET(makeRequest('r1'), makeContext('r1'))
      const data = await response.json()
      expect(data.state).toBe('held')
      expect(data.step).toBeNull()
    }
  )

  it('returns refunded', async () => {
    mockReport({
      price_paid: 2900,
      status: 'refunded',
      progress_step: null,
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: 'tok-1',
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data.state).toBe('refunded')
  })

  it('returns ready only when status is completed AND pdf_download_token is set', async () => {
    mockReport({
      price_paid: 2900,
      status: 'completed',
      progress_step: 'pdf',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: 'tok-1',
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).toEqual({ state: 'ready', step: null, paidAt: '2026-09-26T12:00:00Z' })
  })

  it('returns working (not ready) when status is completed but pdf_download_token is not set yet', async () => {
    mockReport({
      price_paid: 2900,
      status: 'completed',
      progress_step: 'pdf',
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: null,
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data.state).toBe('working')
  })

  it('never includes email, vin, or price fields', async () => {
    mockReport({
      price_paid: 2900,
      status: 'completed',
      progress_step: null,
      paid_at: '2026-09-26T12:00:00Z',
      pdf_download_token: 'tok-1',
      email: 'buyer@example.com',
      vin: '1HGBH41JXMN109186',
    })
    const response = await GET(makeRequest('r1'), makeContext('r1'))
    const data = await response.json()
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('vin')
    expect(data).not.toHaveProperty('pricePaid')
  })
})
