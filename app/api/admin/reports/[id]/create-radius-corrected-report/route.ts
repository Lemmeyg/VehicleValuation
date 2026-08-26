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
 * Body: { radiusMiles?: number, strictYear?: boolean }  (default 300mi, whole year band)
 * Accepts JSON or a plain HTML form POST (application/x-www-form-urlencoded) —
 * the admin page's buttons use the latter, since a plain <form> can't send JSON.
 *
 * strictYear searches only the subject vehicle's exact model year instead of
 * the usual subjectYear-5..+2 band — useful for isolating how much the
 * year-band widening (vs. the mileage-closest ranking) changes the result.
 *

 * Distance is always computed locally (zipcodes.distance, offline, no extra
 * API calls) from each listing's dealer ZIP — never trusted from MarketCheck.
 * Two reasons: MarketCheck's returned distance/dist field is frequently just
 * absent, and MarketCheck's own zip+radius search parameter turned out to be
 * capped by the account's subscription plan — a 300mi request was rejected
 * outright (HTTP 422), not just answered with fewer results. Computing it
 * ourselves sidesteps both problems entirely.
 *
 * Two paths, tried in order:
 *  1. Retry the VIN-based MarketCheck prediction. If it succeeds this time,
 *     its predictedPrice/priceRange/confidence are MarketCheck's own
 *     valuation — not something this app calculates.
 *  2. If VIN decode still fails, no MarketCheck-native valuation is
 *     available, so the original report's valuation is carried forward
 *     unchanged (never synthesized by us). Listings come from a nationwide
 *     year/make/model search spanning the same model-year band every other
 *     report uses (subjectYear-5..+2), filtered to radiusMiles ourselves.
 *
 * Either way: listings are cleaned with the same rules every report uses,
 * URL-validated, ranked by closest mileage to the subject vehicle, and capped
 * at 10 (working links first) — or fewer, if that's genuinely all that
 * qualifies within radiusMiles. No automatic radius widening.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import zipcodes from 'zipcodes'
import {
  fetchMarketCheckData,
  fetchMarketCheckSearchFallback,
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
// healthy within-radius pool without needlessly querying every year in it.
const YEAR_OFFSETS = [0, -1, 1, -2, 2, -3, -4, -5]
const RAW_CANDIDATE_POOL_TARGET = MAX_SHOWN * 3
// Bounds total search-endpoint calls (year x page) regardless of how thin the
// local market turns out to be — keeps cost/time predictable.
const MAX_SEARCH_CALLS = 16

interface RouteParams {
  params: Promise<{ id: string }>
}

function distanceOf(l: MarketCheckComparable): number {
  return typeof l.location?.distance_miles === 'number' ? l.location.distance_miles : Infinity
}

/**
 * Straight-line miles between the subject ZIP and a listing's dealer ZIP,
 * computed locally via the offline `zipcodes` package. Returns a copy of the
 * listing with location.distance_miles set to that value, or null if the
 * listing has no usable ZIP (excluded — an unverifiable distance can't be
 * counted as "within radiusMiles").
 */
function withComputedDistance(
  subjectZip: string,
  listing: MarketCheckComparable
): MarketCheckComparable | null {
  const listingZip = listing.location?.zip
  if (!listingZip) return null
  let dist: number | null
  try {
    dist = zipcodes.distance(subjectZip, listingZip)
  } catch {
    return null
  }
  if (typeof dist !== 'number' || Number.isNaN(dist)) return null
  return { ...listing, location: { ...listing.location, distance_miles: dist } }
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

    // Accepts either a JSON body (curl/fetch) or a plain HTML form POST
    // (application/x-www-form-urlencoded — the admin page's buttons submit
    // this way, since a plain <form> can't send JSON). Read the raw text
    // once and try JSON first, falling back to URL-encoded form parsing.
    const rawBody = await request.text()
    let body: Record<string, unknown> = {}
    if (rawBody) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        body = Object.fromEntries(new URLSearchParams(rawBody).entries())
      }
    }

    const radiusMilesRaw = body.radiusMiles
    const radiusMiles: number =
      typeof radiusMilesRaw === 'number' && radiusMilesRaw > 0
        ? radiusMilesRaw
        : typeof radiusMilesRaw === 'string' && Number(radiusMilesRaw) > 0
          ? Number(radiusMilesRaw)
          : DEFAULT_RADIUS_MILES

    // strictYear: search only the subject vehicle's exact model year, not the
    // usual subjectYear-5..+2 band. Added on request to isolate the effect of
    // the year-band widening from the mileage-closest ranking change — both
    // landed in the same run originally.
    const strictYear = body.strictYear === true || body.strictYear === 'true'
    const yearOffsetsToUse = strictYear ? [0] : YEAR_OFFSETS

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
    if (!zipcodes.lookup(original.zip_code)) {
      return NextResponse.json(
        {
          error: `ZIP ${original.zip_code} isn't in the offline zip database — can't compute distance`,
        },
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
        'GL Notes': `Corrected replacement for report ${originalReportId} — ${radiusMiles}mi radius fix${strictYear && subjectVehicle ? ` (model year ${subjectVehicle.year} only)` : ''}, ${today}. Customer reported comps not within driving distance.`,
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
      // Genuine primary-endpoint success — real MarketCheck valuation.
      // Distance is still computed locally per listing ZIP (see
      // withComputedDistance), not trusted from MarketCheck's own field.
      const allListings = mcResult.data.recentComparables?.listings ?? []
      const { prediction: validated } = await validateListingUrls(mcResult.data, {
        sortFn: listings => [...listings].sort(byClosestMileage(original.mileage)),
      })
      const validatedListings = validated.recentComparables?.listings ?? allListings

      const withinRadius = validatedListings
        .map(l => withComputedDistance(original.zip_code, l))
        .filter((l): l is MarketCheckComparable => l !== null && distanceOf(l) <= radiusMiles)

      candidates = validatedFirst([...withinRadius].sort(byClosestMileage(original.mileage)))

      valuationSource = 'marketcheck_vin_predict'
      predictedPrice = mcResult.data.predictedPrice
      priceRange = mcResult.data.priceRange
      confidence = mcResult.data.confidence
      totalComparablesFound = mcResult.data.totalComparablesFound
      fallbackUsed = false
    } else {
      // VIN decode still fails — no MarketCheck-native valuation is
      // available. Carry the original report's valuation forward unchanged
      // and source listings from a nationwide year/make/model search
      // (same endpoint/params as the original bug's fallback), filtering to
      // radiusMiles ourselves from each listing's own ZIP.
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
      const withinRadiusPool: MarketCheckComparable[] = []
      let numFoundTotal = 0
      let searchCallsMade = 0

      yearLoop: for (const yearOffset of yearOffsetsToUse) {
        const searchYear = subjectVehicle.year + yearOffset

        for (const start of [0, 50, 100]) {
          if (searchCallsMade >= MAX_SEARCH_CALLS) break yearLoop
          if (withinRadiusPool.length >= RAW_CANDIDATE_POOL_TARGET) break yearLoop

          searchCallsMade++
          const searchStartTime = Date.now()
          const searchResult = await fetchMarketCheckSearchFallback(
            apiKey,
            searchYear,
            subjectVehicle.make,
            searchModel,
            original.vin,
            original.mileage,
            original.zip_code,
            start
          )
          await logApiCall({
            reportId: newReportId,
            provider: 'marketcheck',
            endpoint: '/v2/search/car/active',
            success: searchResult.success,
            responseTimeMs: Date.now() - searchStartTime,
            cost: 0.0,
            requestData: { year: searchYear, make: subjectVehicle.make, model: searchModel, start },
            errorMessage: searchResult.success ? undefined : searchResult.error,
          })

          if (!searchResult.success || !searchResult.data) break // no more pages for this year

          numFoundTotal += searchResult.data.totalComparablesFound
          const pageListings = searchResult.data.recentComparables?.listings ?? []
          if (pageListings.length === 0) break // exhausted this year's results

          for (const l of pageListings) {
            if (!l.vin || seenVins.has(l.vin)) continue
            seenVins.add(l.vin)
            const withDist = withComputedDistance(original.zip_code, l)
            if (!withDist || distanceOf(withDist) > radiusMiles) continue
            withinRadiusPool.push(withDist)
          }

          if (pageListings.length < 50) break // last page for this year
        }
      }

      const cleaned = cleanAndFilterComparables(withinRadiusPool, subjectVehicle.year)
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
      strictYear,
      yearsSearched: yearOffsetsToUse.map(o => (subjectVehicle ? subjectVehicle.year + o : o)),
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
