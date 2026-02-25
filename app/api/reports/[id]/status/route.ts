import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('price_paid, marketcheck_valuation')
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const ready =
    report.price_paid != null && report.price_paid > 0 && report.marketcheck_valuation != null

  return NextResponse.json({
    ready,
    ...(ready ? { pricePaid: report.price_paid } : {}),
  })
}
