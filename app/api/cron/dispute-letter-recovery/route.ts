import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { addContactToList } from '@/lib/zoho-campaigns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const listKey = process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY
  if (!listKey) {
    console.error('[dispute-letter-recovery] ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY not set')
    return NextResponse.json({ ok: true, enrolled: 0 })
  }

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('email')
    .eq('lead_type', 'dispute_letter')
    .is('dispute_letter_zoho_enrolled_at', null)

  if (error) {
    console.error('[dispute-letter-recovery] query error:', error)
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  let enrolled = 0

  for (const lead of leads ?? []) {
    if (!lead.email) continue

    try {
      const success = await addContactToList({ listKey, email: lead.email })
      if (!success) continue

      const { error: updateError } = await supabaseAdmin
        .from('leads')
        .update({ dispute_letter_zoho_enrolled_at: new Date().toISOString() })
        .eq('email', lead.email)

      if (updateError) {
        console.error(`[dispute-letter-recovery] failed to flag ${lead.email}:`, updateError)
      } else {
        enrolled++
      }
    } catch (err) {
      console.error(`[dispute-letter-recovery] failed for ${lead.email}:`, err)
    }
  }

  return NextResponse.json({ ok: true, enrolled })
}
