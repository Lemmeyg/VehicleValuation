/**
 * POST /api/stripe/create-checkout
 *
 * Creates a Stripe checkout session for purchasing a report.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/db/auth'
import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'
import { stripe, getReportPrice, type ReportType } from '@/lib/stripe/stripe-client'

export async function POST(request: Request) {
  try {
    // Require authentication
    const user = await requireAuth()

    // Parse request body
    const body = await request.json()
    const { reportId, reportType } = body as {
      reportId: string
      reportType: ReportType
    }

    // Validate inputs
    if (!reportId || !reportType) {
      return NextResponse.json(
        { error: 'Report ID and report type are required' },
        { status: 400 }
      )
    }

    if (reportType !== 'BASIC' && reportType !== 'PREMIUM') {
      return NextResponse.json(
        { error: 'Invalid report type. Must be BASIC or PREMIUM' },
        { status: 400 }
      )
    }

    // Verify report exists and belongs to user
    const supabase = await createRouteHandlerSupabaseClient()

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, vin, user_id, status, price_paid')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found or access denied' },
        { status: 404 }
      )
    }

    // Check if report already has a payment
    if (report.price_paid > 0) {
      return NextResponse.json(
        { error: 'Report has already been paid for' },
        { status: 400 }
      )
    }

    // Get price for report type
    const price = getReportPrice(reportType)

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${reportType === 'BASIC' ? 'Basic' : 'Premium'} Vehicle Valuation Report`,
              description: `VIN: ${report.vin}`,
              images: [], // Optional: Add product image URL
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        reportId: report.id,
        userId: user.id,
        reportType,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/reports/${reportId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/reports/${reportId}?canceled=true`,
    })

    return NextResponse.json(
      {
        sessionId: session.id,
        url: session.url,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Create checkout error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
