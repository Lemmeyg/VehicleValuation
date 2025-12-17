import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy/client'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
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
    const { reportId, reportType } = customData

    const orderId = event.data.id
    const amount = event.data.attributes.total
    const status = event.data.attributes.status

    console.log(`Processing order ${orderId} for report ${reportId}`)

    // Only process paid orders
    if (status !== 'paid') {
      console.log(`Order ${orderId} status is ${status}, skipping`)
      return
    }

    // Get Supabase client (using service role for webhook context)
    const supabase = await createServerSupabaseClient()

    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      report_id: reportId,
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

    // Update report with payment information
    const { error: reportError } = await supabase
      .from('reports')
      .update({
        price_paid: amount,
        stripe_payment_id: orderId,
        status: 'pending',
      })
      .eq('id', reportId)

    if (reportError) {
      console.error('Error updating report:', reportError)
      throw new Error(`Failed to update report: ${reportError.message}`)
    }

    console.log(`Report ${reportId} updated with payment info`)

    // Generate PDF asynchronously
    // Note: In production, consider using a queue for this
    generateAndUploadPDF(reportId).catch(error => {
      console.error(`PDF generation failed for report ${reportId}:`, error)
      // Optionally: Update report status to 'failed' or send alert
    })

    console.log(`PDF generation initiated for report ${reportId}`)
  } catch (error) {
    console.error('Error handling order_created event:', error)
    throw error
  }
}

async function handleOrderRefunded(event: LemonSqueezyWebhookEvent) {
  try {
    const orderId = event.data.id

    console.log(`Processing refund for order ${orderId}`)

    const supabase = await createServerSupabaseClient()

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
