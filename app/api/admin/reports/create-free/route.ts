/**
 * POST /api/admin/reports/create-free
 *
 * Admin-only endpoint to create a vehicle valuation report without payment.
 * Runs the full pipeline: VIN decode → MarketCheck → PDF generation.
 * Records a $0 payment for audit trail.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import { getVinValidationError, sanitizeVin } from '@/lib/utils/vin-validator'
import { fetchAutoDevVinDecode, type AutoDevVinDecodeData } from '@/lib/api/autodev-client'
import { fetchMarketCheckData, type MarketCheckPrediction } from '@/lib/api/marketcheck-client'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import { supplementWithAlternateDealerType } from '@/lib/utils/dealer-type-supplementer'
import { gateListings } from '@/lib/utils/comp-gates'
import { makeScoreSortFn } from '@/lib/utils/comp-relevance-score'
import { classifyDealerType } from '@/lib/utils/dealer-type-classifier'

const MARKETCHECK_PRIMARY_DEALER_TYPE = 'franchise' as const
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { logApiCall } from '@/lib/api/api-call-logger'
import { upsertLead } from '@/lib/leads'

export async function POST(request: Request) {
  try {
    // Require admin — throws if not authenticated or not admin
    const user = await requireAdmin()

    // Parse body
    const body = await request.json()
    const { vin: rawVin, mileage, zipCode } = body

    // Validate VIN
    const vin = sanitizeVin(rawVin)
    const vinError = getVinValidationError(vin)
    if (vinError) {
      return NextResponse.json({ error: vinError }, { status: 400 })
    }

    // Validate mileage
    if (!mileage || typeof mileage !== 'number' || mileage < 0 || mileage > 999999) {
      return NextResponse.json({ error: 'Valid mileage required (0-999,999)' }, { status: 400 })
    }

    // Validate ZIP code
    if (!zipCode || typeof zipCode !== 'string' || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'Valid 5-digit ZIP code required' }, { status: 400 })
    }

    // Create draft report (service role bypasses RLS)
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: user.id,
        vin,
        vehicle_data: {},
        status: 'draft',
        data_retrieval_status: 'pending',
        price_paid: 0,
        email: user.email ?? null,
      })
      .select()
      .single()

    if (reportError || !report) {
      console.error('[ADMIN_FREE_REPORT] Error creating report:', reportError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Capture form_submitted lead — non-fatal. 'purchased' stays reserved for
    // the real LemonSqueezy webhook; this $0 admin report is an internal
    // bypass, not an actual transaction.
    if (user.email) {
      try {
        await upsertLead(supabaseAdmin, user.email, 'form_submitted')
      } catch (leadErr) {
        console.error('[ADMIN_FREE_REPORT] Lead capture failed (non-fatal):', leadErr)
      }
    }

    // Fetch VIN decode
    const autoDevStartTime = Date.now()
    const autoDevResult = await fetchAutoDevVinDecode(vin)
    const vehicleData: AutoDevVinDecodeData | null = autoDevResult.success
      ? autoDevResult.data!
      : null

    await logApiCall({
      reportId: report.id,
      provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: autoDevResult.success,
      responseTimeMs: Date.now() - autoDevStartTime,
      cost: 0.0,
      requestData: { vin },
      responseData:
        autoDevResult.success && autoDevResult.data
          ? {
              make: autoDevResult.data.make,
              model: autoDevResult.data.model,
              year: autoDevResult.data.vehicle.year,
              vinValid: autoDevResult.data.vinValid,
            }
          : undefined,
      errorMessage: autoDevResult.success ? undefined : autoDevResult.error,
    })

    // Classify dealer type
    let dealerType: 'franchise' | 'independent' = 'franchise'
    if (vehicleData) {
      const classification = classifyDealerType(vehicleData.make, vehicleData.vehicle.year)
      dealerType = classification.dealerType
    }

    // Fetch MarketCheck valuation
    let marketcheckValuation: MarketCheckPrediction | null = null
    let marketcheckFallbackUsed = false
    let urlValidationFailedCount: number | null = null
    let urlValidationFailedUrls: string[] | null = null
    let urlValidatedListingUrls: string[] | null = null
    let comparablesSupplemented = false
    let alternateDealerTypeUsed = false
    if (vehicleData) {
      const subjectVehicle = {
        year: vehicleData.vehicle.year,
        make: vehicleData.make,
        model: vehicleData.model,
        trim: vehicleData.trim,
      }
      const mcStartTime = Date.now()
      // MarketCheck requires a dealer_type on every call to this endpoint and only
      // accepts one value at a time (no "both") — this asks for franchise first;
      // the alternate-dealer-type step below asks for independent too, but only
      // if franchise alone doesn't turn up enough validated listings.
      const mcResult = await fetchMarketCheckData(
        vin,
        mileage,
        zipCode,
        false,
        undefined,
        subjectVehicle,
        MARKETCHECK_PRIMARY_DEALER_TYPE
      )

      if (mcResult.success) {
        // Gate comps (price / mileage / ±40% band) BEFORE URL validation
        // so a disqualified comp is never HTTP-checked, and check the survivors
        // in weighted-relevance-score order.
        const gatedListings = gateListings(
          mcResult.data!.recentComparables?.listings ?? [],
          mcResult.data!.predictedPrice
        )
        const { prediction: validatedPrediction, stats: urlStats } = await validateListingUrls(
          {
            ...mcResult.data!,
            recentComparables: {
              ...mcResult.data!.recentComparables!,
              listings: gatedListings,
              num_found: gatedListings.length,
            },
          },
          {
            sortFn: makeScoreSortFn(
              {
                year: subjectVehicle.year,
                mileage,
                zip: zipCode,
                model: subjectVehicle.model,
                trim: subjectVehicle.trim,
              },
              mcResult.data!.predictedPrice
            ),
          }
        )
        marketcheckFallbackUsed = mcResult.fallbackUsed === true

        const dealerTypeResult = await supplementWithAlternateDealerType(
          validatedPrediction,
          urlStats.validatedUrls.length,
          vin,
          mileage,
          zipCode,
          MARKETCHECK_PRIMARY_DEALER_TYPE,
          subjectVehicle,
          false,
          report.id
        )
        urlValidationFailedCount = urlStats.failedCount + dealerTypeResult.additionalFailedCount
        urlValidationFailedUrls = [...urlStats.failedUrls, ...dealerTypeResult.additionalFailedUrls]
        urlValidatedListingUrls = [
          ...urlStats.validatedUrls,
          ...dealerTypeResult.additionalValidatedUrls,
        ]
        alternateDealerTypeUsed = dealerTypeResult.supplemented

        const supplementResult = await supplementComparables(
          dealerTypeResult.prediction,
          urlValidatedListingUrls.length,
          subjectVehicle,
          vin,
          mileage,
          zipCode,
          mcResult.data!.predictedPrice,
          report.id
        )
        marketcheckValuation = supplementResult.prediction
        comparablesSupplemented = supplementResult.supplemented
      }

      await logApiCall({
        reportId: report.id,
        provider: 'marketcheck',
        endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
        success: mcResult.success,
        responseTimeMs: Date.now() - mcStartTime,
        cost: mcResult.success ? (alternateDealerTypeUsed ? 0.18 : 0.09) : 0.0, // a second dealer_type call, when it fires, is a second billed request
        requestData: {
          vin,
          mileage,
          zip_code: zipCode,
          dealer_type:
            marketcheckValuation?.requestParams?.dealer_type ?? MARKETCHECK_PRIMARY_DEALER_TYPE,
        },
        responseData:
          mcResult.success && marketcheckValuation
            ? {
                predicted_price: marketcheckValuation.predictedPrice,
                total_comparables_found: marketcheckValuation.totalComparablesFound,
                recent_comparables_found: marketcheckValuation.recentComparables?.num_found ?? 0,
              }
            : undefined,
        errorMessage: mcResult.success ? undefined : mcResult.error,
      })
    }

    // Update report with fetched data
    await supabaseAdmin
      .from('reports')
      .update({
        vehicle_data: vehicleData
          ? {
              vin,
              mileage,
              zipCode,
              year: vehicleData.vehicle.year.toString(),
              make: vehicleData.make,
              model: vehicleData.model,
              trim: vehicleData.trim,
              bodyType: vehicleData.body,
              engine: vehicleData.engine,
              transmission: vehicleData.transmission,
              driveType: vehicleData.drive,
              fuelType: vehicleData.type,
            }
          : { vin, mileage, zipCode },
        autodev_vin_data: vehicleData || null,
        marketcheck_valuation: marketcheckValuation || null,
        ...(marketcheckValuation && {
          marketcheck_predicted_price: marketcheckValuation.predictedPrice,
          marketcheck_msrp: marketcheckValuation.msrp || null,
          marketcheck_price_range_min: marketcheckValuation.priceRange?.min || null,
          marketcheck_price_range_max: marketcheckValuation.priceRange?.max || null,
          marketcheck_confidence: marketcheckValuation.confidence,
          marketcheck_total_comparables_found: marketcheckValuation.totalComparablesFound,
          marketcheck_recent_comparables_found:
            marketcheckValuation.recentComparables?.num_found || 0,
          valuation_result: {
            predictedPrice: marketcheckValuation.predictedPrice,
            lowValue:
              marketcheckValuation.priceRange?.min ||
              Math.round(marketcheckValuation.predictedPrice * 0.9),
            averageValue: marketcheckValuation.predictedPrice,
            highValue:
              marketcheckValuation.priceRange?.max ||
              Math.round(marketcheckValuation.predictedPrice * 1.1),
            confidence: marketcheckValuation.confidence,
            dataPoints: marketcheckValuation.totalComparablesFound,
            dataSource: 'marketcheck',
          },
        }),
        ...(urlValidationFailedCount !== null && {
          url_validation_failed_count: urlValidationFailedCount,
          url_validation_failed_urls: urlValidationFailedUrls,
          validated_listing_urls: urlValidatedListingUrls,
        }),
        marketcheck_fallback_used: marketcheckFallbackUsed,
        comparables_supplemented: comparablesSupplemented,
        mileage,
        zip_code: zipCode,
        dealer_type: dealerType,
        vehicle_make: vehicleData?.make ?? null,
        vehicle_model: vehicleData?.model ?? null,
        vehicle_year: vehicleData?.vehicle.year ?? null,
        data_retrieval_status: vehicleData ? 'completed' : 'failed',
      })
      .eq('id', report.id)

    // Create $0 payment record for audit trail
    await supabaseAdmin.from('payments').insert({
      report_id: report.id,
      user_id: user.id,
      stripe_payment_id: `admin_free_${report.id}`,
      amount: 0,
      status: 'succeeded',
      metadata: { source: 'admin_free', reportType: 'admin' },
    })

    // Generate PDF
    const pdfResult = await generateAndUploadPDF({ reportId: report.id })

    if (!pdfResult.success) {
      console.error('[ADMIN_FREE_REPORT] PDF generation failed:', pdfResult.error)
      await supabaseAdmin.from('reports').update({ status: 'failed' }).eq('id', report.id)
      return NextResponse.json(
        { error: 'Report created but PDF generation failed', reportId: report.id },
        { status: 500 }
      )
    }

    // Mark completed
    await supabaseAdmin.from('reports').update({ status: 'completed' }).eq('id', report.id)

    return NextResponse.json({ reportId: report.id }, { status: 201 })
  } catch (error) {
    console.error('[ADMIN_FREE_REPORT] Unexpected error:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
