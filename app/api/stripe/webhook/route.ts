/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events (payment confirmation, etc.)
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/stripe-client'
import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Error handling webhook event:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id)

  const { reportId, userId, reportType } = session.metadata as {
    reportId: string
    userId: string
    reportType: string
  }

  if (!reportId || !userId) {
    console.error('Missing metadata in checkout session')
    return
  }

  const amount = session.amount_total || 0

  // Create payment record
  const { error: paymentError } = await supabaseAdmin.from('payments').insert({
    report_id: reportId,
    user_id: userId,
    stripe_payment_id: session.id,
    stripe_payment_intent_id: session.payment_intent as string,
    amount,
    status: 'succeeded',
    metadata: {
      reportType,
      sessionId: session.id,
    },
  })

  if (paymentError) {
    console.error('Error creating payment record:', paymentError)
    return
  }

  // Update report with payment info and status
  const { error: updateError } = await supabaseAdmin
    .from('reports')
    .update({
      price_paid: amount,
      stripe_payment_id: session.id,
      status: 'pending', // Payment received, now pending report generation
    })
    .eq('id', reportId)

  if (updateError) {
    console.error('Error updating report:', updateError)
    return
  }

  console.log(`Payment successful for report ${reportId}`)

  // ===== NEW: Call MarketCheck API AFTER payment confirmation =====
  try {
    // Import validation and API client
    const { validateBeforeMarketCheckCall } = await import('@/lib/security/report-validation')
    const { fetchMarketCheckData } = await import('@/lib/api/marketcheck-client')

    // Validate before API call (security check)
    const validation = await validateBeforeMarketCheckCall(reportId, userId)

    if (!validation.valid) {
      console.error(`[MarketCheck] Validation failed for report ${reportId}:`, validation.error)
      // Continue to PDF generation without MarketCheck data (graceful degradation)
    } else {
      const { vin, mileage, zip_code } = validation.data!

      // Fetch full report to get vehicle_data for filtering comparables
      const { data: report, error: reportError } = await supabaseAdmin
        .from('reports')
        .select('vin, mileage, zip_code, vehicle_data')
        .eq('id', reportId)
        .single()

      // Extract subject vehicle info for filtering comparables
      const subjectVehicle = report?.vehicle_data
        ? {
            make: report.vehicle_data.make,
            model: report.vehicle_data.model,
            trim: report.vehicle_data.trim,
          }
        : undefined

      console.log(`[MarketCheck] Calling API for report ${reportId}`, {
        vin,
        mileage,
        zip_code,
        subjectVehicle,
      })

      const apiStartTime = Date.now()

      // Call MarketCheck API with retry logic and subject vehicle for filtering
      const marketcheckResult = await fetchMarketCheckData(
        vin,
        mileage,
        zip_code,
        false, // is_certified - default to false
        undefined, // retryConfig (use default)
        subjectVehicle // NEW: Pass subject vehicle for filtering comparables
      )

      const apiResponseTime = Date.now() - apiStartTime

      if (marketcheckResult.success && marketcheckResult.data) {
        console.log(`[MarketCheck] API success for report ${reportId}`, {
          predictedPrice: marketcheckResult.data.predictedPrice,
          comparables: marketcheckResult.data.comparablesReturned,
          responseTimeMs: apiResponseTime,
        })

        // Store MarketCheck results in database
        const { error: mcUpdateError } = await supabaseAdmin
          .from('reports')
          .update({
            marketcheck_valuation: marketcheckResult.data,
            // IMPORTANT: Also update valuation_result to MarketCheck (replaces CarsXE)
            valuation_result: {
              predictedPrice: marketcheckResult.data.predictedPrice,
              lowValue: marketcheckResult.data.priceRange?.min || Math.round(marketcheckResult.data.predictedPrice * 0.9),
              averageValue: marketcheckResult.data.predictedPrice,
              highValue: marketcheckResult.data.priceRange?.max || Math.round(marketcheckResult.data.predictedPrice * 1.1),
              confidence: marketcheckResult.data.confidence,
              dataPoints: marketcheckResult.data.totalComparablesFound,
              dataSource: 'marketcheck',
            },
          })
          .eq('id', reportId)

        if (mcUpdateError) {
          console.error(`[MarketCheck] Error saving results for report ${reportId}:`, mcUpdateError)
        }

        // Log API call for cost tracking
        await supabaseAdmin.from('api_call_logs').insert({
          report_id: reportId,
          api_provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          cost: 0.09, // $0.09 per call
          success: true,
          response_time_ms: apiResponseTime,
          request_data: {
            vin,
            mileage,
            zip_code,
            dealer_type: 'franchise',
          },
          response_data: {
            predicted_price: marketcheckResult.data.predictedPrice,
            comparables_count: marketcheckResult.data.comparablesReturned,
          },
        })
      } else {
        console.error(`[MarketCheck] API failed for report ${reportId}:`, marketcheckResult.error)

        // Log failed API call
        await supabaseAdmin.from('api_call_logs').insert({
          report_id: reportId,
          api_provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          cost: 0.00, // No cost for failed calls
          success: false,
          error_message: marketcheckResult.error,
          response_time_ms: apiResponseTime,
          request_data: {
            vin,
            mileage,
            zip_code,
            dealer_type: 'franchise',
          },
        })
      }
    }
  } catch (mcError) {
    console.error(`[MarketCheck] Exception for report ${reportId}:`, mcError)
    // Non-fatal: continue to PDF generation
  }

  // Trigger PDF generation in background
  // Note: In production, you'd use a job queue like BullMQ or Inngest
  // For now, we'll generate immediately but this could timeout for complex reports
  try {
    console.log(`Generating PDF for report ${reportId}...`)
    const pdfResult = await generateAndUploadPDF({ reportId })

    if (pdfResult.success) {
      console.log(`PDF generated successfully for report ${reportId}: ${pdfResult.pdfUrl}`)
    } else {
      console.error(`PDF generation failed for report ${reportId}:`, pdfResult.error)
      // Report stays in 'pending' status, user can manually trigger regeneration
    }
  } catch (pdfError) {
    console.error('Error generating PDF in webhook:', pdfError)
    // Non-fatal: payment succeeded, PDF can be generated later
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id)

  // Update payment record status
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status: 'succeeded' })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (error) {
    console.error('Error updating payment status:', error)
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id)

  // Update payment record status
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (error) {
    console.error('Error updating payment status:', error)
  }
}
