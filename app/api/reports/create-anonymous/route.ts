import { NextResponse } from 'next/server'
import { supabaseAdmin, createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'

/**
 * Create Anonymous Report Endpoint
 *
 * Allows users to create a report WITHOUT authentication.
 * Email is stored with the report for later account linking during payment.
 *
 * POST /api/reports/create-anonymous
 * Body: { email, vin, mileage, zipCode }
 */

interface CreateAnonymousReportRequest {
  email: string
  vin: string
  mileage: number
  zipCode: string
}

export async function POST(request: Request) {
  try {
    const body: CreateAnonymousReportRequest = await request.json()
    const { email, vin, mileage, zipCode } = body

    // Normalize email to lowercase for consistency
    const normalizedEmail = email?.toLowerCase().trim()

    console.log('[create-anonymous] Request received:', {
      email: normalizedEmail,
      vin: vin?.substring(0, 8) + '...',
      mileage,
      zipCode
    })

    // Validate required fields
    if (!normalizedEmail || !vin || !mileage || !zipCode) {
      console.error('[create-anonymous] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: email, vin, mileage, zipCode' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      )
    }

    // Validate VIN
    const sanitizedVin = sanitizeVin(vin)
    const vinError = getVinValidationError(sanitizedVin)
    if (vinError) {
      return NextResponse.json(
        { error: `VIN validation failed: ${vinError}` },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Invalid ZIP code. Must be 5 digits' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for anonymous report creation
    // This is safe because we've already validated all input above
    const supabase = supabaseAdmin

    // IDEMPOTENCY CHECK: Check if a report with same VIN, email, and mileage was created very recently (within last 5 minutes)
    // This prevents duplicate reports from double-clicks or React StrictMode double-rendering
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: recentReports, error: checkError } = await supabase
      .from('reports')
      .select('id, vin, email, mileage, created_at')
      .eq('vin', sanitizedVin)
      .ilike('email', normalizedEmail)
      .eq('mileage', mileageNum)
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
      const { data: { session } } = await authSupabase.auth.getSession()

      if (session?.user?.id && session.user.email?.toLowerCase() === normalizedEmail) {
        authenticatedUserId = session.user.id
        console.log('[create-anonymous] User is authenticated, linking report to user:', authenticatedUserId)
      }
    } catch (authError) {
      console.log('[create-anonymous] No authenticated session found (expected for anonymous users)')
    }

    // Step 1: Decode VIN using VinAudit API
    let vehicleData: any = null
    try {
      const vinAuditResponse = await fetch(
        `https://vindecoder.p.rapidapi.com/decode_vin?vin=${sanitizedVin}`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.VINAUDIT_API_KEY!,
            'X-RapidAPI-Host': 'vindecoder.p.rapidapi.com',
          },
        }
      )

      if (vinAuditResponse.ok) {
        const vinData = await vinAuditResponse.json()
        vehicleData = {
          year: vinData.specification?.year || null,
          make: vinData.specification?.make || null,
          model: vinData.specification?.model || null,
          trim: vinData.specification?.trim || null,
          body_style: vinData.specification?.body || null,
          engine: vinData.specification?.engine || null,
          transmission: vinData.specification?.transmission || null,
          drive_type: vinData.specification?.drive_type || null,
          fuel_type: vinData.specification?.fuel_type || null,
        }
      }
    } catch (error) {
      console.error('VIN decode error:', error)
      // Continue even if VIN decode fails - we'll get vehicle data later
    }

    // Step 2: Create report in database (link to authenticated user if available)
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        vin: sanitizedVin,
        mileage: mileageNum,
        zip_code: zipCode,
        email: normalizedEmail, // Store normalized email for later account linking
        dealer_type: 'private', // Default value
        status: 'pending', // Reports start as pending
        vehicle_data: vehicleData,
        user_id: authenticatedUserId, // Link to user if authenticated, otherwise null
      })
      .select()
      .single()

    if (insertError) {
      console.error('[create-anonymous] Database insert error:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to create report. Please try again.',
          details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
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

    // Step 3: Fetch MarketCheck valuation (async - don't wait)
    // This will be processed in the background
    if (vehicleData?.year && vehicleData?.make && vehicleData?.model) {
      // Trigger MarketCheck API call (fire and forget)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/marketcheck/valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          year: vehicleData.year,
          make: vehicleData.make,
          model: vehicleData.model,
          mileage: mileageNum,
          zipCode: zipCode,
        }),
      }).catch(err => console.error('MarketCheck background fetch error:', err))
    }

    // Step 4: Return report data
    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        vin: report.vin,
        mileage: report.mileage,
        zip_code: report.zip_code,
        email: report.email,
        status: report.status,
        vehicle_data: report.vehicle_data,
        marketcheck_valuation: report.marketcheck_valuation || null,
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
