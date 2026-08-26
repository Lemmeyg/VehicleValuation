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
import { upsertLead } from '@/lib/leads'

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature')

    // [WH-0] Log every incoming webhook request for diagnosis
    console.log('[WH-0] Webhook POST received', {
      signature: signature ? `present (${signature.substring(0, 8)}...)` : 'MISSING',
      contentType: request.headers.get('content-type'),
      bodyLength: rawBody.length,
    })

    if (!signature) {
      console.error(
        '[WH-0] FATAL: Missing x-signature header — LemonSqueezy signing secret may not be configured in LS dashboard'
      )
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 })
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      console.error('[WH-1] Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    console.log('[WH-1] Signature verified OK')

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
      `[WH-2] Processing order ${orderId} for report ${reportId}, user ${rawUserId ?? 'anonymous'}, status ${status}`
    )
    await logApiCall({
      reportId,
      provider: 'webhook',
      endpoint: '[WH-2] order_created received',
      success: true,
      requestData: { orderId, reportId, rawUserId: rawUserId ?? null, status, customerEmail },
    })

    // Resolve user ID: use the authenticated userId from checkout, or find/create from email
    let resolvedUserId: string | null = rawUserId ?? null
    if (!resolvedUserId && customerEmail) {
      console.log(`[WH-3] Anonymous purchase — resolving user from email: ${customerEmail}`)
      resolvedUserId = await resolveUserFromEmail(customerEmail, reportId)
      console.log(`[WH-3] resolveUserFromEmail result: ${resolvedUserId ?? 'NULL'}`)
      await logApiCall({
        reportId,
        provider: 'webhook',
        endpoint: '[WH-3] resolveUserFromEmail',
        success: resolvedUserId !== null,
        responseData: { resolvedUserId: resolvedUserId ?? null },
        errorMessage: resolvedUserId ? undefined : 'resolveUserFromEmail returned null',
      })
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
      console.log(`[WH-4] Order ${orderId} status is ${status}, skipping`)
      await logApiCall({
        reportId,
        provider: 'webhook',
        endpoint: '[WH-4] order status check',
        success: false,
        errorMessage: `Order status is '${status}', expected 'paid' — processing skipped`,
        requestData: { orderId, status },
      })
      return
    }
    console.log(`[WH-4] Order status is 'paid' — proceeding`)

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
      if (paymentError.code === '23505') {
        // Duplicate key — this orderId was already processed by a previous webhook delivery.
        // Return 200 so LemonSqueezy does not retry.
        console.log(
          `[WH-5] Order ${orderId} already processed (idempotent retry) — returning early`
        )
        await logApiCall({
          reportId,
          provider: 'webhook',
          endpoint: '[WH-5] payment insert (idempotent)',
          success: true,
          requestData: { reportId, resolvedUserId, orderId, amount, status },
        })
        return
      }
      console.error('[WH-5] Error creating payment record:', paymentError)
      await logApiCall({
        reportId,
        provider: 'webhook',
        endpoint: '[WH-5] payment insert',
        success: false,
        errorMessage: `paymentError: ${paymentError.message} | code: ${paymentError.code} | details: ${paymentError.details}`,
        requestData: { reportId, resolvedUserId, orderId, amount, status },
      })
      throw new Error(`Failed to create payment record: ${paymentError.message}`)
    }
    console.log(`[WH-5] Payment record created OK for report ${reportId}`)
    await logApiCall({
      reportId,
      provider: 'webhook',
      endpoint: '[WH-5] payment insert',
      success: true,
      requestData: { reportId, resolvedUserId, orderId, amount },
    })

    // Capture purchased lead — non-fatal: webhook continues regardless
    if (customerEmail) {
      try {
        await upsertLead(supabaseAdmin, customerEmail, 'purchased')
        console.log('[WH-5b] Lead captured as purchased for:', customerEmail)
      } catch (leadErr) {
        console.error('[WH-5b] Lead capture failed (non-fatal):', leadErr)
      }
    }

    // ── Return 200 quickly. All heavy I/O runs after the response is sent. ──
    after(async () => {
      try {
        // Fetch the report to get VIN, mileage, ZIP for API calls
        const { data: report, error: fetchError } = await supabase
          .from('reports')
          .select('vin, mileage, zip_code, vehicle_data, marketcheck_valuation, autodev_vin_data')
          .eq('id', reportId)
          .single()

        if (fetchError || !report) {
          console.error('[WH-6] Error fetching report for API calls:', fetchError)
          await logApiCall({
            reportId,
            provider: 'webhook',
            endpoint: '[WH-6] report fetch',
            success: false,
            errorMessage: fetchError?.message ?? 'report not found',
            requestData: { reportId },
          })
          return
        }
        console.log(`[WH-6] Report fetched OK for report ${reportId}`)

        console.log(`[Webhook] Report ${reportId} fetched for API calls:`, {
          vin: report.vin?.substring(0, 8) + '...',
          mileage: report.mileage,
          zip_code: report.zip_code,
          hasExistingMarketCheck: !!report.marketcheck_valuation,
        })

        // ========================================
        // FETCH AUTO.DEV VIN DECODE DATA
        // ========================================
        let autodevVinData = report.autodev_vin_data ?? null
        let vinResult: { success: boolean; data?: typeof autodevVinData; error?: string } = {
          success: !!autodevVinData,
          data: autodevVinData ?? undefined,
        }

        if (!autodevVinData) {
          console.log(
            `[Webhook] No existing autodev_vin_data — fetching Auto.dev VIN decode for report ${reportId} (fallback)`
          )
          const vinStartTime = Date.now()
          vinResult = await fetchAutoDevVinDecode(report.vin)
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
            console.warn(
              `[Webhook] Auto.dev VIN decode failed for report ${reportId}:`,
              vinResult.error
            )
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
        } else {
          console.log(
            `[Webhook] autodev_vin_data already present for report ${reportId} — skipping re-fetch`
          )
        }

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
            false,
            undefined,
            subjectVehicle
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

        // URL validation + supplement
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
          }

          if (urlValidationSucceeded) {
            try {
              const supplementResult = await supplementComparables(
                validatedPrediction,
                urlStats.validatedUrls.length,
                subjectVehicle,
                report.vin,
                report.mileage ?? null,
                report.zip_code ?? null,
                marketcheckData.predictedPrice
              )
              validatedPrediction = supplementResult.prediction
              webhookSupplemented = supplementResult.supplemented
            } catch (err) {
              console.error('[Webhook] supplementComparables threw:', err)
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

        // For anonymous purchases: stamp the report with resolved user_id and email
        if (!rawUserId && resolvedUserId) {
          updateData.user_id = resolvedUserId
          updateData.email = customerEmail
        }

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

        if (autodevVinData) {
          updateData.autodev_vin_data = autodevVinData
        }

        const { error: reportError } = await supabase
          .from('reports')
          .update(updateData)
          .eq('id', reportId)

        if (reportError) {
          // Cannot throw here — 200 was already sent. Log and bail.
          console.error('[Webhook] Error updating report:', reportError)
          return
        }

        console.log(`[Webhook] Report ${reportId} updated with payment info and API data`)

        // VIN decode failed — flag for manual review, skip PDF
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
          }
          console.log(`[Webhook] Report ${reportId} set to vin_decode_failed, skipping PDF`)
          return
        }

        // Generate PDF
        try {
          console.log(`[Webhook] PDF generation starting for report ${reportId}`)
          await generateAndUploadPDF({ reportId })
          console.log(`[Webhook] PDF generation completed for report ${reportId}`)
        } catch (error) {
          console.error(`[Webhook] PDF generation failed for report ${reportId}:`, error)
          await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
          console.log(`[Webhook] Report ${reportId} marked as failed`)
        }
      } catch (error) {
        console.error(
          `[Webhook] Unhandled error in post-payment processing for report ${reportId}:`,
          error
        )
      }
    })

    console.log(`[Webhook] Post-payment processing scheduled for report ${reportId}`)
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
 * For anonymous purchases: find or create the Supabase user for the given email.
 *
 * Uses admin.createUser to get the user ID directly (no listUsers scan needed).
 * Falls back to listUsers only when the user already exists (createUser returns error).
 */
async function resolveUserFromEmail(email: string, reportId: string): Promise<string | null> {
  let resolvedUserId: string | null = null

  // Try to create the user — returns the user object with ID on success
  console.log('[WH-3a] Calling supabaseAdmin.auth.admin.createUser for', email)
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  console.log('[WH-3a] createUser result:', {
    userId: createData?.user?.id ?? null,
    errorCode: createError?.status ?? null,
    errorMsg: createError?.message ?? null,
  })

  if (!createError && createData?.user) {
    // New user created — ID is available immediately from the response
    resolvedUserId = createData.user.id
    console.log('[WH-3a] Created new Supabase user for anonymous buyer:', {
      email,
      userId: resolvedUserId,
    })
  } else {
    // User already exists — find their ID via listUsers
    // (Supabase admin SDK v2 has no getUserByEmail; listUsers is the available option)
    console.log(
      '[WH-3b] createUser failed — falling back to listUsers. createError:',
      createError?.message
    )
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })
    console.log('[WH-3b] listUsers result:', {
      userCount: listData?.users?.length ?? null,
      errorMsg: listError?.message ?? null,
    })

    if (listError) {
      console.error('[WH-3b] Failed to list users:', listError)
      await logApiCall({
        reportId,
        provider: 'webhook',
        endpoint: '[WH-3b] listUsers',
        success: false,
        errorMessage: `listUsers error: ${listError.message}`,
      })
      return null
    }

    const existingUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!existingUser) {
      console.error(
        '[WH-3b] User not found after createUser error for email:',
        email,
        'createError:',
        createError
      )
      await logApiCall({
        reportId,
        provider: 'webhook',
        endpoint: '[WH-3b] listUsers lookup',
        success: false,
        errorMessage: `User not found after createUser failed. createError: ${createError?.message}`,
        requestData: { email },
      })
      return null
    }

    resolvedUserId = existingUser.id
    console.log('[WH-3b] Found existing Supabase user for anonymous buyer:', {
      email,
      userId: resolvedUserId,
    })
  }

  return resolvedUserId
}
