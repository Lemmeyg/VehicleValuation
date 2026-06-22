import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
export const _rateLimitMap = rateLimitMap

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    entry.count++
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  }

  let email: string
  try {
    const body = await request.json()
    email = String(body?.email ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  email = email.toLowerCase().trim()

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const { error: dbError } = await supabaseAdmin
    .from('leads')
    .upsert(
      { email, source: 'report', created_at: new Date().toISOString() },
      { onConflict: 'email,source' }
    )

  if (dbError) {
    console.error('[leads/capture] DB upsert error:', dbError)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
