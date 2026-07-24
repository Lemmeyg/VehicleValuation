/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@/lib/db/supabase')
import { supabaseAdmin } from '@/lib/db/supabase'
import { GET } from '@/app/api/reports/download/[token]/route'

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/reports/download/[token]', () => {
  it('returns 404 when no report matches the token', async () => {
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    const res = await GET(
      new Request('http://localhost/api/reports/download/bad-token'),
      makeParams('bad-token')
    )

    expect(res.status).toBe(404)
  })

  it('returns 410 when the token has expired', async () => {
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          pdf_storage_path: 'reports/user-1/report.pdf',
          pdf_download_token_expires_at: '2020-01-01T00:00:00Z',
        },
        error: null,
      }),
    })

    const res = await GET(
      new Request('http://localhost/api/reports/download/expired-token'),
      makeParams('expired-token')
    )

    expect(res.status).toBe(410)
  })

  it('streams the PDF with the correct headers when the token is valid', async () => {
    const futureExpiry = new Date(Date.now() + 60_000).toISOString()
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          pdf_storage_path: 'reports/user-1/report.pdf',
          pdf_download_token_expires_at: futureExpiry,
        },
        error: null,
      }),
    })
    const mockBlob = new Blob(['fake-pdf-bytes'], { type: 'application/pdf' })
    const mockDownload = jest.fn().mockResolvedValue({ data: mockBlob, error: null })
    ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({ download: mockDownload })

    const res = await GET(
      new Request('http://localhost/api/reports/download/good-token'),
      makeParams('good-token')
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="total-loss-report.pdf"'
    )
    expect(mockDownload).toHaveBeenCalledWith('reports/user-1/report.pdf')
  })

  it('returns 500 when the storage download fails', async () => {
    const futureExpiry = new Date(Date.now() + 60_000).toISOString()
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          pdf_storage_path: 'reports/user-1/report.pdf',
          pdf_download_token_expires_at: futureExpiry,
        },
        error: null,
      }),
    })
    ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
      download: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    })

    const res = await GET(
      new Request('http://localhost/api/reports/download/good-token'),
      makeParams('good-token')
    )

    expect(res.status).toBe(500)
  })

  it('never calls createSignedUrl — this route only streams via the service-role client', async () => {
    const futureExpiry = new Date(Date.now() + 60_000).toISOString()
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          pdf_storage_path: 'reports/user-1/report.pdf',
          pdf_download_token_expires_at: futureExpiry,
        },
        error: null,
      }),
    })
    const mockCreateSignedUrl = jest.fn()
    const mockDownload = jest.fn().mockResolvedValue({
      data: new Blob(['x'], { type: 'application/pdf' }),
      error: null,
    })
    ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
      download: mockDownload,
      createSignedUrl: mockCreateSignedUrl,
    })

    await GET(
      new Request('http://localhost/api/reports/download/good-token'),
      makeParams('good-token')
    )

    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })
})
