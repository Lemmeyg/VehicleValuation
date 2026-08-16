/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@/lib/db/supabase')
// Tracking is deferred with after() so it never delays the customer's file.
// Run the callback inline here so the assertions can observe it.
jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: jest.fn((fn: () => unknown) => Promise.resolve(fn()).catch(() => {})),
}))
jest.mock('@/lib/analytics/server-events', () => ({
  captureReportDownloaded: jest.fn().mockResolvedValue(undefined),
  isLikelyBotUserAgent: jest.requireActual('@/lib/analytics/server-events').isLikelyBotUserAgent,
}))
import { supabaseAdmin } from '@/lib/db/supabase'
import { captureReportDownloaded } from '@/lib/analytics/server-events'
import { GET } from '@/app/api/reports/download/[token]/route'

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) }
}

function mockValidReport(overrides: Record<string, unknown> = {}) {
  ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        id: 'report-abc',
        pdf_storage_path: 'reports/user-1/report.pdf',
        pdf_download_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
        posthog_distinct_id: 'ph-distinct-1',
        ...overrides,
      },
      error: null,
    }),
  })
  const mockBlob = new Blob(['fake-pdf-bytes'], { type: 'application/pdf' })
  ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
    download: jest.fn().mockResolvedValue({ data: mockBlob, error: null }),
  })
}

function requestWithAgent(userAgent?: string) {
  return new Request('http://localhost/api/reports/download/good-token', {
    headers: userAgent ? { 'user-agent': userAgent } : {},
  })
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// BL-125: this route is the only way most paying customers actually receive
// their PDF, and it was completely invisible to analytics.
describe('GET /api/reports/download/[token] — download tracking', () => {
  it('records the download, attributed to the buyer, on a successful delivery', async () => {
    mockValidReport()

    await GET(requestWithAgent(BROWSER_UA), makeParams('good-token'))

    expect(captureReportDownloaded).toHaveBeenCalledWith({
      reportId: 'report-abc',
      distinctId: 'ph-distinct-1',
    })
  })

  it('records the download unattributed when the report has no stored PostHog id', async () => {
    mockValidReport({ posthog_distinct_id: null })

    await GET(requestWithAgent(BROWSER_UA), makeParams('good-token'))

    expect(captureReportDownloaded).toHaveBeenCalledWith({
      reportId: 'report-abc',
      distinctId: null,
    })
  })

  it('does not record a download when the token does not match a report', async () => {
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    await GET(requestWithAgent(BROWSER_UA), makeParams('bad-token'))

    expect(captureReportDownloaded).not.toHaveBeenCalled()
  })

  it('does not record a download when the link has expired', async () => {
    mockValidReport({ pdf_download_token_expires_at: '2020-01-01T00:00:00Z' })

    await GET(requestWithAgent(BROWSER_UA), makeParams('expired-token'))

    expect(captureReportDownloaded).not.toHaveBeenCalled()
  })

  it('does not record a download when storage fails to return the file', async () => {
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'report-abc',
          pdf_storage_path: 'reports/user-1/report.pdf',
          pdf_download_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
          posthog_distinct_id: 'ph-distinct-1',
        },
        error: null,
      }),
    })
    ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
      download: jest.fn().mockResolvedValue({ data: null, error: { message: 'gone' } }),
    })

    await GET(requestWithAgent(BROWSER_UA), makeParams('good-token'))

    expect(captureReportDownloaded).not.toHaveBeenCalled()
  })

  it('does not count a mail scanner prefetch as a customer download', async () => {
    mockValidReport()

    const res = await GET(
      requestWithAgent('Microsoft Office Existence Discovery'),
      makeParams('good-token')
    )

    // The scanner still gets the file — we just do not report it as a download
    expect(res.status).toBe(200)
    expect(captureReportDownloaded).not.toHaveBeenCalled()
  })

  it('still delivers the PDF when analytics capture throws', async () => {
    mockValidReport()
    ;(captureReportDownloaded as jest.Mock).mockRejectedValueOnce(new Error('posthog down'))

    const res = await GET(requestWithAgent(BROWSER_UA), makeParams('good-token'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })
})

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
