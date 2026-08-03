import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('report_id', id)
    .eq('status', 'succeeded')
    .maybeSingle()

  return NextResponse.json({ confirmed: payment != null })
}
