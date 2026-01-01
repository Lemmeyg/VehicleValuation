/**
 * POST /api/reports/create
 *
 * Creates a new vehicle valuation report by fetching data from external APIs.
 *
 * Data Sources:
 * - Auto.dev VIN Decode API: LIVE vehicle specifications (year, make, model, trim, engine, etc.)
 * - MarketCheck Price Prediction API: LIVE pricing and comparable listings
 */

import { NextResponse } from 'next/server'
import { requireAuth, checkIfUserIsAdmin } from '@/lib/db/auth'
import { createRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/db/supabase'
import { getVinValidationError, sanitizeVin } from '@/lib/utils/vin-validator'
import {
  fetchAutoDevVinDecode, // REAL API for VIN decode
  type AutoDevVinDecodeData,
} from '@/lib/api/autodev-client'
// REMOVED: CarsXE import (replaced by MarketCheck)
import {
  fetchMarketCheckData, // REAL API (not mock)
  type MarketCheckPrediction,
} from '@/lib/api/marketcheck-client'
import { classifyDealerType } from '@/lib/utils/dealer-type-classifier'
import { reportCreationLimiter } from '@/lib/rate-limit'

const WEEKLY_LIMIT_HOURS = 168 // 7 days = 168 hours
const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true' // Development flag

export async function POST(request: Request) {
  try {
    // Require authentication
    const user = await requireAuth()

    // Weekly rate limit check: 1 report per 7 days (non-admin users)
    const isAdmin = await checkIfUserIsAdmin(user.id)

    console.log('[RATE_LIMIT_CHECK]', {
      userId: user.id,
      email: user.email,
      isAdmin,
      disableRateLimit: DISABLE_RATE_LIMIT,
      willCheckRateLimit: !isAdmin && !DISABLE_RATE_LIMIT,
    })

    if (!isAdmin && !DISABLE_RATE_LIMIT) {
      const supabase = await createRouteHandlerSupabaseClient()
      const { data: lastReport, error: rateCheckError } = await supabase
        .from('reports')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!rateCheckError && lastReport) {
        const lastCreated = new Date(lastReport.created_at)
        const now = new Date()
        const hoursSinceLastReport = (now.getTime() - lastCreated.getTime()) / (1000 * 60 * 60)

        if (hoursSinceLastReport < WEEKLY_LIMIT_HOURS) {
          const hoursRemaining = WEEKLY_LIMIT_HOURS - hoursSinceLastReport
          const daysRemaining = Math.floor(hoursRemaining / 24)
          const hoursRemainingAfterDays = Math.ceil(hoursRemaining % 24)
          const nextAvailableDate = new Date(
            lastCreated.getTime() + WEEKLY_LIMIT_HOURS * 60 * 60 * 1000
          )

          console.warn('[RATE_LIMIT] Weekly limit exceeded:', {
            userId: user.id,
            hoursRemaining: Math.ceil(hoursRemaining),
            daysRemaining,
            hoursRemainingAfterDays,
          })

          return NextResponse.json(
            {
              error: 'RATE_LIMIT_EXCEEDED',
              message: `You can create one report per week. Your next report will be available in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} and ${hoursRemainingAfterDays} hour${hoursRemainingAfterDays !== 1 ? 's' : ''}.`,
              daysRemaining,
              hoursRemaining: hoursRemainingAfterDays,
              nextAvailableDate: nextAvailableDate.toISOString(),
            },
            { status: 429 }
          )
        }
      }
    }

    // Rate limiting: 10 reports per hour per user
    try {
      await reportCreationLimiter.check(request, 10, user.id)
    } catch {
      return NextResponse.json(
        { error: 'Too many reports created. Please try again in an hour.' },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { vin: rawVin, mileage, zipCode } = body

    // Validate VIN
    const vin = sanitizeVin(rawVin)
    const validationError = getVinValidationError(vin)

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Validate mileage
    if (!mileage || typeof mileage !== 'number' || mileage < 0 || mileage > 999999) {
      return NextResponse.json(
        { error: 'Valid mileage required (0-999,999)' },
        { status: 400 }
      )
    }

    // Validate ZIP code
    if (!zipCode || typeof zipCode !== 'string' || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'Valid 5-digit ZIP code required' }, { status: 400 })
    }

    // Create initial report record (draft status)
    const supabase = await createRouteHandlerSupabaseClient()

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        vin,
        vehicle_data: {}, // Will be populated after API calls
        status: 'draft',
        data_retrieval_status: 'pending',
        price_paid: 0, // Will be set after payment
      })
      .select()
      .single()

    if (reportError) {
      console.error('Error creating report:', reportError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Fetch VIN decode data from Auto.dev API
    const startTime = Date.now()
    const autoDevVinResult = await fetchAutoDevVinDecode(vin)

    // Process Auto.dev VIN decode data
    let vehicleData: AutoDevVinDecodeData | null = null
    if (autoDevVinResult.success) {
      vehicleData = autoDevVinResult.data!

      // Log API call
      await logApiCall(report.id, 'autodev', '/vin', true, Date.now() - startTime, 0.0)
    } else {
      await logApiCall(
        report.id,
        'autodev',
        '/vin',
        false,
        Date.now() - startTime,
        0.0,
        autoDevVinResult.error
      )
    }

    // Determine dealer type for MarketCheck
    let dealerType: 'franchise' | 'independent' = 'franchise'
    if (vehicleData) {
      const classification = classifyDealerType(vehicleData.make, vehicleData.vehicle.year)
      dealerType = classification.dealerType

      console.log('[DEALER_TYPE] Using LIVE Auto.dev VIN data', {
        make: vehicleData.make,
        year: vehicleData.vehicle.year,
        classification: dealerType,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        note: 'Auto.dev VIN decode API provides real VIN data',
      })
    }

    // REMOVED: CarsXE is replaced by MarketCheck
    // No longer fetching CarsXE market comparables

    // Fetch MarketCheck price prediction
    let marketcheckValuation: MarketCheckPrediction | null = null
    if (vehicleData) {
      const marketCheckStartTime = Date.now()

      try {
        // Extract subject vehicle data for filtering comparables by model/trim
        const subjectVehicle = vehicleData
          ? {
              make: vehicleData.make,
              model: vehicleData.model,
              trim: vehicleData.trim,
            }
          : undefined

        const marketCheckResult = await fetchMarketCheckData(
          vin,
          mileage,
          zipCode,
          false, // is_certified
          undefined, // retryConfig (use default)
          subjectVehicle
        )

        if (marketCheckResult.success) {
          marketcheckValuation = marketCheckResult.data!

          await logApiCall(
            report.id,
            'marketcheck',
            '/predict/car/price',
            true,
            Date.now() - marketCheckStartTime,
            0.1, // $0.10 per call (estimate)
            undefined
          )

          console.log('[MARKETCHECK_SUCCESS]', {
            predictedPrice: marketcheckValuation.predictedPrice,
            comparables: marketcheckValuation.recentComparables?.num_found || 0,
            dealerType,
          })
        } else {
          // Log failure but continue (graceful degradation)
          await logApiCall(
            report.id,
            'marketcheck',
            '/predict/car/price',
            false,
            Date.now() - marketCheckStartTime,
            0.0,
            marketCheckResult.error
          )

          console.warn('[MARKETCHECK_FAILURE]', {
            error: marketCheckResult.error,
            statusCode: marketCheckResult.statusCode,
          })
        }
      } catch (error) {
        // Unexpected error - log but don't fail
        console.error('[MARKETCHECK_EXCEPTION]', error)

        await logApiCall(
          report.id,
          'marketcheck',
          '/predict/car/price',
          false,
          Date.now() - marketCheckStartTime,
          0.0,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    // Update report with fetched data
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        // Store normalized vehicle data for backward compatibility
        vehicle_data: vehicleData
          ? {
              vin: vehicleData.vin,
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
          : {},
        // Store complete Auto.dev VIN decode response
        autodev_vin_data: vehicleData || null,

        // MarketCheck valuation data
        marketcheck_valuation: marketcheckValuation || null,

        // NEW: Dedicated MarketCheck columns for faster queries
        ...(marketcheckValuation && {
          marketcheck_predicted_price: marketcheckValuation.predictedPrice,
          marketcheck_msrp: marketcheckValuation.msrp || null,
          marketcheck_price_range_min: marketcheckValuation.priceRange?.min || null,
          marketcheck_price_range_max: marketcheckValuation.priceRange?.max || null,
          marketcheck_confidence: marketcheckValuation.confidence,
          marketcheck_total_comparables_found: marketcheckValuation.totalComparablesFound,
          marketcheck_recent_comparables_found: marketcheckValuation.recentComparables?.num_found || 0,
        }),

        // Also update valuation_result for backward compatibility
        ...(marketcheckValuation && {
          valuation_result: {
            predictedPrice: marketcheckValuation.predictedPrice,
            lowValue: marketcheckValuation.priceRange?.min || Math.round(marketcheckValuation.predictedPrice * 0.9),
            averageValue: marketcheckValuation.predictedPrice,
            highValue: marketcheckValuation.priceRange?.max || Math.round(marketcheckValuation.predictedPrice * 1.1),
            confidence: marketcheckValuation.confidence,
            dataPoints: marketcheckValuation.totalComparablesFound,
            dataSource: 'marketcheck',
          },
        }),

        mileage: mileage,
        zip_code: zipCode,
        dealer_type: dealerType,
        data_retrieval_status: vehicleData ? 'completed' : 'failed',
      })
      .eq('id', report.id)

    if (updateError) {
      console.error('Error updating report:', updateError)
      return NextResponse.json({ error: 'Failed to update report data' }, { status: 500 })
    }

    // Return report with data
    return NextResponse.json(
      {
        message: 'Report created successfully',
        report: {
          id: report.id,
          vin,
          vehicleData,
          marketcheckValuation: marketcheckValuation,
          mileage,
          zipCode,
          dealerType,
          status: 'draft',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create report exception:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

/**
 * Log API call to database
 */
async function logApiCall(
  reportId: string,
  provider: string,
  endpoint: string,
  success: boolean,
  responseTimeMs: number,
  cost: number,
  errorMessage?: string
) {
  try {
    await supabaseAdmin.from('api_call_logs').insert({
      report_id: reportId,
      api_provider: provider,
      endpoint,
      success,
      response_time_ms: responseTimeMs,
      cost,
      error_message: errorMessage || null,
    })
  } catch (error) {
    console.error('Error logging API call:', error)
    // Don't fail the request if logging fails
  }
}
