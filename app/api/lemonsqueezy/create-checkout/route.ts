import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/db/auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import { createCheckout } from '@/lib/lemonsqueezy/client'

export async function POST(request: NextRequest) {
  try {
    // Session is optional — anonymous users may initiate checkout
    const user = await getUser()

    // Parse request body
    const body = await request.json()
    const { reportId, reportType, discountCode } = body

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

    // Get report and verify ownership — use admin client so anonymous (no-session) users
    // can still look up their own report. Ownership is verified explicitly below.
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      console.error('Report fetch error:', reportError)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Verify ownership only when user is authenticated and report has a user_id
    if (user && report.user_id && report.user_id !== user.id) {
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

    // Get app URL for redirect.
    // On Vercel the internal serverless request URL is not the public-facing URL;
    // the real hostname is in x-forwarded-host / x-forwarded-proto headers.
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin)
    console.log('[create-checkout] appUrl resolved to:', appUrl)

    // For anonymous users, successUrl goes straight to the view page with the token.
    // Authenticated users continue to the success page (no change).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessToken = (report as any).access_token as string | null
    let successUrl = `${appUrl}/reports/${reportId}/success`
    if (!user && accessToken) {
      successUrl = `${appUrl}/reports/${reportId}/view?token=${accessToken}`
    }

    // Prices must stay in sync with PRICING_TIERS in app/pricing/page.tsx — there is
    // no shared server-side pricing config today. Only used for the checkout_abandoned
    // event fired from /view; not the source of truth for what the buyer is charged.
    const PLAN_PRICES: Record<string, number> = { BASIC: 19, PREMIUM: 25 }
    const price = PLAN_PRICES[reportType]

    // cancelUrl points at the view page so a cancelled checkout can be tracked and
    // re-engaged with, rather than the deprecated /reports/[id] redirect page.
    // Anonymous users need the access_token too, or /view bounces them to /auth
    // before checkout_status is ever read. plan/price are threaded through because
    // /view has no other way to know which plan a cancelled checkout was for.
    const cancelParams = `checkout_status=cancelled&plan=${reportType.toLowerCase()}&price=${price}`
    let cancelUrl = `${appUrl}/reports/${reportId}/view?${cancelParams}`
    if (!user && accessToken) {
      cancelUrl = `${appUrl}/reports/${reportId}/view?token=${accessToken}&${cancelParams}`
    }

    // Create checkout session
    const checkout = await createCheckout({
      variantId,
      customData: {
        reportId,
        reportType,
        ...(user?.id ? { userId: user.id } : {}),
      },
      successUrl,
      cancelUrl,
      discountCode,
      testMode: process.env.LEMONSQUEEZY_TEST_MODE === 'true',
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
