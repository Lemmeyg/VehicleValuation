/**
 * POST /api/admin/reports/[id]/manual-valuation-supplement
 *
 * Recovery path for a paid report that already completed but whose MarketCheck
 * valuation is too thin to trust (e.g. a single comp, or a comp whose listing
 * URL turned out dead) — distinct from the sibling manual-valuation route,
 * which only accepts reports stuck in 'valuation_failed'. That route's own
 * guard refuses a 'completed' report by design, so a report that finished but
 * came out thin needs a different path: this one clones it into a NEW row
 * with the supplemented comps, rather than overwriting the original.
 *
 * `id` in the URL is the ORIGINAL (already-completed) report to clone from.
 * This endpoint: validates the shape, resolves the original's paid tier
 * (Basic/Premium) so the clone renders correctly, inserts the clone with the
 * new marketcheck_valuation + a required GL Notes explanation, then generates
 * a real PDF for the clone with generateAndUploadPDF({ skipEmailEnrollment:
 * true }) — the clone is never emailed to the customer or enrolled in Zoho.
 *
 * Auth is the same MANUAL_VALUATION_SECRET shared secret as manual-valuation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { getPaidReportType } from '@/lib/utils/payment-tier'
import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RouteParams {
  params: Promise<{ id: string }>
}

interface SupplementPayload {
  marketcheckValuation: MarketCheckPrediction
  glNotes: string
}

/** Same shape rules as manual-valuation's validator, minus the REFUND/FULFIL
 * recommendation fields — this route is never used to make that call. */
function validatePayload(v: unknown): string[] {
  const errs: string[] = []
  const isInt = (n: unknown): n is number => Number.isInteger(n)
  if (typeof v !== 'object' || v === null) return ['body must be a JSON object']
  const p = v as Record<string, unknown>

  if (typeof p.glNotes !== 'string' || !p.glNotes.trim())
    errs.push('glNotes must be a non-empty string')

  const mv = p.marketcheckValuation as Record<string, unknown> | undefined
  if (typeof mv !== 'object' || mv === null) {
    errs.push('marketcheckValuation must be an object')
    return errs
  }
  const range = mv.priceRange as { min?: unknown; max?: unknown } | undefined
  const rc = mv.recentComparables as { num_found?: unknown; listings?: unknown } | undefined
  const listings = Array.isArray(rc?.listings) ? (rc!.listings as Record<string, unknown>[]) : null
  const rp = mv.requestParams as { vin?: unknown; miles?: unknown; zip?: unknown } | undefined

  if (!isInt(mv.predictedPrice) || (mv.predictedPrice as number) <= 0)
    errs.push('marketcheckValuation.predictedPrice must be an integer > 0')
  if (!range || !isInt(range.min) || (range.min as number) <= 0)
    errs.push('marketcheckValuation.priceRange.min must be an integer > 0')
  if (!range || !isInt(range.max) || (range.max as number) <= (range?.min as number))
    errs.push('marketcheckValuation.priceRange.max must be an integer > priceRange.min')
  if (
    range &&
    isInt(range.min) &&
    isInt(range.max) &&
    isInt(mv.predictedPrice) &&
    !(
      (range.min as number) < (mv.predictedPrice as number) &&
      (mv.predictedPrice as number) < (range.max as number)
    )
  )
    errs.push('need priceRange.min < predictedPrice < priceRange.max')
  if (mv.confidence !== 'low' && mv.confidence !== 'medium' && mv.confidence !== 'high')
    errs.push('marketcheckValuation.confidence must be low | medium | high')
  if (mv.dataSource !== 'manual_research')
    errs.push("marketcheckValuation.dataSource must equal 'manual_research'")
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
    if (!isInt(mv.totalComparablesFound) || (mv.totalComparablesFound as number) < listings.length)
      errs.push('totalComparablesFound must be an integer >= listings.length')
  }
  if (!/^[A-Za-z0-9]{17}$/.test((rp?.vin as string) || ''))
    errs.push('requestParams.vin must be 17 alphanumeric chars')
  if (!isInt(rp?.miles)) errs.push('requestParams.miles must be an integer')
  if (!/^\d{5}$/.test((rp?.zip as string) || '')) errs.push('requestParams.zip must be 5 digits')

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
    return NextResponse.json({ error: 'Invalid payload', details: errs }, { status: 400 })
  }
  const { marketcheckValuation: v, glNotes } = payload as SupplementPayload

  const { data: original, error: fetchError } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }
  if (original.status !== 'completed') {
    return NextResponse.json(
      {
        error: `Report status is '${original.status}' - refusing to clone a report that is not completed`,
      },
      { status: 409 }
    )
  }

  // Resolves via the ORIGINAL report's id, the only one with a payments row —
  // must happen before we clone, and must be threaded into PDF gen below.
  const reportType = (await getPaidReportType(supabaseAdmin, id)) ?? 'BASIC'

  const listingsCount = v.recentComparables?.listings?.length ?? 0

  // Clone every column, then override the valuation, admin note, and every
  // token/contact/PDF field that must not carry over to the new row.
  const clone: Record<string, unknown> = {
    ...original,
    marketcheck_valuation: v,
    marketcheck_predicted_price: v.predictedPrice,
    marketcheck_msrp: v.msrp ?? null,
    marketcheck_price_range_min: v.priceRange?.min ?? null,
    marketcheck_price_range_max: v.priceRange?.max ?? null,
    marketcheck_confidence: v.confidence,
    marketcheck_total_comparables_found: v.totalComparablesFound,
    marketcheck_recent_comparables_found: listingsCount,
    marketcheck_fallback_used: false,
    comparables_supplemented: true,
    valuation_result: {
      predictedPrice: v.predictedPrice,
      lowValue: v.priceRange?.min ?? Math.round(v.predictedPrice * 0.9),
      averageValue: v.predictedPrice,
      highValue: v.priceRange?.max ?? Math.round(v.predictedPrice * 1.1),
      confidence: v.confidence,
      dataPoints: v.totalComparablesFound,
      dataSource: 'manual_research',
    },
    'GL Notes': glNotes,
    // Not replicated: this clone isn't the customer's real purchase record, so it
    // must not carry the original's account link or payment/order identifiers.
    user_id: null,
    stripe_payment_id: null,
    lemon_squeezy_payment_id: null,
    // Fresh, unrelated to the original's — this row is never handed to the customer.
    access_token: crypto.randomUUID(),
    access_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    // Cleared: minted fresh by generateAndUploadPDF below (or left null on failure).
    pdf_url: null,
    pdf_storage_path: null,
    pdf_admin_url: null,
    pdf_download_token: null,
    pdf_download_token_expires_at: null,
    // Cleared: this clone must never look like the customer was contacted.
    email_date_sent: null,
    abandoned_recovery_sent_at: null,
    report_email_sent: null,
    posthog_distinct_id: null,
    status: 'pending',
  }
  delete clone.id
  delete clone.created_at
  delete clone.updated_at

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('reports')
    .insert(clone)
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[MANUAL_VALUATION_SUPPLEMENT] Failed to insert clone:', insertError)
    return NextResponse.json({ error: 'Failed to create duplicate report' }, { status: 500 })
  }
  const newReportId = inserted.id as string

  const pdf = await generateAndUploadPDF({
    reportId: newReportId,
    skipEmailEnrollment: true,
    reportTypeOverride: reportType,
  })
  if (!pdf.success) {
    console.error('[MANUAL_VALUATION_SUPPLEMENT] PDF generation failed:', pdf.error)
    return NextResponse.json(
      {
        error: 'Duplicate row created but PDF generation failed',
        originalReportId: id,
        newReportId,
        pdfError: pdf.error,
      },
      { status: 500 }
    )
  }

  const { data: finalRow } = await supabaseAdmin
    .from('reports')
    .select('pdf_admin_url')
    .eq('id', newReportId)
    .single()

  return NextResponse.json(
    {
      originalReportId: id,
      newReportId,
      pdfUrl: pdf.pdfUrl ?? null,
      pdfAdminUrl: finalRow?.pdf_admin_url ?? null,
    },
    { status: 200 }
  )
}
