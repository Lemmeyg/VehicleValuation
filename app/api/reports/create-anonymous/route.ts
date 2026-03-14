import { NextResponse } from 'next/server'
import { supabaseAdmin, createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import { fetchAutoDevVinDecode, type AutoDevVinDecodeData } from '@/lib/api/autodev-client'
import { logApiCall } from '@/lib/api/api-call-logger'

/**
 * Create Anonymous Report Endpoint
 *
 * Allows users to create a report WITHOUT authentication.
 * Email is optional — LemonSqueezy collects it at checkout.
 *
 * POST /api/reports/create-anonymous
 * Body: { vin, mileage, zipCode, email? }
 */

interface CreateAnonymousReportRequest {
  email?: string
  vin: string
  mileage: number
  zipCode: string
}

export async function POST(request: Request) {
  try {
    const body: CreateAnonymousReportRequest = await request.json()
    const { email, vin, mileage, zipCode } = body

    // Normalize email to lowercase for consistency
    const normalizedEmail = email?.toLowerCase().trim() ?? null

    console.log('[create-anonymous] Request received:', {
      email: normalizedEmail,
      vin: vin?.substring(0, 8) + '...',
      mileage,
      zipCode,
    })

    // Validate required fields (email is optional — collected by LemonSqueezy at checkout)
    if (!vin || !mileage || !zipCode) {
      console.error('[create-anonymous] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: vin, mileage, zipCode' },
        { status: 400 }
      )
    }

    // Validate VIN
    const sanitizedVin = sanitizeVin(vin)
    const vinError = getVinValidationError(sanitizedVin)
    if (vinError) {
      return NextResponse.json({ error: `VIN validation failed: ${vinError}` }, { status: 400 })
    }

    // Validate mileage
    const mileageNum = parseInt(mileage.toString())
    if (isNaN(mileageNum) || mileageNum < 0 || mileageNum > 999999) {
      return NextResponse.json(
        { error: 'Invalid mileage. Must be between 0 and 999,999' },
        { status: 400 }
      )
    }

    // Validate ZIP code
    if (!/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'Invalid ZIP code. Must be 5 digits' }, { status: 400 })
    }

    // Use admin client to bypass RLS for anonymous report creation
    // This is safe because we've already validated all input above
    const supabase = supabaseAdmin

    // IDEMPOTENCY CHECK: Check if a report with same VIN, email, and mileage was created very recently (within last 5 minutes)
    // This prevents duplicate reports from double-clicks or React StrictMode double-rendering
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: recentReports, error: _checkError } = await supabase
      .from('reports')
      .select('id, vin, email, mileage, created_at')
      .eq('vin', sanitizedVin)
      .eq('mileage', mileageNum)
      .eq('zip_code', zipCode)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentReports && recentReports.length > 0) {
      console.log('[create-anonymous] Found recent duplicate report:', recentReports[0].id)
      console.log('[create-anonymous] Returning existing report instead of creating duplicate')

      // Return the existing report instead of creating a duplicate
      return NextResponse.json({
        success: true,
        report: {
          id: recentReports[0].id,
          vin: recentReports[0].vin,
          mileage: recentReports[0].mileage,
          zip_code: zipCode,
          email: recentReports[0].email,
          status: 'pending',
          vehicle_data: null,
          marketcheck_valuation: null,
          created_at: recentReports[0].created_at,
        },
        message: 'Returning existing recent report (idempotency check)',
      })
    }

    console.log('[create-anonymous] No recent duplicate found. Creating new report.')

    // Check if user is authenticated (for existing users coming from login flow)
    let authenticatedUserId: string | null = null
    try {
      const authSupabase = await createRouteHandlerSupabaseClient()
      const {
        data: { session },
      } = await authSupabase.auth.getSession()

      if (session?.user?.id) {
        authenticatedUserId = session.user.id
        console.log(
          '[create-anonymous] User is authenticated, linking report to user:',
          authenticatedUserId
        )
      }
    } catch (_authError) {
      console.log(
        '[create-anonymous] No authenticated session found (expected for anonymous users)'
      )
    }

    // Step 1: Create report in database with null vehicle_data
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        vin: sanitizedVin,
        mileage: mileageNum,
        zip_code: zipCode,
        email: normalizedEmail,
        dealer_type: 'private',
        status: 'pending',
        vehicle_data: null,
        user_id: authenticatedUserId,
      })
      .select()
      .single()

    if (insertError || !report) {
      console.error('[create-anonymous] Database insert error:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to create report. Please try again.',
          details: process.env.NODE_ENV === 'development' ? insertError?.message : undefined,
        },
        { status: 500 }
      )
    }

    console.log('[create-anonymous] Report created successfully:', {
      reportId: report.id,
      email: normalizedEmail,
      vin: report.vin.substring(0, 8) + '...',
      userId: authenticatedUserId || 'anonymous',
      linkedToUser: !!authenticatedUserId,
    })

    // Step 2: Decode VIN using Auto.dev
    const vinStartTime = Date.now()
    const vinDecodeResult = await fetchAutoDevVinDecode(sanitizedVin)
    const vinResponseTime = Date.now() - vinStartTime

    let vehicleData: AutoDevVinDecodeData | null = null

    if (vinDecodeResult.success && vinDecodeResult.data) {
      vehicleData = vinDecodeResult.data

      await logApiCall({
        reportId: report.id,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: vinResponseTime,
        cost: 0.0,
        requestData: { vin: sanitizedVin },
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
        responseTimeMs: vinResponseTime,
        cost: 0.0,
        requestData: { vin: sanitizedVin },
        errorMessage: vinDecodeResult.error,
      })
    }

    // Step 3: Update report with vehicle data (camelCase keys, matching create/route.ts)
    if (vehicleData) {
      await supabase
        .from('reports')
        .update({
          vehicle_data: {
            year: vehicleData.vehicle.year.toString(),
            make: vehicleData.make,
            model: vehicleData.model,
            trim: vehicleData.trim,
            bodyType: vehicleData.body,
            engine: vehicleData.engine,
            transmission: vehicleData.transmission,
            driveType: vehicleData.drive,
            fuelType: vehicleData.type,
          },
        })
        .eq('id', report.id)
    }

    // Step 4: Return response (vehicle data from memory, not DB re-fetch)
    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        vin: report.vin,
        mileage: report.mileage,
        zip_code: report.zip_code,
        email: report.email,
        status: report.status,
        vehicle_data: vehicleData
          ? {
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
          : null,
        marketcheck_valuation: null,
        created_at: report.created_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error in create-anonymous:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
