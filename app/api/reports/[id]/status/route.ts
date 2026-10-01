import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { isHeldStatus } from '@/lib/constants/report-status'

interface RouteContext {
  params: Promise<{ id: string }>
}

type ReportApiState = 'awaiting_payment' | 'working' | 'held' | 'ready' | 'refunded'

/**
 * Drives the report page's screens only — no report content, email, VIN, or
 * price (docs/Inbox/report-delivery-prd.md §9.1, fixes bug 7). The 120-second
 * display rule is applied by the page from paidAt, not by this endpoint.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('price_paid, status, progress_step, paid_at, pdf_download_token')
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // price_paid is only written once the pipeline reaches the valuation stage
  // (lib/services/report-pipeline.ts) — paid_at is set immediately by the
  // webhook, before the comps/listings stages run. Gating on price_paid
  // alone left every progress step grey during those two stages.
  const paid = report.paid_at != null || (report.price_paid != null && report.price_paid > 0)

  let state: ReportApiState
  if (report.status === 'refunded') {
    state = 'refunded'
  } else if (isHeldStatus(report.status)) {
    state = 'held'
  } else if (report.status === 'completed' && report.pdf_download_token) {
    state = 'ready'
  } else if (!paid) {
    state = 'awaiting_payment'
  } else {
    state = 'working'
  }

  return NextResponse.json({
    state,
    step: state === 'working' ? ((report.progress_step as string | null) ?? null) : null,
    paidAt: (report.paid_at as string | null) ?? null,
  })
}
