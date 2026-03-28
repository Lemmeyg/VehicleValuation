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
import { classifyDealerType } from '@/lib/utils/dealer-type-classifier'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { logApiCall } from '@/lib/api/api-call-logger'

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
      })
      .select()
      .single()

    if (reportError || !report) {
      console.error('[ADMIN_FREE_REPORT] Error creating report:', reportError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
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
    if (vehicleData) {
      const subjectVehicle = {
        year: vehicleData.vehicle.year,
        make: vehicleData.make,
        model: vehicleData.model,
        trim: vehicleData.trim,
      }
      const mcStartTime = Date.now()
      const mcResult = await fetchMarketCheckData(
        vin,
        mileage,
        zipCode,
        false,
        undefined,
        subjectVehicle
      )

      if (mcResult.success) {
        const { prediction: validatedPrediction, stats: urlStats } = await validateListingUrls(
          mcResult.data!
        )
        marketcheckFallbackUsed = mcResult.fallbackUsed === true
        urlValidationFailedCount = urlStats.failedCount
        urlValidationFailedUrls = urlStats.failedUrls
        urlValidatedListingUrls = urlStats.validatedUrls

        const supplementResult = await supplementComparables(
          validatedPrediction,
          urlStats.validatedUrls.length,
          subjectVehicle,
          vin,
          mileage,
          zipCode
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
        cost: mcResult.success ? 0.09 : 0.0,
        requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
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
