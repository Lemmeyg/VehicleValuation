import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { upsertLead } from '@/lib/leads'

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

  // Lead capture — non-fatal: the user can still download even if this fails
  try {
    await upsertLead(supabaseAdmin, email, 'dispute_letter')
  } catch (err) {
    console.error('[dispute-letter] Lead capture failed (non-fatal):', err)
  }

  const { data, error: storageError } = await supabaseAdmin.storage
    .from('lead-magnets')
    .createSignedUrl('dispute-letter/total-loss-dispute-letter.docx', 60)

  if (storageError || !data?.signedUrl) {
    console.error('[dispute-letter] Storage error:', storageError)
    return NextResponse.json(
      { error: 'Something went wrong. Email us at hello@totallosstoolkit.com' },
      { status: 500 }
    )
  }

  return NextResponse.json({ downloadUrl: data.signedUrl })
}
