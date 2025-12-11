/**
 * POST /api/reports/create
 *
 * Creates a new vehicle valuation report by fetching data from external APIs.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/db/auth'
import { createRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/db/supabase'
import { getVinValidationError, sanitizeVin } from '@/lib/utils/vin-validator'
import {
  fetchVinAuditDataMock,
  type VinAuditVehicleData,
} from '@/lib/api/vinaudit-client'
import { fetchAutoDevDataMock, type AutoDevAccidentData } from '@/lib/api/autodev-client'
import { fetchCarsXEDataMock, type MarketValuation } from '@/lib/api/carsxe-client'

export async function POST(request: Request) {
  try {
    // Require authentication
    const user = await requireAuth()

    // Parse request body
    const body = await request.json()
    const { vin: rawVin } = body

    // Validate VIN
    const vin = sanitizeVin(rawVin)
    const validationError = getVinValidationError(vin)

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
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
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      )
    }

    // Fetch data from external APIs (in parallel for speed)
    const startTime = Date.now()

    const [vinAuditResult, autoDevResult] = await Promise.allSettled([
      fetchVinAuditDataMock(vin),
      fetchAutoDevDataMock(vin),
    ])

    // Process VinAudit data
    let vehicleData: VinAuditVehicleData | null = null
    if (vinAuditResult.status === 'fulfilled' && vinAuditResult.value.success) {
      vehicleData = vinAuditResult.value.data!

      // Log API call
      await logApiCall(
        report.id,
        'vinaudit',
        '/decode_vin',
        true,
        Date.now() - startTime,
        0.02
      )
    } else {
      await logApiCall(
        report.id,
        'vinaudit',
        '/decode_vin',
        false,
        Date.now() - startTime,
        0.02,
        vinAuditResult.status === 'fulfilled'
          ? vinAuditResult.value.error
          : 'Request failed'
      )
    }

    // Process Auto.dev data
    let accidentDetails: AutoDevAccidentData[] = []
    if (autoDevResult.status === 'fulfilled' && autoDevResult.value.success) {
      accidentDetails = autoDevResult.value.data!.accidents

      await logApiCall(
        report.id,
        'autodev',
        '/history',
        true,
        Date.now() - startTime,
        0.0
      )
    } else {
      await logApiCall(
        report.id,
        'autodev',
        '/history',
        false,
        Date.now() - startTime,
        0.0,
        autoDevResult.status === 'fulfilled'
          ? autoDevResult.value.error
          : 'Request failed'
      )
    }

    // Fetch market comparables (requires vehicle data)
    let valuationResult: MarketValuation | null = null
    if (vehicleData) {
      const carsXEResult = await fetchCarsXEDataMock(vin, {
        year: vehicleData.year,
        make: vehicleData.make,
        model: vehicleData.model,
        mileage: vehicleData.mileage,
      })

      if (carsXEResult.success) {
        valuationResult = carsXEResult.data!.valuation

        await logApiCall(
          report.id,
          'carsxe',
          '/market',
          true,
          Date.now() - startTime,
          0.0
        )
      } else {
        await logApiCall(
          report.id,
          'carsxe',
          '/market',
          false,
          Date.now() - startTime,
          0.0,
          carsXEResult.error
        )
      }
    }

    // Update report with fetched data
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        vehicle_data: vehicleData || {},
        accident_details: accidentDetails.length > 0 ? { accidents: accidentDetails } : null,
        valuation_result: valuationResult || null,
        data_retrieval_status: vehicleData ? 'completed' : 'failed',
      })
      .eq('id', report.id)

    if (updateError) {
      console.error('Error updating report:', updateError)
      return NextResponse.json(
        { error: 'Failed to update report data' },
        { status: 500 }
      )
    }

    // Return report with data
    return NextResponse.json(
      {
        message: 'Report created successfully',
        report: {
          id: report.id,
          vin,
          vehicleData,
          accidentDetails,
          valuation: valuationResult,
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

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
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
