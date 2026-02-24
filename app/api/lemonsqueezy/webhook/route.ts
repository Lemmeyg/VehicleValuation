import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy/client'
import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import type { LemonSqueezyWebhookEvent } from '@/lib/lemonsqueezy/types'

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

    // Parse the event
    const event: LemonSqueezyWebhookEvent = JSON.parse(rawBody)
    const eventName = event.meta.event_name

    console.log(`Received Lemon Squeezy webhook: ${eventName}`)

    // Handle different event types
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(event)
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

async function handleOrderCreated(event: LemonSqueezyWebhookEvent) {
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
      resolvedUserId = await resolveUserFromEmail(customerEmail, reportId)
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
    // FETCH MARKETCHECK DATA (if not already present)
    // ========================================
    let marketcheckData = report.marketcheck_valuation

    if (!marketcheckData) {
      console.log(`[Webhook] Fetching MarketCheck data for report ${reportId}`)
      const mcStartTime = Date.now()

      const mcResult = await fetchMarketCheckData(
        report.vin,
        report.mileage,
        report.zip_code,
        false // is_certified
      )

      const mcResponseTime = Date.now() - mcStartTime

      if (mcResult.success && mcResult.data) {
        console.log(`[Webhook] MarketCheck success for report ${reportId}:`, {
          predictedPrice: mcResult.data.predictedPrice,
          totalComparables: mcResult.data.totalComparablesFound,
          responseTimeMs: mcResponseTime,
        })
        marketcheckData = mcResult.data

        // Log API call for cost tracking
        await supabase.from('api_call_logs').insert({
          report_id: reportId,
          api_provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          cost: 0.09,
          success: true,
          response_time_ms: mcResponseTime,
          request_data: {
            vin: report.vin,
            mileage: report.mileage,
            zip_code: report.zip_code,
            dealer_type: 'franchise',
          },
          response_data: {
            predicted_price: mcResult.data.predictedPrice,
            total_comparables_found: mcResult.data.totalComparablesFound,
          },
        })
      } else {
        console.error(`[Webhook] MarketCheck failed for report ${reportId}:`, mcResult.error)
        // Log failed API call
        await supabase.from('api_call_logs').insert({
          report_id: reportId,
          api_provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          cost: 0.0,
          success: false,
          error_message: mcResult.error,
          response_time_ms: mcResponseTime,
          request_data: {
            vin: report.vin,
            mileage: report.mileage,
            zip_code: report.zip_code,
            dealer_type: 'franchise',
          },
        })
      }
    } else {
      console.log(
        `[Webhook] MarketCheck data already exists for report ${reportId}, skipping API call`
      )
    }

    // ========================================
    // FETCH AUTO.DEV VIN DECODE DATA
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
      await supabase.from('api_call_logs').insert({
        report_id: reportId,
        api_provider: 'autodev',
        endpoint: '/vin/{vin}',
        cost: 0.0,
        success: true,
        response_time_ms: vinResponseTime,
        request_data: { vin: report.vin },
        response_data: {
          make: vinResult.data.make,
          model: vinResult.data.model,
          year: vinResult.data.vehicle?.year,
        },
      })
    } else {
      console.warn(`[Webhook] Auto.dev VIN decode failed for report ${reportId}:`, vinResult.error)
      // Log failed API call
      await supabase.from('api_call_logs').insert({
        report_id: reportId,
        api_provider: 'autodev',
        endpoint: '/vin/{vin}',
        cost: 0.0,
        success: false,
        error_message: vinResult.error,
        response_time_ms: vinResponseTime,
        request_data: { vin: report.vin },
      })
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

    // Generate PDF asynchronously
    // Note: In production, consider using a queue for this
    generateAndUploadPDF({ reportId }).catch(error => {
      console.error(`PDF generation failed for report ${reportId}:`, error)
      // Update report status to 'failed'
      supabase
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportId)
        .then(() => console.log(`Report ${reportId} marked as failed`))
    })

    console.log(`[Webhook] PDF generation initiated for report ${reportId}`)
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
async function resolveUserFromEmail(email: string, reportId: string): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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
      emailRedirectTo: `${appUrl}/reports/${reportId}`,
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
