/**
 * POST /api/admin/reports/[id]/reassign
 *
 * Admin-only endpoint to reassign a report to a different user account.
 * Identifies the target user by email address.
 * Logs the action to admin_audit_log.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireAdmin()
    const { id: reportId } = await params

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 })
    }

    // Look up target user by email
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    if (usersError) {
      console.error('[REASSIGN] Error listing users:', usersError)
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
    }

    const targetUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    // Fetch current report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('id, user_id')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Guard: already assigned to this user
    if (report.user_id === targetUser.id) {
      return NextResponse.json(
        { error: 'Report is already assigned to this user' },
        { status: 400 }
      )
    }

    const fromUserId = report.user_id

    // Update report user_id
    const { error: updateError } = await supabaseAdmin
      .from('reports')
      .update({ user_id: targetUser.id })
      .eq('id', reportId)

    if (updateError) {
      console.error('[REASSIGN] Error updating report:', updateError)
      return NextResponse.json({ error: 'Failed to reassign report' }, { status: 500 })
    }

    // Log to admin_audit_log
    await supabaseAdmin.from('admin_audit_log').insert({
      action: 'reassign_report',
      admin_user_id: admin.id,
      entity_type: 'report',
      entity_id: reportId,
      from_value: fromUserId,
      to_value: targetUser.id,
      metadata: { target_email: email.toLowerCase() },
    })

    return NextResponse.json({
      success: true,
      newUserId: targetUser.id,
      newUserEmail: targetUser.email,
    })
  } catch (error) {
    console.error('[REASSIGN] Unexpected error:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
