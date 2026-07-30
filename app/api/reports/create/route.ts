/**
 * POST /api/reports/create
 *
 * Creates a new report by fetching data from external APIs.
 *
 * Data Sources:
 * - Auto.dev VIN Decode API: LIVE vehicle specifications (year, make, model, trim, engine, etc.)
 * - MarketCheck Price Prediction API: LIVE pricing and comparable listings
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/db/auth'
import { isAdmin } from '@/lib/db/admin-auth'
import { createRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/db/supabase'
import { upsertLead } from '@/lib/leads'
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
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import { reportCreationLimiter } from '@/lib/rate-limit'
import { logApiCall } from '@/lib/api/api-call-logger'
import { resolveStateCodeFromZip } from '@/lib/personalization/zip-to-state'
import { resolveStateArticle } from '@/lib/personalization/state-article'
import { resolveVehicleGuideSlug } from '@/lib/personalization/vehicle-year-article'
import { buildKbArticleUrl } from '@/lib/personalization/kb-article-url'

const WEEKLY_LIMIT_HOURS = 168 // 7 days = 168 hours
const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true' // Development flag

export async function POST(request: Request) {
  try {
    // Require authentication
    const user = await requireAuth()

    // Weekly rate limit check: 1 report per 7 days (non-admin users)
    const userIsAdmin = await isAdmin(user.id)

    console.log('[RATE_LIMIT_CHECK]', {
      userId: user.id,
      email: user.email,
      isAdmin: userIsAdmin,
      disableRateLimit: DISABLE_RATE_LIMIT,
      willCheckRateLimit: !userIsAdmin && !DISABLE_RATE_LIMIT,
    })

    if (!userIsAdmin && !DISABLE_RATE_LIMIT) {
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
      return NextResponse.json({ error: 'Valid mileage required (0-999,999)' }, { status: 400 })
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
        email: user.email ?? null,
      })
      .select()
      .single()

    if (reportError) {
      console.error('Error creating report:', reportError)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }

    // Capture form_submitted lead — non-fatal. Authenticated users starting a
    // report are a lead regardless of whether they've purchased yet.
    if (user.email) {
      try {
        await upsertLead(supabaseAdmin, user.email, 'form_submitted')
      } catch (leadErr) {
        console.error('[create] Lead capture failed (non-fatal):', leadErr)
      }
    }

    // Fetch VIN decode data from Auto.dev API
    const startTime = Date.now()
    const autoDevVinResult = await fetchAutoDevVinDecode(vin)

    // Process Auto.dev VIN decode data
    let vehicleData: AutoDevVinDecodeData | null = null
    if (autoDevVinResult.success) {
      vehicleData = autoDevVinResult.data!

      // Log API call
      await logApiCall({
        reportId: report.id,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: Date.now() - startTime,
        cost: 0.0,
        requestData: { vin },
        responseData: {
          make: vehicleData.make,
          model: vehicleData.model,
          year: vehicleData.vehicle.year,
          vinValid: vehicleData.vinValid,
        },
      })
    } else {
      await logApiCall({
        reportId: report.id,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: false,
        responseTimeMs: Date.now() - startTime,
        cost: 0.0,
        requestData: { vin },
        errorMessage: autoDevVinResult.error,
      })
    }

    // Resolve the Abandoned Report Recovery personalization links at
    // submission time, same as create-anonymous, so they're available
    // immediately rather than only once the recovery cron runs.
    const stateCode = resolveStateCodeFromZip(zipCode)
    const { stateName, slug: stateSlug } = resolveStateArticle(stateCode)
    const stateArticleUrl = buildKbArticleUrl(stateSlug, 'state_article')

    const vehicleGuideSlug = resolveVehicleGuideSlug(vehicleData?.vehicle.year ?? null)
    const vehicleGuideUrl = buildKbArticleUrl(vehicleGuideSlug, 'vehicle_guide')

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
    let marketcheckFallbackUsed = false
    let urlValidationFailedCount: number | null = null
    let urlValidationFailedUrls: string[] | null = null
    let urlValidatedListingUrls: string[] | null = null
    let comparablesSupplemented = false
    if (vehicleData) {
      const marketCheckStartTime = Date.now()

      try {
        // Extract subject vehicle data for filtering comparables by model/trim
        const subjectVehicle = vehicleData
          ? {
              year: vehicleData.vehicle.year,
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
          const { prediction: validatedPrediction, stats: urlStats } = await validateListingUrls(
            marketCheckResult.data!
          )
          marketcheckValuation = validatedPrediction
          marketcheckFallbackUsed = marketCheckResult.fallbackUsed === true
          urlValidationFailedCount = urlStats.failedCount
          urlValidationFailedUrls = urlStats.failedUrls
          urlValidatedListingUrls = urlStats.validatedUrls

          // Top-up: if fewer than 10 valid listings survived URL validation, supplement from search fallback
          try {
            const { prediction: supplementedPrediction, supplemented } =
              await supplementComparables(
                validatedPrediction,
                urlStats.validatedUrls.length,
                subjectVehicle,
                vin,
                mileage,
                zipCode
              )
            marketcheckValuation = supplementedPrediction
            comparablesSupplemented = supplemented
          } catch (err) {
            console.error('[SUPPLEMENT_EXCEPTION]', err)
            // Non-fatal: use pre-supplement prediction
          }

          await logApiCall({
            reportId: report.id,
            provider: 'marketcheck',
            endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
            success: true,
            responseTimeMs: Date.now() - marketCheckStartTime,
            cost: 0.09,
            requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
            responseData: {
              predicted_price: marketcheckValuation!.predictedPrice,
              total_comparables_found: marketcheckValuation!.totalComparablesFound,
              recent_comparables_found: marketcheckValuation!.recentComparables?.num_found ?? 0,
            },
          })

          console.log('[MARKETCHECK_SUCCESS]', {
            predictedPrice: marketcheckValuation.predictedPrice,
            comparables: marketcheckValuation.recentComparables?.num_found || 0,
            dealerType,
          })
        } else {
          // Log failure but continue (graceful degradation)
          await logApiCall({
            reportId: report.id,
            provider: 'marketcheck',
            endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
            success: false,
            responseTimeMs: Date.now() - marketCheckStartTime,
            cost: 0.0,
            requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
            errorMessage: marketCheckResult.error,
          })

          console.warn('[MARKETCHECK_FAILURE]', {
            error: marketCheckResult.error,
            statusCode: marketCheckResult.statusCode,
          })
        }
      } catch (error) {
        // Unexpected error - log but don't fail
        console.error('[MARKETCHECK_EXCEPTION]', error)

        await logApiCall({
          reportId: report.id,
          provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          success: false,
          responseTimeMs: Date.now() - marketCheckStartTime,
          cost: 0.0,
          requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Update report with fetched data
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        // Store normalized vehicle data including original user-entered data
        vehicle_data: vehicleData
          ? {
              // Original user-entered data
              vin: vin, // Use the sanitized VIN from user input
              mileage: mileage, // User-entered mileage
              zipCode: zipCode, // User-entered ZIP code

              // API-fetched vehicle specifications
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
          : {
              // If API fetch failed, still store user-entered data
              vin: vin,
              mileage: mileage,
              zipCode: zipCode,
            },
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
          marketcheck_recent_comparables_found:
            marketcheckValuation.recentComparables?.num_found || 0,
        }),

        marketcheck_fallback_used: marketcheckFallbackUsed,
        comparables_supplemented: comparablesSupplemented,

        // Also update valuation_result for backward compatibility
        ...(marketcheckValuation && {
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

        // URL validation stats (set when MarketCheck data was validated)
        ...(urlValidationFailedCount !== null && {
          url_validation_failed_count: urlValidationFailedCount,
          url_validation_failed_urls: urlValidationFailedUrls,
          validated_listing_urls: urlValidatedListingUrls,
        }),

        mileage: mileage,
        zip_code: zipCode,
        dealer_type: dealerType,
        vehicle_make: vehicleData?.make ?? null,
        vehicle_model: vehicleData?.model ?? null,
        vehicle_year: vehicleData?.vehicle.year ?? null,
        state_article_url: stateArticleUrl,
        state_name: stateName,
        vehicle_guide_url: vehicleGuideUrl,
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
