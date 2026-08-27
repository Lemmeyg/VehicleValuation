/**
 * POST /api/reports/[id]/fetch-marketcheck
 *
 * Fetches MarketCheck price prediction and comparable vehicles
 * Triggered by user clicking "Continue" button on pricing page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { requireAuth } from '@/lib/db/auth'
import { validateBeforeMarketCheckCall } from '@/lib/security/report-validation'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { logApiCall } from '@/lib/api/api-call-logger'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import { supplementWithAlternateDealerType } from '@/lib/utils/dealer-type-supplementer'
import { rankByBestMatch } from '@/lib/utils/comparables-ranker'

const PRIMARY_DEALER_TYPE = 'franchise' as const

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reportId } = await params

    // Authentication check
    const user = await requireAuth()

    console.log(`[MarketCheck] Request for report ${reportId} by user ${user.id}`)

    // Validate before API call (security check)
    const validation = await validateBeforeMarketCheckCall(reportId, user.id)

    if (!validation.valid) {
      console.error(`[MarketCheck] Validation failed:`, validation.error)
      return NextResponse.json(
        { error: validation.error, errorCode: validation.errorCode },
        { status: validation.errorCode === 'UNAUTHORIZED' ? 403 : 400 }
      )
    }

    const { vin, mileage, zip_code } = validation.data!

    // Fetch full report to get vehicle_data for filtering comparables
    const supabase = await createServerSupabaseClient()
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('vin, mileage, zip_code, vehicle_data')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      console.error(`[MarketCheck] Failed to fetch report:`, reportError)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Extract subject vehicle info for filtering comparables.
    // vehicle_data.year is stored as a string in Supabase JSONB. Number() always returns
    // `number` (never undefined), so year is typed as number and the > 0 guard handles
    // missing/NaN values at runtime without introducing number | undefined.
    const vehicleYear = Number(report.vehicle_data?.year)
    const subjectVehicle =
      report.vehicle_data && vehicleYear > 0
        ? {
            year: vehicleYear,
            make: report.vehicle_data.make as string,
            model: report.vehicle_data.model as string,
            trim: report.vehicle_data.trim as string | undefined,
          }
        : undefined

    console.log(`[MarketCheck] Calling API`, { vin, mileage, zip_code, subjectVehicle })

    const apiStartTime = Date.now()

    // Call MarketCheck API with retry logic and subject vehicle for filtering.
    // MarketCheck requires a dealer_type on every call to this endpoint and only
    // accepts one value at a time (no "both") — this asks for franchise first;
    // supplementWithAlternateDealerType() below asks for independent too, but
    // only if franchise alone doesn't turn up enough validated listings.
    const marketcheckResult = await fetchMarketCheckData(
      vin,
      mileage,
      zip_code,
      false, // is_certified - default to false
      undefined, // retryConfig (use default)
      subjectVehicle, // NEW: Pass subject vehicle for filtering comparables
      PRIMARY_DEALER_TYPE
    )

    const apiResponseTime = Date.now() - apiStartTime

    if (marketcheckResult.success && marketcheckResult.data) {
      console.log(`[MarketCheck] API success`, {
        predictedPrice: marketcheckResult.data.predictedPrice,
        totalComparables: marketcheckResult.data.totalComparablesFound,
        recentComparablesFound: marketcheckResult.data.recentComparables?.num_found,
        listingsFromPrimary: marketcheckResult.data.recentComparables?.listings?.length,
        responseTimeMs: apiResponseTime,
      })

      // ========================================
      // URL Validation + Supplementation
      // ========================================
      // Check links in best-match order (year, then distance, then price proximity, then
      // mileage) rather than
      // freshness order, so the "find 10 live links" search spends its budget on the
      // listings that are actually the best candidates to show — not just whichever
      // happened to be freshest.
      const { prediction: validatedPrediction, stats: urlStats } = await validateListingUrls(
        marketcheckResult.data,
        subjectVehicle
          ? {
              sortFn: l =>
                rankByBestMatch(l, {
                  year: subjectVehicle.year,
                  mileage,
                  zip: zip_code,
                  predictedPrice: marketcheckResult.data!.predictedPrice,
                }),
            }
          : undefined
      )

      // If franchise alone didn't turn up enough validated listings, try independent
      // dealers too before falling back to the broader nationwide search below —
      // still MarketCheck's own VIN-matched data, just the other dealer type.
      const dealerTypeResult = await supplementWithAlternateDealerType(
        validatedPrediction,
        urlStats.validatedUrls.length,
        vin,
        mileage,
        zip_code,
        PRIMARY_DEALER_TYPE,
        subjectVehicle
      )
      const mergedUrlStats = {
        validatedUrls: [...urlStats.validatedUrls, ...dealerTypeResult.additionalValidatedUrls],
        failedUrls: [...urlStats.failedUrls, ...dealerTypeResult.additionalFailedUrls],
        failedCount: urlStats.failedCount + dealerTypeResult.additionalFailedCount,
      }

      const supplementResult = await supplementComparables(
        dealerTypeResult.prediction,
        mergedUrlStats.validatedUrls.length,
        subjectVehicle,
        vin,
        mileage,
        zip_code,
        marketcheckResult.data!.predictedPrice
      )
      const finalPrediction = supplementResult.prediction

      console.log(`[MarketCheck] Pipeline complete`, {
        primaryListings: marketcheckResult.data.recentComparables?.listings?.length ?? 0,
        urlValidated: mergedUrlStats.validatedUrls.length,
        urlFailed: mergedUrlStats.failedCount,
        alternateDealerTypeUsed: dealerTypeResult.supplemented,
        supplemented: supplementResult.supplemented,
        finalListings: finalPrediction.recentComparables?.listings?.length ?? 0,
      })

      // ========================================
      // Fetch Auto.dev VIN Decode Data
      // ========================================
      let autodevVinData = null

      console.log(`[AutoDev VIN] Starting VIN decode for ${vin}`)
      const vinStartTime = Date.now()

      const vinDecodeResult = await fetchAutoDevVinDecode(vin)
      const vinResponseTime = Date.now() - vinStartTime

      if (vinDecodeResult.success && vinDecodeResult.data) {
        console.log(`[AutoDev VIN] Success`, {
          make: vinDecodeResult.data.make,
          model: vinDecodeResult.data.model,
          year: vinDecodeResult.data.vehicle?.year,
          responseTimeMs: vinResponseTime,
        })

        // Store with timestamp
        autodevVinData = {
          ...vinDecodeResult.data,
          generatedAt: new Date().toISOString(),
        }

        // Log successful API call
        await logApiCall({
          reportId,
          provider: 'autodev',
          endpoint: '/vin/{vin}',
          success: true,
          responseTimeMs: vinResponseTime,
          cost: 0.0,
          requestData: { vin },
          responseData: {
            make: vinDecodeResult.data.make,
            model: vinDecodeResult.data.model,
            year: vinDecodeResult.data.vehicle?.year,
            vinValid: vinDecodeResult.data.vinValid,
          },
        })
      } else {
        // Soft fail - log error but continue
        console.warn(`[AutoDev VIN] Failed:`, vinDecodeResult.error)

        // Log failed API call
        await logApiCall({
          reportId,
          provider: 'autodev',
          endpoint: '/vin/{vin}',
          success: false,
          responseTimeMs: vinResponseTime,
          cost: 0.0,
          requestData: { vin },
          errorMessage: vinDecodeResult.error,
        })
      }

      // ========================================
      // Store MarketCheck AND Auto.dev results in database
      // ========================================
      const supabase = await createServerSupabaseClient()

      // Store MarketCheck AND Auto.dev results in database
      const { error: mcUpdateError } = await supabase
        .from('reports')
        .update({
          // Main JSONB data — use supplemented prediction so listings are populated
          marketcheck_valuation: finalPrediction,
          autodev_vin_data: autodevVinData,

          // Dedicated columns for faster queries (cached from JSONB)
          marketcheck_predicted_price: finalPrediction.predictedPrice,
          marketcheck_msrp: finalPrediction.msrp || null,
          marketcheck_price_range_min: finalPrediction.priceRange?.min || null,
          marketcheck_price_range_max: finalPrediction.priceRange?.max || null,
          marketcheck_confidence: finalPrediction.confidence,
          marketcheck_total_comparables_found: finalPrediction.totalComparablesFound,
          marketcheck_recent_comparables_found:
            finalPrediction.recentComparables?.listings?.length || 0,

          // URL validation stats
          url_validation_failed_count: mergedUrlStats.failedCount,
          url_validation_failed_urls: mergedUrlStats.failedUrls,
          validated_listing_urls: mergedUrlStats.validatedUrls,
          comparables_supplemented: supplementResult.supplemented,

          // Also update valuation_result (replaces CarsXE)
          valuation_result: {
            predictedPrice: finalPrediction.predictedPrice,
            lowValue:
              finalPrediction.priceRange?.min || Math.round(finalPrediction.predictedPrice * 0.9),
            averageValue: finalPrediction.predictedPrice,
            highValue:
              finalPrediction.priceRange?.max || Math.round(finalPrediction.predictedPrice * 1.1),
            confidence: finalPrediction.confidence,
            dataPoints: finalPrediction.totalComparablesFound,
            dataSource: 'marketcheck',
          },
        })
        .eq('id', reportId)

      if (mcUpdateError) {
        console.error(`[MarketCheck] Error saving results:`, mcUpdateError)
        return NextResponse.json({ error: 'Failed to save results' }, { status: 500 })
      }

      // Log API call for cost tracking
      await logApiCall({
        reportId,
        provider: 'marketcheck',
        endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
        success: true,
        responseTimeMs: apiResponseTime,
        cost: dealerTypeResult.supplemented ? 0.18 : 0.09, // a second dealer_type call, when it fires, is a second billed request
        requestData: {
          vin,
          mileage,
          zip_code,
          dealer_type: finalPrediction.requestParams.dealer_type,
        },
        responseData: {
          predicted_price: finalPrediction.predictedPrice,
          total_comparables_found: finalPrediction.totalComparablesFound,
          recent_comparables_found: finalPrediction.recentComparables?.listings?.length ?? 0,
          supplemented: supplementResult.supplemented,
        },
      })

      return NextResponse.json({
        success: true,
        data: finalPrediction,
      })
    } else {
      console.error(`[MarketCheck] API failed:`, marketcheckResult.error)

      // Log failed API call
      await logApiCall({
        reportId,
        provider: 'marketcheck',
        endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
        success: false,
        responseTimeMs: apiResponseTime,
        cost: 0.0,
        requestData: { vin, mileage, zip_code, dealer_type: PRIMARY_DEALER_TYPE },
        errorMessage: marketcheckResult.error,
      })

      return NextResponse.json(
        {
          error: marketcheckResult.error,
          statusCode: marketcheckResult.statusCode,
        },
        { status: marketcheckResult.statusCode || 500 }
      )
    }
  } catch (error) {
    console.error('[MarketCheck] Exception:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
