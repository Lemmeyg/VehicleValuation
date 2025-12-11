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
