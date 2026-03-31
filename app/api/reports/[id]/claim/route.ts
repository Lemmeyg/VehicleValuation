import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { getUser } from '@/lib/db/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/reports/[id]/claim
 *
 * Links an existing report to the authenticated user's account.
 * Called after anonymous checkout when the buyer creates an account
 * on the success page. Requires a succeeded payment record on the report.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: reportId } = await params

  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify a succeeded payment exists for this report
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('report_id', reportId)
    .eq('status', 'succeeded')
    .maybeSingle()

  if (!payment) {
    return NextResponse.json(
      { error: 'No completed payment found for this report' },
      { status: 403 }
    )
  }

  // Link report to this user — only if not already claimed by another account
  const { error } = await supabaseAdmin
    .from('reports')
    .update({ user_id: user.id })
    .eq('id', reportId)
    .is('user_id', null)

  if (error) {
    console.error('[claim] Failed to link report to user:', error)
    return NextResponse.json({ error: 'Failed to claim report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
