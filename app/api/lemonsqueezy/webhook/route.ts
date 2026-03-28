import { NextRequest, NextResponse, after } from 'next/server'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy/client'
import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { logApiCall } from '@/lib/api/api-call-logger'
import type { LemonSqueezyWebhookEvent } from '@/lib/lemonsqueezy/types'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import type { ValidationStats } from '@/lib/utils/url-validator'

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature')

    if (!signature) {
      console.error('Missing webhook signature')
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 })
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Resolve the public app URL (needed for magic link emails)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin)

    // Parse the event
    const event: LemonSqueezyWebhookEvent = JSON.parse(rawBody)
    const eventName = event.meta.event_name

    console.log(`Received Lemon Squeezy webhook: ${eventName}`)

    // Handle different event types
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(event, appUrl)
        break
      case 'order_refunded':
        await handleOrderRefunded(event)
        break
      default:
        console.log(`Unhandled event type: ${eventName}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      },
      { status: 500 }
    )
  }
}

async function handleOrderCreated(event: LemonSqueezyWebhookEvent, appUrl: string) {
  try {
    // Extract custom data from the webhook
    const customData = event.meta.custom_data
    const { reportId, userId: rawUserId, reportType } = customData
    const customerEmail = event.data.attributes.user_email

    const orderId = event.data.id
    const amount = event.data.attributes.total
    const status = event.data.attributes.status

    console.log(
      `Processing order ${orderId} for report ${reportId}, user ${rawUserId ?? 'anonymous'}`
    )

    // Resolve user ID: use the authenticated userId from checkout, or find/create from email
    let resolvedUserId: string | null = rawUserId ?? null
    if (!resolvedUserId && customerEmail) {
      console.log(`[Webhook] Anonymous purchase — resolving user from email: ${customerEmail}`)
      resolvedUserId = await resolveUserFromEmail(customerEmail, reportId, appUrl)
    }

    // Write customer name to user profile
    const customerName = event.data.attributes.user_name
    if (resolvedUserId && customerName && customerName.trim().length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({ id: resolvedUserId, full_name: customerName.trim() }, { onConflict: 'id' })
      if (profileError) {
        console.error('[Webhook] Failed to update user profile name:', profileError)
        // Non-fatal — continue processing
      } else {
        console.log('[Webhook] Updated user profile name for', resolvedUserId)
      }
    }

    // Only process paid orders
    if (status !== 'paid') {
      console.log(`Order ${orderId} status is ${status}, skipping`)
      return
    }

    // Use admin client (service role) to bypass RLS - webhooks have no user session
    const supabase = supabaseAdmin

    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      report_id: reportId,
      user_id: resolvedUserId,
      stripe_payment_id: orderId, // Reusing column for Lemon Squeezy order ID
      amount: amount,
      status: 'succeeded',
      metadata: {
        reportType,
        source: 'lemonsqueezy',
        order_number: event.data.attributes.order_number,
        customer_email: event.data.attributes.user_email,
      },
    })

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      throw new Error(`Failed to create payment record: ${paymentError.message}`)
    }

    // Fetch the report to get VIN, mileage, ZIP for API calls
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('vin, mileage, zip_code, vehicle_data, marketcheck_valuation')
      .eq('id', reportId)
      .single()

    if (fetchError || !report) {
      console.error('Error fetching report for API calls:', fetchError)
      throw new Error(`Failed to fetch report: ${fetchError?.message}`)
    }

    console.log(`[Webhook] Report ${reportId} fetched for API calls:`, {
      vin: report.vin?.substring(0, 8) + '...',
      mileage: report.mileage,
      zip_code: report.zip_code,
      hasExistingMarketCheck: !!report.marketcheck_valuation,
    })

    // ========================================
    // FETCH AUTO.DEV VIN DECODE DATA (first — needed for MarketCheck fallback)
    // ========================================
    let autodevVinData = null

    console.log(`[Webhook] Fetching Auto.dev VIN decode for report ${reportId}`)
    const vinStartTime = Date.now()

    const vinResult = await fetchAutoDevVinDecode(report.vin)
    const vinResponseTime = Date.now() - vinStartTime

    if (vinResult.success && vinResult.data) {
      console.log(`[Webhook] Auto.dev VIN decode success for report ${reportId}:`, {
        make: vinResult.data.make,
        model: vinResult.data.model,
        year: vinResult.data.vehicle?.year,
        responseTimeMs: vinResponseTime,
      })

      autodevVinData = {
        ...vinResult.data,
        generatedAt: new Date().toISOString(),
      }

      // Log API call
      await logApiCall({
        reportId,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: vinResponseTime,
        cost: 0.0,
        requestData: { vin: report.vin },
        responseData: {
          make: vinResult.data.make,
          model: vinResult.data.model,
          year: vinResult.data.vehicle?.year,
          vinValid: vinResult.data.vinValid,
        },
      })
    } else {
      console.warn(`[Webhook] Auto.dev VIN decode failed for report ${reportId}:`, vinResult.error)
      // Log failed API call
      await logApiCall({
        reportId,
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: false,
        responseTimeMs: vinResponseTime,
        cost: 0.0,
        requestData: { vin: report.vin },
        errorMessage: vinResult.error,
      })
    }

    // Build subjectVehicle from auto.dev result so MarketCheck can use the search
    // fallback when its VIN-based prediction endpoint returns "Failed to decode VIN"
    const subjectVehicle =
      vinResult.success && vinResult.data
        ? {
            year: vinResult.data.vehicle?.year,
            make: vinResult.data.make,
            model: vinResult.data.model,
            trim: vinResult.data.trim,
          }
        : undefined

    // ========================================
    // FETCH MARKETCHECK DATA (if not already present)
    // ========================================
    let marketcheckData = report.marketcheck_valuation

    let webhookSupplemented = false
    let webhookFallbackUsed = false

    if (!marketcheckData) {
      console.log(`[Webhook] Fetching MarketCheck data for report ${reportId}`, {
        hasSubjectVehicle: !!subjectVehicle,
        subjectVehicle,
      })
      const mcStartTime = Date.now()

      const mcResult = await fetchMarketCheckData(
        report.vin,
        report.mileage,
        report.zip_code,
        false, // is_certified
        undefined, // retryConfig (use default)
        subjectVehicle // enables search fallback for VINs MarketCheck can't decode directly
      )

      const mcResponseTime = Date.now() - mcStartTime

      if (mcResult.success && mcResult.data) {
        console.log(`[Webhook] MarketCheck success for report ${reportId}:`, {
          predictedPrice: mcResult.data.predictedPrice,
          totalComparables: mcResult.data.totalComparablesFound,
          fallbackUsed: mcResult.fallbackUsed,
          responseTimeMs: mcResponseTime,
        })

        webhookFallbackUsed = mcResult.fallbackUsed ?? false
        marketcheckData = mcResult.data

        // Log API call for cost tracking
        await logApiCall({
          reportId,
          provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          success: true,
          responseTimeMs: mcResponseTime,
          cost: 0.09,
          requestData: {
            vin: report.vin,
            mileage: report.mileage,
            zip_code: report.zip_code,
            dealer_type: 'franchise',
            fallback_used: mcResult.fallbackUsed ?? false,
          },
          responseData: {
            predicted_price: mcResult.data.predictedPrice,
            total_comparables_found: mcResult.data.totalComparablesFound,
            recent_comparables_found: mcResult.data.recentComparables?.num_found ?? 0,
          },
        })
      } else {
        console.error(`[Webhook] MarketCheck failed for report ${reportId}:`, mcResult.error)
        // Log failed API call
        await logApiCall({
          reportId,
          provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          success: false,
          responseTimeMs: mcResponseTime,
          cost: 0.0,
          requestData: {
            vin: report.vin,
            mileage: report.mileage,
            zip_code: report.zip_code,
            dealer_type: 'franchise',
          },
          errorMessage: mcResult.error,
        })
      }
    } else {
      console.log(
        `[Webhook] MarketCheck data already exists for report ${reportId}, skipping API call`
      )
    }

    // URL validation + supplement always run on whatever marketcheckData we have.
    // This handles both: fresh data from the API call above, and pre-existing data
    // stored by the fetch-marketcheck route before payment was made.
    if (marketcheckData) {
      let validatedPrediction = marketcheckData
      let urlStats: ValidationStats = {
        checkedCount: 0,
        failedCount: 0,
        failedUrls: [],
        validatedUrls: [],
        batchesUsed: 0,
      }
      let urlValidationSucceeded = false

      try {
        const urlResult = await validateListingUrls(marketcheckData)
        validatedPrediction = urlResult.prediction
        urlStats = urlResult.stats
        urlValidationSucceeded = true
      } catch (err) {
        console.error(
          '[Webhook] validateListingUrls threw — proceeding with unvalidated listings:',
          err
        )
        // Non-fatal: raw prediction used; url_validated flags will be absent
      }

      // Top-up: only call supplement if URL validation completed
      // (avoids spurious trigger when urlStats.validatedUrls.length would be 0 due to an exception)
      if (urlValidationSucceeded) {
        try {
          const supplementResult = await supplementComparables(
            validatedPrediction,
            urlStats.validatedUrls.length,
            subjectVehicle,
            report.vin,
            report.mileage ?? null,
            report.zip_code ?? null
          )
          validatedPrediction = supplementResult.prediction
          webhookSupplemented = supplementResult.supplemented
        } catch (err) {
          console.error('[Webhook] supplementComparables threw:', err)
          // Non-fatal
        }
      }

      marketcheckData = validatedPrediction
    }

    // ========================================
    // UPDATE REPORT WITH API DATA AND PAYMENT INFO
    // ========================================
    const updateData: Record<string, unknown> = {
      price_paid: amount,
      stripe_payment_id: orderId,
      status: 'pending',
    }

    // For anonymous purchases: stamp the report with the resolved user_id and email
    if (!rawUserId && resolvedUserId) {
      updateData.user_id = resolvedUserId
      updateData.email = customerEmail
    }

    // Add MarketCheck data if fetched
    if (marketcheckData) {
      updateData.marketcheck_valuation = marketcheckData
      updateData.marketcheck_predicted_price = marketcheckData.predictedPrice
      updateData.marketcheck_msrp = marketcheckData.msrp || null
      updateData.marketcheck_price_range_min = marketcheckData.priceRange?.min || null
      updateData.marketcheck_price_range_max = marketcheckData.priceRange?.max || null
      updateData.marketcheck_confidence = marketcheckData.confidence
      updateData.marketcheck_total_comparables_found = marketcheckData.totalComparablesFound
      updateData.marketcheck_recent_comparables_found =
        marketcheckData.recentComparables?.num_found || 0
      updateData.comparables_supplemented = webhookSupplemented
      updateData.marketcheck_fallback_used = webhookFallbackUsed

      // Also update valuation_result for consistency
      updateData.valuation_result = {
        predictedPrice: marketcheckData.predictedPrice,
        lowValue:
          marketcheckData.priceRange?.min || Math.round(marketcheckData.predictedPrice * 0.9),
        averageValue: marketcheckData.predictedPrice,
        highValue:
          marketcheckData.priceRange?.max || Math.round(marketcheckData.predictedPrice * 1.1),
        confidence: marketcheckData.confidence,
        dataPoints: marketcheckData.totalComparablesFound,
        dataSource: 'marketcheck',
      }
    }

    // Add Auto.dev VIN data if fetched
    if (autodevVinData) {
      updateData.autodev_vin_data = autodevVinData
    }

    const { error: reportError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', reportId)

    if (reportError) {
      console.error('Error updating report:', reportError)
      throw new Error(`Failed to update report: ${reportError.message}`)
    }

    console.log(`[Webhook] Report ${reportId} updated with payment info and API data`)

    // Check if VIN decode failed both at creation and in this webhook
    const hasVehicleData = autodevVinData || report.vehicle_data?.year
    if (!hasVehicleData) {
      console.warn(
        `[Webhook] VIN decode failed for report ${reportId} — flagging for manual review`
      )
      const { error: flagError } = await supabase
        .from('reports')
        .update({ status: 'vin_decode_failed' })
        .eq('id', reportId)
      if (flagError) {
        console.error(
          `[Webhook] Failed to flag report ${reportId} as vin_decode_failed:`,
          flagError
        )
        // Still return — PDF skip is intentional regardless of flag success
      }
      console.log(`[Webhook] Report ${reportId} set to vin_decode_failed, skipping PDF`)
      return
    }

    // Generate PDF after the webhook response is sent.
    // `after()` keeps the Vercel Lambda alive until the callback resolves,
    // preventing the function from being killed before PDF upload completes.
    after(async () => {
      try {
        console.log(`[Webhook] PDF generation starting for report ${reportId}`)
        await generateAndUploadPDF({ reportId })
        console.log(`[Webhook] PDF generation completed for report ${reportId}`)
      } catch (error) {
        console.error(`PDF generation failed for report ${reportId}:`, error)
        await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
        console.log(`Report ${reportId} marked as failed`)
      }
    })

    console.log(`[Webhook] PDF generation scheduled for report ${reportId}`)
  } catch (error) {
    console.error('Error handling order_created event:', error)
    throw error
  }
}

async function handleOrderRefunded(event: LemonSqueezyWebhookEvent) {
  try {
    const orderId = event.data.id

    console.log(`Processing refund for order ${orderId}`)

    // Use admin client (service role) to bypass RLS - webhooks have no user session
    const supabase = supabaseAdmin

    // Update payment status to refunded
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
      })
      .eq('stripe_payment_id', orderId)

    if (error) {
      console.error('Error updating payment status:', error)
      throw new Error(`Failed to update payment status: ${error.message}`)
    }

    console.log(`Order ${orderId} marked as refunded`)
  } catch (error) {
    console.error('Error handling order_refunded event:', error)
    throw error
  }
}

/**
 * For anonymous purchases: find or create the Supabase user for the given email,
 * then send them a magic link to access their report.
 *
 * Uses admin.createUser to get the user ID directly (no listUsers scan needed).
 * Falls back to listUsers only when the user already exists (createUser returns error).
 */
async function resolveUserFromEmail(
  email: string,
  reportId: string,
  appUrl: string
): Promise<string | null> {
  let resolvedUserId: string | null = null

  // Try to create the user — returns the user object with ID on success
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  })

  if (!createError && createData?.user) {
    // New user created — ID is available immediately from the response
    resolvedUserId = createData.user.id
    console.log('[Webhook] Created new Supabase user for anonymous buyer:', {
      email,
      userId: resolvedUserId,
    })
  } else {
    // User already exists — find their ID via listUsers
    // (Supabase admin SDK v2 has no getUserByEmail; listUsers is the available option)
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })

    if (listError) {
      console.error('[Webhook] Failed to list users while resolving existing user:', listError)
      return null
    }

    const existingUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!existingUser) {
      console.error(
        '[Webhook] User not found after createUser error for email:',
        email,
        'Error:',
        createError
      )
      return null
    }

    resolvedUserId = existingUser.id
    console.log('[Webhook] Found existing Supabase user for anonymous buyer:', {
      email,
      userId: resolvedUserId,
    })
  }

  // Send magic link — user now guaranteed to exist in DB
  const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/reports/${reportId}/view`,
      shouldCreateUser: false, // User already exists — no need to create again
    },
  })

  if (otpError) {
    // Non-fatal — payment succeeded; user can request a new magic link later
    console.error('[Webhook] Failed to send magic link to', email, ':', otpError)
  } else {
    console.log('[Webhook] Magic link sent to', email)
  }

  return resolvedUserId
}
