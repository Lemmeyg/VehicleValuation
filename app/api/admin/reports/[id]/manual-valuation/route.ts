/**
 * POST /api/admin/reports/[id]/manual-valuation
 *
 * Recovery path for a paid report that MarketCheck could not price (old / rare /
 * high-mileage vehicles halted into status 'valuation_failed' by BL-62). The
 * manual-valuation-builder skill researches a valuation off-platform, gets Skip's
 * sign-off, then POSTs the approved MarketCheckPrediction-shaped object here.
 *
 * This endpoint: validates the shape, writes the valuation columns exactly as the
 * normal MarketCheck flow does, then calls generateAndUploadPDF (which sets
 * status='completed', mints the download token, and enrolls the customer in the
 * Zoho "Report Delivery" automation).
 *
 * Auth is a shared secret (MANUAL_VALUATION_SECRET) so the skill's script can call
 * it without a browser session — the same pattern as the cron routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Same core checks as the skill's scripts/validate-valuation.mjs, enforced server-side. */
function validatePayload(v: unknown): string[] {
  const errs: string[] = []
  const isInt = (n: unknown): n is number => Number.isInteger(n)
  if (typeof v !== 'object' || v === null) return ['body must be a JSON object']
  const p = v as Record<string, unknown>
  const range = p.priceRange as { min?: unknown; max?: unknown } | undefined
  const rc = p.recentComparables as { num_found?: unknown; listings?: unknown } | undefined
  const listings = Array.isArray(rc?.listings) ? (rc!.listings as Record<string, unknown>[]) : null
  const mr = p.manualResearch as { recommendation?: unknown; reason?: unknown } | undefined
  const rp = p.requestParams as { vin?: unknown; miles?: unknown; zip?: unknown } | undefined

  if (!isInt(p.predictedPrice) || (p.predictedPrice as number) <= 0)
    errs.push('predictedPrice must be an integer > 0')
  if (!range || !isInt(range.min) || (range.min as number) <= 0)
    errs.push('priceRange.min must be an integer > 0')
  if (!range || !isInt(range.max) || (range.max as number) <= (range?.min as number))
    errs.push('priceRange.max must be an integer > priceRange.min')
  if (
    range &&
    isInt(range.min) &&
    isInt(range.max) &&
    !(
      (range.min as number) < (p.predictedPrice as number) &&
      (p.predictedPrice as number) < (range.max as number)
    )
  )
    errs.push('need priceRange.min < predictedPrice < priceRange.max')
  if (p.confidence !== 'low' && p.confidence !== 'medium' && p.confidence !== 'high')
    errs.push('confidence must be low | medium | high')
  if (p.dataSource !== 'manual_research') errs.push("dataSource must equal 'manual_research'")
  if (!listings || listings.length < 1)
    errs.push('recentComparables.listings must have at least 1 entry')
  if (listings) {
    if (!listings.some(l => typeof l.vdp_url === 'string' && (l.vdp_url as string).trim()))
      errs.push('at least one listing must have a non-empty vdp_url')
    listings.forEach((l, i) => {
      if (
        !isInt(l.year) ||
        typeof l.make !== 'string' ||
        typeof l.model !== 'string' ||
        !isInt(l.miles) ||
        (l.miles as number) < 0 ||
        !isInt(l.price) ||
        (l.price as number) <= 0
      )
        errs.push(
          `listing[${i}] needs year(int), make(str), model(str), miles(int>=0), price(int>0)`
        )
    })
    if (rc?.num_found !== listings.length)
      errs.push('recentComparables.num_found must equal listings.length')
    if (!isInt(p.totalComparablesFound) || (p.totalComparablesFound as number) < listings.length)
      errs.push('totalComparablesFound must be an integer >= listings.length')
  }
  if (!/^[A-Za-z0-9]{17}$/.test((rp?.vin as string) || ''))
    errs.push('requestParams.vin must be 17 alphanumeric chars')
  if (!isInt(rp?.miles)) errs.push('requestParams.miles must be an integer')
  if (!/^\d{5}$/.test((rp?.zip as string) || '')) errs.push('requestParams.zip must be 5 digits')
  if (mr?.recommendation !== 'FULFIL' && mr?.recommendation !== 'REFUND')
    errs.push('manualResearch.recommendation must be FULFIL | REFUND')
  if (typeof mr?.reason !== 'string' || !(mr.reason as string).trim())
    errs.push('manualResearch.reason must be a non-empty string')
  return errs
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const expected = process.env.MANUAL_VALUATION_SECRET
  const authHeader = request.headers.get('authorization')
  if (!expected || !authHeader || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 })
  }

  const errs = validatePayload(payload)
  if (errs.length) {
    return NextResponse.json({ error: 'Invalid valuation payload', details: errs }, { status: 400 })
  }
  const v = payload as MarketCheckPrediction

  const { data: report, error: fetchError } = await supabaseAdmin
    .from('reports')
    .select('id, status, valuation_result, marketcheck_valuation')
    .eq('id', id)
    .single()

  if (fetchError || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const legacyBlank =
    report.status === 'completed' &&
    report.valuation_result == null &&
    report.marketcheck_valuation == null
  if (report.status !== 'valuation_failed' && !legacyBlank) {
    return NextResponse.json(
      {
        error: `Report status is '${report.status}' - refusing to overwrite a report that is not stranded`,
      },
      { status: 409 }
    )
  }

  const listingsCount = v.recentComparables?.listings?.length ?? 0
  const { error: updateError } = await supabaseAdmin
    .from('reports')
    .update({
      marketcheck_valuation: v,
      marketcheck_predicted_price: v.predictedPrice,
      marketcheck_msrp: v.msrp ?? null,
      marketcheck_price_range_min: v.priceRange?.min ?? null,
      marketcheck_price_range_max: v.priceRange?.max ?? null,
      marketcheck_confidence: v.confidence,
      marketcheck_total_comparables_found: v.totalComparablesFound,
      marketcheck_recent_comparables_found: listingsCount,
      marketcheck_fallback_used: false,
      comparables_supplemented: false,
      valuation_result: {
        predictedPrice: v.predictedPrice,
        lowValue: v.priceRange?.min ?? Math.round(v.predictedPrice * 0.9),
        averageValue: v.predictedPrice,
        highValue: v.priceRange?.max ?? Math.round(v.predictedPrice * 1.1),
        confidence: v.confidence,
        dataPoints: v.totalComparablesFound,
        dataSource: 'manual_research',
      },
    })
    .eq('id', id)

  if (updateError) {
    console.error('[MANUAL_VALUATION] Failed to write valuation:', updateError)
    return NextResponse.json({ error: 'Failed to save valuation' }, { status: 500 })
  }

  const pdf = await generateAndUploadPDF({ reportId: id })
  if (!pdf.success) {
    console.error('[MANUAL_VALUATION] PDF generation failed:', pdf.error)
    await supabaseAdmin.from('reports').update({ status: 'valuation_failed' }).eq('id', id)
    return NextResponse.json(
      { error: 'Valuation saved but PDF generation failed', reportId: id, pdfError: pdf.error },
      { status: 500 }
    )
  }

  // generateAndUploadPDF sets status='completed'; mirror create-free's explicit follow-up write.
  await supabaseAdmin.from('reports').update({ status: 'completed' }).eq('id', id)

  return NextResponse.json({ reportId: id, pdfUrl: pdf.pdfUrl ?? null }, { status: 200 })
}
