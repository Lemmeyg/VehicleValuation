import { NextRequest, NextResponse, after } from 'next/server'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy/client'
import { supabaseAdmin } from '@/lib/db/supabase'
import { logApiCall } from '@/lib/api/api-call-logger'
import type { LemonSqueezyWebhookEvent } from '@/lib/lemonsqueezy/types'
import { upsertLead } from '@/lib/leads'
import { runReportPipeline } from '@/lib/services/report-pipeline'

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
    // Extract custom data from the webhook. custom_data can come back entirely
    // missing (not just missing a field) — seen live 2026-09-22 — so default to {}
    // rather than destructuring event.meta.custom_data directly.
    const customData = event.meta.custom_data ?? {}
    let { reportId } = customData
    const { userId: rawUserId, reportType } = customData
    const customerEmail = event.data.attributes.user_email

    const orderId = event.data.id
    const amount = event.data.attributes.total
    const status = event.data.attributes.status
    const orderCreatedAt = event.data.attributes.created_at

    if (!reportId) {
      console.warn(
        `[WH-2a] Order ${orderId} arrived with no custom_data.reportId — attempting email fallback match`
      )
      const fallbackReportId = await resolveReportFromEmailFallback(
        customerEmail,
        orderCreatedAt,
        orderId
      )
      if (!fallbackReportId) {
        console.error(
          `[WH-2a] Could not resolve a report for order ${orderId} — payment left unrecorded, needs manual reconciliation`
        )
        return
      }
      reportId = fallbackReportId
    }

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
      await runReportPipeline(reportId, {
        payment: {
          amount,
          orderId,
          customerEmail,
          resolvedUserId,
          rawUserId,
        },
      })
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

/**
 * Fallback for an order_created webhook whose custom_data is missing reportId — seen live
 * 2026-09-22, where a real, paid order arrived with an empty custom_data payload and crashed
 * this handler before it could write anything. Rather than crash, or guess and risk attaching
 * a payment to the wrong report, this matches on customer email among that customer's unpaid
 * reports created at or before the order's own timestamp (so a report created *after* the
 * order can never be picked). Only an unambiguous single match is used; anything else is
 * logged for manual review rather than guessed.
 */
async function resolveReportFromEmailFallback(
  customerEmail: string | undefined,
  orderCreatedAt: string,
  orderId: string
): Promise<string | null> {
  if (!customerEmail) {
    await logApiCall({
      provider: 'webhook',
      endpoint: '[WH-2a] email fallback match',
      success: false,
      errorMessage: 'custom_data.reportId missing and order has no customer email — cannot match',
      requestData: { orderId },
    })
    return null
  }

  const { data: candidates, error } = await supabaseAdmin
    .from('reports')
    .select('id, created_at')
    .ilike('email', customerEmail)
    .is('price_paid', null)
    .lte('created_at', orderCreatedAt)
    .order('created_at', { ascending: false })

  if (error || !candidates || candidates.length !== 1) {
    await logApiCall({
      provider: 'webhook',
      endpoint: '[WH-2a] email fallback match',
      success: false,
      errorMessage: error
        ? `Fallback match query failed: ${error.message}`
        : `Ambiguous or no match — found ${candidates?.length ?? 0} unpaid report(s) for this email at order time`,
      requestData: {
        orderId,
        customerEmail,
        orderCreatedAt,
        candidateIds: candidates?.map(r => r.id) ?? [],
      },
    })
    return null
  }

  const matchedReportId: string = candidates[0].id

  const { data: existing } = await supabaseAdmin
    .from('reports')
    .select('"GL Notes"')
    .eq('id', matchedReportId)
    .single()
  const existingNote = existing?.['GL Notes'] ? `${existing['GL Notes']}\n` : ''
  await supabaseAdmin
    .from('reports')
    .update({
      'GL Notes':
        `${existingNote}[auto] Payment auto-matched by email — LemonSqueezy order ${orderId} ` +
        `arrived with no custom_data; matched via customer email + order timestamp. Please ` +
        `verify this is correct, ${new Date().toISOString().slice(0, 10)}`,
    })
    .eq('id', matchedReportId)

  await logApiCall({
    reportId: matchedReportId,
    provider: 'webhook',
    endpoint: '[WH-2a] email fallback match',
    success: true,
    responseData: { orderId, customerEmail, matchedReportId },
  })

  return matchedReportId
}
