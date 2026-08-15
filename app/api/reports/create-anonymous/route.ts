import { NextResponse } from 'next/server'
import { supabaseAdmin, createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { sanitizeVin, getVinValidationError } from '@/lib/utils/vin-validator'
import { upsertLead } from '@/lib/leads'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { logApiCall } from '@/lib/api/api-call-logger'
import { resolveStateCodeFromZip } from '@/lib/personalization/zip-to-state'
import { resolveStateArticle } from '@/lib/personalization/state-article'
import { resolveVehicleGuideSlug } from '@/lib/personalization/vehicle-year-article'
import { buildKbArticleUrl } from '@/lib/personalization/kb-article-url'

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
  source?: string
  kbSourceSlug?: string
  /** PostHog distinct_id of the visitor — see BL-125 and the reports.posthog_distinct_id migration */
  posthogDistinctId?: string
}

export async function POST(request: Request) {
  try {
    const body: CreateAnonymousReportRequest = await request.json()
    const { email, vin, mileage, zipCode, source, kbSourceSlug, posthogDistinctId } = body

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

      // Fetch full row to include access_token
      const { data: existingReport } = await supabase
        .from('reports')
        .select('access_token')
        .eq('id', recentReports[0].id)
        .single()

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          access_token: (existingReport as any)?.access_token ?? null,
        },
        message: 'Returning existing recent report (idempotency check)',
      })
    }

    console.log('[create-anonymous] No recent duplicate found. Creating new report.')

    // Decode VIN via Auto.dev at submission time so vehicle info exists even
    // for reports that never complete payment (Auto.dev is free-tier — see
    // docs/superpowers/specs/2026-07-12-vin-decode-at-submission-design.md).
    // Non-fatal: a failed/unreachable decode must never block report creation.
    // logApiCall fires after the insert below, once report.id is known.
    const decodeStartTime = Date.now()
    const autoDevResult = await fetchAutoDevVinDecode(sanitizedVin)

    let vehicleDataForInsert: Record<string, unknown> | null = null
    let vehicleMake: string | null = null
    let vehicleModel: string | null = null
    let vehicleYear: number | null = null

    if (autoDevResult.success && autoDevResult.data) {
      const decoded = autoDevResult.data
      vehicleMake = decoded.make
      vehicleModel = decoded.model
      vehicleYear = decoded.vehicle.year
      vehicleDataForInsert = {
        vin: sanitizedVin,
        mileage: mileageNum,
        zipCode,
        year: decoded.vehicle.year.toString(),
        make: decoded.make,
        model: decoded.model,
        trim: decoded.trim,
      }
    }

    // Resolve the Abandoned Report Recovery personalization links at
    // submission time (same static lookups the recovery cron used to run
    // itself) so they're available immediately rather than only once the
    // cron picks the report up hours later.
    const stateCode = resolveStateCodeFromZip(zipCode)
    const { stateName, slug: stateSlug } = resolveStateArticle(stateCode)
    const stateArticleUrl = buildKbArticleUrl(stateSlug, 'state_article')

    const vehicleGuideSlug = resolveVehicleGuideSlug(vehicleYear)
    const vehicleGuideUrl = buildKbArticleUrl(vehicleGuideSlug, 'vehicle_guide')

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

    // Generate access token only for anonymous users (null for authenticated reports)
    const isAnonymous = !authenticatedUserId
    const accessToken = isAnonymous ? crypto.randomUUID() : null
    const accessTokenExpiresAt = isAnonymous
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

    // Create report in database (link to authenticated user if available)
    // Vehicle data (VIN decode) is populated above at submission time via Auto.dev.
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        vin: sanitizedVin,
        mileage: mileageNum,
        zip_code: zipCode,
        email: normalizedEmail, // Store normalized email for later account linking
        dealer_type: 'private', // Default value — updated by webhook after VIN decode
        status: 'pending', // Reports start as pending until payment received
        vehicle_data: vehicleDataForInsert,
        autodev_vin_data: autoDevResult.success ? (autoDevResult.data ?? null) : null,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: vehicleYear,
        state_article_url: stateArticleUrl,
        state_name: stateName,
        vehicle_guide_url: vehicleGuideUrl,
        user_id: authenticatedUserId, // Link to user if authenticated, otherwise null
        source: source ?? null,
        kb_source_slug: kbSourceSlug ?? null,
        posthog_distinct_id: posthogDistinctId ?? null,
        ...(isAnonymous
          ? { access_token: accessToken, access_token_expires_at: accessTokenExpiresAt }
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ({} as any)),
      })
      .select()
      .single()

    if (insertError) {
      console.error('[create-anonymous] Database insert error:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to create report. Please try again.',
          details: process.env.NODE_ENV === 'development' ? insertError.message : undefined,
        },
        { status: 500 }
      )
    }

    // Log the Auto.dev call now that we have a report id to attach it to
    if (autoDevResult.success && autoDevResult.data) {
      await logApiCall({
        reportId: report.id,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: Date.now() - decodeStartTime,
        cost: 0.0,
        requestData: { vin: sanitizedVin },
        responseData: {
          make: autoDevResult.data.make,
          model: autoDevResult.data.model,
          year: autoDevResult.data.vehicle.year,
          vinValid: autoDevResult.data.vinValid,
        },
      })
    } else {
      await logApiCall({
        reportId: report.id,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: false,
        responseTimeMs: Date.now() - decodeStartTime,
        cost: 0.0,
        requestData: { vin: sanitizedVin },
        errorMessage: autoDevResult.error,
      })
    }

    // Capture form_submitted lead — non-fatal
    if (normalizedEmail) {
      try {
        await upsertLead(supabaseAdmin, normalizedEmail, 'form_submitted', {
          source,
          kbSourceSlug,
          vehicleMake: vehicleMake ?? undefined,
          vehicleModel: vehicleModel ?? undefined,
          vehicleYear: vehicleYear ?? undefined,
        })
      } catch (leadErr) {
        console.error('[create-anonymous] Lead capture failed (non-fatal):', leadErr)
      }
    }

    console.log('[create-anonymous] Report created successfully:', {
      reportId: report.id,
      email: normalizedEmail,
      vin: report.vin.substring(0, 8) + '...',
      userId: authenticatedUserId || 'anonymous',
      linkedToUser: !!authenticatedUserId,
    })

    // Return report data
    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        vin: report.vin,
        mileage: report.mileage,
        zip_code: report.zip_code,
        email: report.email,
        status: report.status,
        vehicle_data: vehicleDataForInsert,
        marketcheck_valuation: report.marketcheck_valuation || null,
        created_at: report.created_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        access_token: (report as any).access_token ?? null,
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
