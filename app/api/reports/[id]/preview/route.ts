import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * GET /api/reports/[id]/preview
 *
 * Anonymous-safe report lookup for the pricing/resume flow (e.g. abandoned-report
 * drip email links, where the visitor has no account by definition). Mirrors the
 * no-auth, id-as-unguessable-token pattern already used by
 * GET /api/reports/[id]/status — the report's UUID id is the only credential,
 * consistent with /status already exposing email/vin this way. Stops returning
 * report contents once the report has been paid for.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select(
      'id, vin, mileage, zip_code, email, dealer_type, vehicle_data, marketcheck_valuation, price_paid'
    )
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  if (report.price_paid != null && report.price_paid > 0) {
    return NextResponse.json({ alreadyPurchased: true })
  }

  return NextResponse.json({
    report: {
      id: report.id,
      vin: report.vin,
      mileage: report.mileage,
      zip_code: report.zip_code,
      email: report.email ?? undefined,
      dealer_type: report.dealer_type,
      vehicle_data: report.vehicle_data,
      marketcheck_valuation: report.marketcheck_valuation,
    },
  })
}
