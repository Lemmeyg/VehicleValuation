import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { createCheckout } from '@/lib/lemonsqueezy/client'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth()

    // Parse request body
    const body = await request.json()
    const { reportId, reportType } = body

    // Validate inputs
    if (!reportId || !reportType) {
      return NextResponse.json({ error: 'Missing reportId or reportType' }, { status: 400 })
    }

    if (reportType !== 'BASIC' && reportType !== 'PREMIUM') {
      return NextResponse.json(
        { error: 'Invalid reportType. Must be BASIC or PREMIUM' },
        { status: 400 }
      )
    }

    // Get report and verify ownership
    const supabase = await createServerSupabaseClient()
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      console.error('Report fetch error:', reportError)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Verify ownership
    if (report.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this report' },
        { status: 403 }
      )
    }

    // Check if already paid
    if (report.price_paid && report.price_paid > 0) {
      return NextResponse.json({ error: 'Report already paid for' }, { status: 400 })
    }

    // Determine variant ID based on report type
    const variantId =
      reportType === 'BASIC'
        ? process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID
        : process.env.NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID

    if (!variantId) {
      console.error(`Missing variant ID for ${reportType} plan`)
      return NextResponse.json({ error: 'Payment configuration error' }, { status: 500 })
    }

    // Get app URL for redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create checkout session
    const checkout = await createCheckout({
      variantId,
      customData: {
        reportId,
        userId: user.id,
        reportType,
      },
      successUrl: `${appUrl}/reports/${reportId}/success?session_id={CHECKOUT_ID}`,
      cancelUrl: `${appUrl}/reports/${reportId}`,
    })

    // Return checkout URL
    return NextResponse.json({
      checkoutUrl: checkout.data.attributes.url,
      checkoutId: checkout.data.id,
    })
  } catch (error) {
    console.error('Checkout creation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      },
      { status: 500 }
    )
  }
}
