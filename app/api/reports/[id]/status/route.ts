import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Report statuses where the automated pipeline gave up and a human finishes the
// report and emails it by hand (BL-62). The waiting page must not show a "ready"
// screen for these — the buyer gets the "we need more time" message instead.
const MANUAL_REVIEW_STATUSES = ['vin_decode_failed', 'valuation_failed']

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('price_paid, marketcheck_valuation, vin, email, status')
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const paid = report.price_paid != null && report.price_paid > 0
  const manualReview = paid && MANUAL_REVIEW_STATUSES.includes(report.status)
  const ready = paid && !manualReview && report.marketcheck_valuation != null

  return NextResponse.json({
    ready,
    manualReview,
    ...(ready || manualReview
      ? {
          pricePaid: report.price_paid,
          vin: report.vin ?? undefined,
          email: report.email ?? undefined,
        }
      : {}),
  })
}
