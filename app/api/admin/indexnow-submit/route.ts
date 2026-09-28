/**
 * API: Submit URLs to IndexNow
 *
 * Lets tools outside the Next.js app (KB Creator, kb-maintainer, one-off
 * content fixes made directly against Supabase) tell Bing/Yandex a page
 * changed, without needing an admin login session. In-app publish flows
 * (the knowledge-base and directory upload routes) call submitToIndexNow()
 * directly instead of hitting this route.
 *
 * Auth reuses CRON_SECRET — the same shared-secret pattern already used for
 * server-to-server calls in this app (see /api/cron/abandoned-report-recovery).
 */

import { NextRequest, NextResponse } from 'next/server'
import { submitToIndexNow } from '@/lib/indexnow'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || !authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { urls?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.urls) || body.urls.some(u => typeof u !== 'string')) {
    return NextResponse.json({ error: '"urls" must be an array of strings' }, { status: 400 })
  }

  const urls = body.urls as string[]
  if (urls.length === 0) {
    return NextResponse.json({ error: '"urls" must not be empty' }, { status: 400 })
  }

  await submitToIndexNow(urls)

  return NextResponse.json({ success: true, submitted: urls.length })
}
