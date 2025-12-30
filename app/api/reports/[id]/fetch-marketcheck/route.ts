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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Extract subject vehicle info for filtering comparables
    const subjectVehicle = report.vehicle_data
      ? {
          make: report.vehicle_data.make,
          model: report.vehicle_data.model,
          trim: report.vehicle_data.trim,
        }
      : undefined

    console.log(`[MarketCheck] Calling API`, { vin, mileage, zip_code, subjectVehicle })

    const apiStartTime = Date.now()

    // Call MarketCheck API with retry logic and subject vehicle for filtering
    const marketcheckResult = await fetchMarketCheckData(
      vin,
      mileage,
      zip_code,
      false, // is_certified - default to false
      undefined, // retryConfig (use default)
      subjectVehicle // NEW: Pass subject vehicle for filtering comparables
    )

    const apiResponseTime = Date.now() - apiStartTime

    if (marketcheckResult.success && marketcheckResult.data) {
      console.log(`[MarketCheck] API success`, {
        predictedPrice: marketcheckResult.data.predictedPrice,
        totalComparables: marketcheckResult.data.totalComparablesFound,
        recentComparablesFound: marketcheckResult.data.recentComparables?.num_found,
        listingsStoredCount: marketcheckResult.data.recentComparables?.listings?.length,
        responseTimeMs: apiResponseTime,
      })

      // DEBUG: Log the listings array structure (first 3 only to avoid log spam)
      if (marketcheckResult.data.recentComparables?.listings) {
        const totalListings = marketcheckResult.data.recentComparables.listings.length
        console.log(`[MarketCheck] Storing ${totalListings} listings in database (all recent comparables, no artificial limit)`)
        console.log(`[MarketCheck] Sample listings (first 3 of ${totalListings}):`,
          JSON.stringify(marketcheckResult.data.recentComparables.listings.slice(0, 3), null, 2)
        )
      } else {
        console.warn(`[MarketCheck] WARNING: No recentComparables.listings found in response`)
      }

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

        // Get Supabase admin client for logging
        const supabase = await createServerSupabaseClient()

        // Log successful API call
        await supabase.from('api_call_logs').insert({
          report_id: reportId,
          api_provider: 'autodev',
          endpoint: '/vin/{vin}',
          cost: 0.00, // FREE tier - adjust if using paid tier
          success: true,
          response_time_ms: vinResponseTime,
          request_data: { vin },
          response_data: {
            make: vinDecodeResult.data.make,
            model: vinDecodeResult.data.model,
            year: vinDecodeResult.data.vehicle?.year,
            vinValid: vinDecodeResult.data.vinValid,
          },
        })
      } else {
        // Soft fail - log error but continue
        console.warn(`[AutoDev VIN] Failed:`, vinDecodeResult.error)

        // Get Supabase admin client for logging
        const supabase = await createServerSupabaseClient()

        // Log failed API call
        await supabase.from('api_call_logs').insert({
          report_id: reportId,
          api_provider: 'autodev',
          endpoint: '/vin/{vin}',
          cost: 0.00,
          success: false,
          error_message: vinDecodeResult.error,
          response_time_ms: vinResponseTime,
          request_data: { vin },
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
          // Main JSONB data (includes recent comparables + all stats)
          marketcheck_valuation: marketcheckResult.data,
          autodev_vin_data: autodevVinData, // NEW: Store VIN decode data

          // NEW: Dedicated columns for faster queries (cached from JSONB)
          marketcheck_predicted_price: marketcheckResult.data.predictedPrice,
          marketcheck_msrp: marketcheckResult.data.msrp || null,
          marketcheck_price_range_min: marketcheckResult.data.priceRange?.min || null,
          marketcheck_price_range_max: marketcheckResult.data.priceRange?.max || null,
          marketcheck_confidence: marketcheckResult.data.confidence,
          marketcheck_total_comparables_found: marketcheckResult.data.totalComparablesFound,
          marketcheck_recent_comparables_found: marketcheckResult.data.recentComparables?.num_found || 0,

          // IMPORTANT: Also update valuation_result to MarketCheck (replaces CarsXE)
          valuation_result: {
            predictedPrice: marketcheckResult.data.predictedPrice,
            lowValue: marketcheckResult.data.priceRange?.min || Math.round(marketcheckResult.data.predictedPrice * 0.9),
            averageValue: marketcheckResult.data.predictedPrice,
            highValue: marketcheckResult.data.priceRange?.max || Math.round(marketcheckResult.data.predictedPrice * 1.1),
            confidence: marketcheckResult.data.confidence,
            dataPoints: marketcheckResult.data.totalComparablesFound,
            dataSource: 'marketcheck',
          },
        })
        .eq('id', reportId)

      if (mcUpdateError) {
        console.error(`[MarketCheck] Error saving results:`, mcUpdateError)
        return NextResponse.json(
          { error: 'Failed to save results' },
          { status: 500 }
        )
      }

      // Log API call for cost tracking
      await supabase.from('api_call_logs').insert({
        report_id: reportId,
        api_provider: 'marketcheck',
        endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
        cost: 0.09, // $0.09 per call
        success: true,
        response_time_ms: apiResponseTime,
        request_data: {
          vin,
          mileage,
          zip_code,
          dealer_type: 'franchise',
        },
        response_data: {
          predicted_price: marketcheckResult.data.predictedPrice,
          total_comparables_found: marketcheckResult.data.totalComparablesFound,
          recent_comparables_found: marketcheckResult.data.recentComparables?.num_found || 0,
        },
      })

      return NextResponse.json({
        success: true,
        data: marketcheckResult.data,
      })
    } else {
      console.error(`[MarketCheck] API failed:`, marketcheckResult.error)

      // Get Supabase admin client for logging
      const supabase = await createServerSupabaseClient()

      // Log failed API call
      await supabase.from('api_call_logs').insert({
        report_id: reportId,
        api_provider: 'marketcheck',
        endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
        cost: 0.00, // No cost for failed calls
        success: false,
        error_message: marketcheckResult.error,
        response_time_ms: apiResponseTime,
        request_data: {
          vin,
          mileage,
          zip_code,
          dealer_type: 'franchise',
        },
      })

      return NextResponse.json(
        {
          error: marketcheckResult.error,
          statusCode: marketcheckResult.statusCode
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
