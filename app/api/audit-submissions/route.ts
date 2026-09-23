import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import {
  auditSubmissionSchema,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/audit-submissions/validation'
import { scanFileForThreats } from '@/lib/audit-submissions/malware-scan'
import { findMatchingReportId } from '@/lib/audit-submissions/match-report'
import { captureAuditFormSubmitted } from '@/lib/analytics/server-events'

const HONEYPOT_FIELD = 'company_website'
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
export const _rateLimitMap = rateLimitMap

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) return true
    entry.count++
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  }
  return false
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot: a real user never fills this hidden field. Respond exactly like a
  // genuine success so a bot gets no signal, but never persist or count it —
  // this must never inflate audit_form_submitted.
  const honeypot = formData.get(HONEYPOT_FIELD)
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return NextResponse.json({ success: true })
  }

  const rawNote = formData.get('note')
  const parsed = auditSubmissionSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    note: typeof rawNote === 'string' && rawNote.trim() !== '' ? rawNote : undefined,
    consentAck: formData.get('consentAck') === 'true',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Please attach a file.' }, { status: 400 })
  }

  if (!isAllowedMimeType(file.type)) {
    return NextResponse.json({ error: 'Please upload a PDF, JPG, or PNG file.' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be 15MB or smaller.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let scanResult
  try {
    scanResult = await scanFileForThreats(buffer, file.type)
  } catch (err) {
    console.error('[audit-submissions] malware scan failed', err)
    return NextResponse.json(
      { error: 'Submissions are temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    )
  }

  if (!scanResult.safe) {
    console.error('[audit-submissions] file rejected by scan', { reason: scanResult.reason })
    return NextResponse.json({ error: 'This file could not be accepted.' }, { status: 400 })
  }

  const submissionId = crypto.randomUUID()
  const storagePath = `${submissionId}/${file.name}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('audit-submissions-backfill')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[audit-submissions] storage upload failed', uploadError)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  const matchedReportId = await findMatchingReportId(parsed.data.email)

  const { error: insertError } = await supabaseAdmin.from('audit_submissions_backfill').insert({
    id: submissionId,
    email: parsed.data.email,
    matched_report_id: matchedReportId,
    file_storage_path: storagePath,
    file_mime_type: file.type,
    note: parsed.data.note ?? null,
    consent_ack: parsed.data.consentAck,
  })

  if (insertError) {
    console.error('[audit-submissions] insert failed', insertError)
    await supabaseAdmin.storage.from('audit-submissions-backfill').remove([storagePath])
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  // Deferred with after() so the response is never blocked on analytics, but
  // (unlike a bare fire-and-forget .catch()) the Next.js runtime guarantees
  // this still runs to completion even if the serverless function would
  // otherwise be frozen the instant the response is sent. audit_form_submitted
  // is the one metric the Epic 1 go/no-go threshold is measured against, so
  // silently dropping it for some fraction of requests is not acceptable —
  // see the doc comment on captureAuditFormSubmitted itself.
  after(() =>
    captureAuditFormSubmitted({ hasNote: Boolean(parsed.data.note) }).catch(err =>
      console.error('[audit-submissions] analytics capture failed (non-fatal)', err)
    )
  )

  return NextResponse.json({ success: true })
}
