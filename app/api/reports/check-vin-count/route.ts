import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

export async function GET(request: NextRequest) {
  const vin = request.nextUrl.searchParams.get('vin')

  if (!vin) {
    return NextResponse.json({ error: 'Missing vin parameter' }, { status: 400 })
  }

  const { count, error } = await supabaseAdmin
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('vin', vin)

  if (error) {
    console.error('[check-vin-count] Supabase error:', error)
    return NextResponse.json({ error: 'Failed to check VIN' }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
