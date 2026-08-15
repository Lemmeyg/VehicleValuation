import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { captureReportDownloaded, isLikelyBotUserAgent } from '@/lib/analytics/server-events'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .select('id, pdf_storage_path, pdf_download_token_expires_at, posthog_distinct_id')
      .eq('pdf_download_token', token)
      .maybeSingle()

    if (error || !report || !report.pdf_storage_path) {
      return new NextResponse('Report not found', { status: 404 })
    }

    const expiresAt = report.pdf_download_token_expires_at
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      return new NextResponse('This download link has expired', { status: 410 })
    }

    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from('vehicle-reports')
      .download(report.pdf_storage_path)

    if (downloadError || !fileBlob) {
      return new NextResponse('Failed to retrieve report', { status: 500 })
    }

    // BL-125: the delivery actually happened, so record it. Deferred with
    // after() so the customer's download never waits on an analytics call, and
    // skipped for link scanners so their prefetches don't inflate the number.
    if (!isLikelyBotUserAgent(request.headers.get('user-agent'))) {
      after(() =>
        captureReportDownloaded({
          reportId: report.id as string,
          distinctId: (report.posthog_distinct_id as string | null) ?? null,
        })
      )
    }

    return new NextResponse(fileBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="total-loss-report.pdf"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[download-route]', err)
    return new NextResponse('Failed to retrieve report', { status: 500 })
  }
}
