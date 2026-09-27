/**
 * generate-pdf route — held-report QA bypass guard
 *
 * This customer-facing route lets a logged-in owner regenerate their own
 * report's PDF. Before this guard, it would happily call
 * generateAndUploadPDF for a report the QA gate had held (needs_review,
 * vin_decode_failed, valuation_failed, failed), releasing it — with a
 * download token and a delivery email — without ever running the checks
 * that decided it wasn't ready (PRD: "anything that isn't perfect is
 * never displayed or sent").
 */
jest.mock('@/lib/db/auth', () => ({ getUser: jest.fn() }))
jest.mock('@/lib/db/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
}))
jest.mock('@/lib/services/pdf-generator', () => ({
  generateAndUploadPDF: jest.fn(),
}))

import { POST } from '@/app/api/reports/[id]/generate-pdf/route'
import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockReport(row: Record<string, unknown>) {
  ;(createServerSupabaseClient as jest.Mock).mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: row, error: null }),
    }),
  })
}

describe('POST /api/reports/[id]/generate-pdf — held-report guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUser as jest.Mock).mockResolvedValue({ id: 'user-1' })
    delete process.env.REQUIRE_PAYMENT_FOR_PDF
  })

  it.each(['needs_review', 'vin_decode_failed', 'valuation_failed', 'failed'])(
    'refuses to generate a PDF for a held report (status %s), even for the owner',
    async status => {
      mockReport({
        id: 'report-1',
        user_id: 'user-1',
        status,
        price_paid: 2900,
        pdf_storage_path: null,
      })

      const response = await POST(new Request('http://localhost'), makeContext('report-1'))

      expect(response.status).toBe(409)
      expect(generateAndUploadPDF).not.toHaveBeenCalled()
    }
  )

  it('still generates the PDF for a non-held report (regression check)', async () => {
    mockReport({
      id: 'report-1',
      user_id: 'user-1',
      status: 'pending',
      price_paid: 2900,
      pdf_storage_path: null,
    })
    ;(generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/r.pdf',
    })

    const response = await POST(new Request('http://localhost'), makeContext('report-1'))

    expect(response.status).toBe(200)
    expect(generateAndUploadPDF).toHaveBeenCalledWith({ reportId: 'report-1' })
  })
})
