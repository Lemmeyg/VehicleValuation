/**
 * POST /api/admin/reports/[id]/create-radius-corrected-report
 *
 * Admin-only. Fixes the "comparable listings are nationwide, not local" bug:
 * when a report's original MarketCheck VIN lookup failed, the app fell back to
 * an unfiltered nationwide search with no distance awareness at all (see
 * fetchMarketCheckSearchFallback). This endpoint re-derives a report's
 * comparable listings so they're genuinely within `radiusMiles` of the
 * customer's ZIP, and writes the result to a brand-new report row — the
 * original report (and its PDF/download link) is never modified.
 *
 * Body: { radiusMiles?: number }  (default 300)
 *
 * Two paths, tried in order:
 *  1. Retry the VIN-based MarketCheck prediction. If it succeeds this time,
 *     its comparables carry a real `location.distance_miles`, and its
 *     predictedPrice/priceRange/confidence are MarketCheck's own valuation —
 *     not something this app calculates.
 *  2. If VIN decode still fails, fall back to MarketCheck's search endpoint
 *     with zip+radius (MarketCheck enforces the radius server-side; this
 *     endpoint never returns a distance field or a valuation). In this path
 *     there is no MarketCheck-native price available, so the original
 *     report's valuation is carried forward unchanged rather than computed
 *     by averaging listing prices ourselves.
 *
 * Either way: listings are cleaned with the same rules every report uses,
 * URL-validated, ranked by closest mileage to the subject vehicle, and capped
 * at 10 (working links first) — or fewer, if that's genuinely all that
 * qualifies within radiusMiles. No automatic radius widening.
 *
 * Path 2's search spans the same model-year band as every other report
 * (subjectYear-5..+2), not a single exact year — a single-year search
 * combined with a radius restriction was found to return zero results even
 * where nearby, slightly-off-year inventory existed.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import {
  fetchMarketCheckData,
  fetchMarketCheckSearchByRadius,
  type MarketCheckComparable,
  type MarketCheckPrediction,
} from '@/lib/api/marketcheck-client'
import { cleanAndFilterComparables } from '@/lib/utils/comparables-cleaner'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { getPaidReportType } from '@/lib/utils/payment-tier'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { logApiCall } from '@/lib/api/api-call-logger'

const DEFAULT_RADIUS_MILES = 300
const MAX_SHOWN = 10

// Mirrors cleanAndFilterComparables' own year band (subjectYear-5..+2), ordered
// by closeness to the subject year so the search can stop early once it has a
// healthy pool without needlessly querying every year in the band.
const YEAR_OFFSETS = [0, -1, 1, -2, 2, -3, -4, -5]
const RAW_CANDIDATE_POOL_TARGET = MAX_SHOWN * 3

interface RouteParams {
  params: Promise<{ id: string }>
}

function distanceOf(l: MarketCheckComparable): number {
  return typeof l.location?.distance_miles === 'number' ? l.location.distance_miles : Infinity
}

/** Ascending by how close a listing's mileage is to the subject vehicle's. */
function byClosestMileage(subjectMileage: number) {
  return (a: MarketCheckComparable, b: MarketCheckComparable) =>
    Math.abs(a.miles - subjectMileage) - Math.abs(b.miles - subjectMileage)
}

/** Working-link listings first, then the rest — each group keeps its incoming order. */
function validatedFirst(listings: MarketCheckComparable[]): MarketCheckComparable[] {
  const validated = listings.filter(l => l.url_validated)
  const unvalidated = listings.filter(l => !l.url_validated)
  return [...validated, ...unvalidated]
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin()

    const { id: originalReportId } = await params
    const body = await request.json().catch(() => ({}))
    const radiusMiles: number =
      typeof body.radiusMiles === 'number' && body.radiusMiles > 0
        ? body.radiusMiles
        : DEFAULT_RADIUS_MILES

    const { data: original, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', originalReportId)
      .single()

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Original report not found' }, { status: 404 })
    }
    if (!original.vin || !original.mileage || !original.zip_code) {
      return NextResponse.json(
        { error: 'Original report is missing vin, mileage, or zip_code' },
        { status: 400 }
      )
    }

    const vehicleYear = Number(original.vehicle_data?.year)
    const subjectVehicle =
      original.vehicle_data && vehicleYear > 0
        ? {
            year: vehicleYear,
            make: original.vehicle_data.make as string,
            model: original.vehicle_data.model as string,
            trim: original.vehicle_data.trim as string | undefined,
          }
        : undefined

    const originalReportType = (await getPaidReportType(supabaseAdmin, originalReportId)) ?? 'BASIC'

    // ── Create the new report row up front so API calls below can be logged against it ──
    const today = new Date().toISOString().slice(0, 10)
    const { data: newReport, error: insertError } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: original.user_id,
        vin: original.vin,
        mileage: original.mileage,
        zip_code: original.zip_code,
        email: original.email,
        dealer_type: original.dealer_type ?? 'franchise',
        vehicle_data: original.vehicle_data,
        autodev_vin_data: original.autodev_vin_data,
        vehicle_make: original.vehicle_make,
        vehicle_model: original.vehicle_model,
        vehicle_year: original.vehicle_year,
        state_article_url: original.state_article_url,
        state_name: original.state_name,
        vehicle_guide_url: original.vehicle_guide_url,
        status: 'draft',
        data_retrieval_status: 'pending',
        price_paid: 0,
        'GL Notes': `Corrected replacement for report ${originalReportId} — ${radiusMiles}mi radius fix, ${today}. Customer reported comps not within driving distance.`,
      })
      .select()
      .single()

    if (insertError || !newReport) {
      console.error('[RADIUS_FIX] Failed to create new report:', insertError)
      return NextResponse.json({ error: 'Failed to create new report' }, { status: 500 })
    }
    const newReportId = newReport.id as string

    // ── Path 1: retry the VIN-based prediction ─────────────────────────────
    const mcStartTime = Date.now()
    const mcResult = await fetchMarketCheckData(
      original.vin,
      original.mileage,
      original.zip_code,
      false,
      undefined,
      subjectVehicle
    )
    await logApiCall({
      reportId: newReportId,
      provider: 'marketcheck',
      endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
      success: mcResult.success,
      responseTimeMs: Date.now() - mcStartTime,
      cost: mcResult.success ? 0.09 : 0.0,
      requestData: {
        vin: original.vin,
        mileage: original.mileage,
        zip_code: original.zip_code,
        radiusMiles,
      },
      errorMessage: mcResult.success ? undefined : mcResult.error,
    })

    let candidates: MarketCheckComparable[]
    let valuationSource: 'marketcheck_vin_predict' | 'original_preserved_no_marketcheck_prediction'
    let predictedPrice: number
    let priceRange: { min: number; max: number } | undefined
    let confidence: 'low' | 'medium' | 'high'
    let totalComparablesFound: number
    let fallbackUsed: boolean

    if (mcResult.success && mcResult.data && !mcResult.fallbackUsed) {
      // Genuine primary-endpoint success — real MarketCheck valuation, and
      // listings that carry a real location.distance_miles when known.
      const allListings = mcResult.data.recentComparables?.listings ?? []
      const { prediction: validated } = await validateListingUrls(mcResult.data, {
        sortFn: listings => [...listings].sort(byClosestMileage(original.mileage)),
      })
      const validatedListings = validated.recentComparables?.listings ?? allListings

      const withinRadius = validatedListings.filter(l => distanceOf(l) <= radiusMiles)
      candidates = validatedFirst([...withinRadius].sort(byClosestMileage(original.mileage)))

      valuationSource = 'marketcheck_vin_predict'
      predictedPrice = mcResult.data.predictedPrice
      priceRange = mcResult.data.priceRange
      confidence = mcResult.data.confidence
      totalComparablesFound = mcResult.data.totalComparablesFound
      fallbackUsed = false
    } else {
      // VIN decode still fails — no MarketCheck-native valuation is available.
      // Carry the original report's valuation forward unchanged (never
      // synthesized by us) and source listings from a radius-bounded search
      // instead, paginating once more if the first page comes up short.
      const apiKey = process.env.MARKETCHECK_API_KEY
      if (!apiKey || !subjectVehicle) {
        await supabaseAdmin.from('reports').update({ status: 'failed' }).eq('id', newReportId)
        return NextResponse.json(
          {
            error:
              'VIN prediction failed and no fallback search is possible (missing API key or vehicle year/make/model)',
            newReportId,
          },
          { status: 500 }
        )
      }

      const searchModel =
        original.marketcheck_valuation?.recentComparables?.listings?.[0]?.model ??
        subjectVehicle.model

      const seenVins = new Set<string>()
      let merged: MarketCheckComparable[] = []
      let numFoundTotal = 0

      for (const yearOffset of YEAR_OFFSETS) {
        const searchYear = subjectVehicle.year + yearOffset
        const searchStartTime = Date.now()
        const searchResult = await fetchMarketCheckSearchByRadius(
          apiKey,
          searchYear,
          subjectVehicle.make,
          searchModel,
          original.zip_code,
          radiusMiles,
          0
        )
        await logApiCall({
          reportId: newReportId,
          provider: 'marketcheck',
          endpoint: '/v2/search/car/active',
          success: searchResult.success,
          responseTimeMs: Date.now() - searchStartTime,
          cost: 0.0,
          requestData: {
            year: searchYear,
            make: subjectVehicle.make,
            model: searchModel,
            zip: original.zip_code,
            radiusMiles,
          },
          errorMessage: searchResult.success ? undefined : searchResult.error,
        })

        // A single year turning up nothing (or erroring) doesn't mean the whole
        // band will — keep checking the other years in it.
        if (!searchResult.success || !searchResult.data) continue

        numFoundTotal += searchResult.data.totalComparablesFound
        const yearListings = (searchResult.data.recentComparables?.listings ?? []).filter(l => {
          if (!l.vin || seenVins.has(l.vin)) return false
          seenVins.add(l.vin)
          return true
        })
        merged = merged.concat(yearListings)

        if (merged.length >= RAW_CANDIDATE_POOL_TARGET) break
      }

      const cleaned = cleanAndFilterComparables(merged, subjectVehicle.year)
      const { prediction: validated } = await validateListingUrls(
        {
          predictedPrice: 0,
          confidence: 'low',
          dataSource: 'marketcheck',
          requestParams: {
            vin: original.vin,
            miles: original.mileage,
            zip: original.zip_code,
            dealer_type: 'franchise',
          },
          totalComparablesFound: cleaned.length,
          recentComparables: { num_found: cleaned.length, listings: cleaned },
          generatedAt: new Date().toISOString(),
        },
        { sortFn: listings => [...listings].sort(byClosestMileage(original.mileage)) }
      )
      candidates = validatedFirst(
        [...(validated.recentComparables?.listings ?? cleaned)].sort(
          byClosestMileage(original.mileage)
        )
      )

      valuationSource = 'original_preserved_no_marketcheck_prediction'
      predictedPrice = original.marketcheck_predicted_price ?? 0
      priceRange =
        original.marketcheck_price_range_min != null && original.marketcheck_price_range_max != null
          ? { min: original.marketcheck_price_range_min, max: original.marketcheck_price_range_max }
          : undefined
      confidence = original.marketcheck_confidence ?? 'low'
      totalComparablesFound = numFoundTotal
      fallbackUsed = true
    }

    const qualifyingListingsFound = candidates.length
    const finalListings = candidates.slice(0, MAX_SHOWN)

    const marketcheckValuation: MarketCheckPrediction = {
      predictedPrice,
      priceRange,
      confidence,
      dataSource: 'marketcheck',
      requestParams: {
        vin: original.vin,
        miles: original.mileage,
        zip: original.zip_code,
        dealer_type: (original.dealer_type as 'franchise' | 'independent') ?? 'franchise',
      },
      totalComparablesFound,
      recentComparables: {
        num_found: finalListings.length,
        listings: finalListings,
      },
      generatedAt: new Date().toISOString(),
    }

    await supabaseAdmin
      .from('reports')
      .update({
        marketcheck_valuation: marketcheckValuation,
        marketcheck_predicted_price: marketcheckValuation.predictedPrice,
        marketcheck_msrp: null,
        marketcheck_price_range_min: marketcheckValuation.priceRange?.min ?? null,
        marketcheck_price_range_max: marketcheckValuation.priceRange?.max ?? null,
        marketcheck_confidence: marketcheckValuation.confidence,
        marketcheck_total_comparables_found: marketcheckValuation.totalComparablesFound,
        marketcheck_recent_comparables_found: finalListings.length,
        marketcheck_fallback_used: fallbackUsed,
        comparables_supplemented: false,
        valuation_result: {
          predictedPrice: marketcheckValuation.predictedPrice,
          lowValue:
            marketcheckValuation.priceRange?.min ??
            Math.round(marketcheckValuation.predictedPrice * 0.9),
          averageValue: marketcheckValuation.predictedPrice,
          highValue:
            marketcheckValuation.priceRange?.max ??
            Math.round(marketcheckValuation.predictedPrice * 1.1),
          confidence: marketcheckValuation.confidence,
          dataPoints: marketcheckValuation.totalComparablesFound,
          dataSource: 'marketcheck',
        },
        data_retrieval_status: 'completed',
      })
      .eq('id', newReportId)

    // $0 payment record, matching the existing "admin free report" pattern —
    // preserves the original tier (Basic/Premium) for PDF rendering, and
    // makes the report viewable outside the token-based download link, without
    // implying a real charge (amount: 0, source flagged in metadata).
    await supabaseAdmin.from('payments').insert({
      report_id: newReportId,
      user_id: original.user_id,
      stripe_payment_id: `admin_radius_fix_${newReportId}`,
      amount: 0,
      status: 'succeeded',
      metadata: {
        source: 'admin_radius_fix',
        reportType: originalReportType,
        correctedFromReportId: originalReportId,
      },
    })

    // Cross-reference the original report (never otherwise modified).
    const originalNote = original['GL Notes'] ? `${original['GL Notes']}\n` : ''
    await supabaseAdmin
      .from('reports')
      .update({
        'GL Notes': `${originalNote}Superseded by ${newReportId} — customer reported comps not within driving distance, ${today}.`,
      })
      .eq('id', originalReportId)

    // price_paid: 0 on the new row means generateAndUploadPDF's automatic
    // Zoho "Report Delivery" enrollment (gated on a truthy price_paid) will
    // NOT fire — nothing gets emailed to the customer automatically.
    const pdfResult = await generateAndUploadPDF({ reportId: newReportId })
    if (!pdfResult.success) {
      await supabaseAdmin.from('reports').update({ status: 'failed' }).eq('id', newReportId)
      return NextResponse.json(
        { error: 'Report data corrected but PDF generation failed', newReportId },
        { status: 500 }
      )
    }

    const { data: finalReport } = await supabaseAdmin
      .from('reports')
      .select('pdf_download_token')
      .eq('id', newReportId)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.totallosstoolkit.com'

    return NextResponse.json({
      success: true,
      originalReportId,
      newReportId,
      radiusMiles,
      valuationSource,
      qualifyingListingsFound,
      listingsShown: finalListings.length,
      viewUrl: `${appUrl}/reports/${newReportId}/view`,
      downloadUrl: finalReport?.pdf_download_token
        ? `${appUrl}/api/reports/download/${finalReport.pdf_download_token}`
        : null,
    })
  } catch (error) {
    console.error('[RADIUS_FIX] Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
