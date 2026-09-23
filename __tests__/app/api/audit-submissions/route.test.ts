/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'

jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: jest.fn((fn: () => unknown) => Promise.resolve(fn()).catch(() => {})),
}))

jest.mock('@/lib/db/supabase')
import { supabaseAdmin } from '@/lib/db/supabase'

jest.mock('@/lib/audit-submissions/malware-scan', () => ({
  scanFileForThreats: jest.fn().mockResolvedValue({ safe: true }),
}))
import { scanFileForThreats } from '@/lib/audit-submissions/malware-scan'
const mockScan = scanFileForThreats as jest.Mock

jest.mock('@/lib/audit-submissions/match-report', () => ({
  findMatchingReportId: jest.fn().mockResolvedValue(null),
}))
import { findMatchingReportId } from '@/lib/audit-submissions/match-report'
const mockFindMatch = findMatchingReportId as jest.Mock

jest.mock('@/lib/analytics/server-events', () => ({
  captureAuditFormSubmitted: jest.fn().mockResolvedValue(undefined),
}))
import { captureAuditFormSubmitted } from '@/lib/analytics/server-events'
const mockCaptureSubmitted = captureAuditFormSubmitted as jest.Mock

import { POST, _rateLimitMap } from '@/app/api/audit-submissions/route'

function makePdfFile(name = 'report.pdf'): File {
  const bytes = new TextEncoder().encode('%PDF-1.4 fake pdf content')
  return new File([bytes], name, { type: 'application/pdf' })
}

function makeFormRequest(
  fields: {
    email?: string
    note?: string
    consentAck?: string
    file?: File | null
    honeypot?: string
  },
  ip = '1.2.3.4'
) {
  const formData = new FormData()
  if (fields.email !== undefined) formData.set('email', fields.email)
  if (fields.note !== undefined) formData.set('note', fields.note)
  if (fields.consentAck !== undefined) formData.set('consentAck', fields.consentAck)
  if (fields.file !== undefined && fields.file !== null) formData.set('file', fields.file)
  if (fields.honeypot !== undefined) formData.set('company_website', fields.honeypot)

  return new NextRequest('http://localhost/api/audit-submissions', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: formData,
  })
}

const validFields = { email: 'user@example.com', consentAck: 'true', file: makePdfFile() }

beforeEach(() => {
  jest.clearAllMocks()
  _rateLimitMap.clear()
  mockScan.mockResolvedValue({ safe: true })
  mockFindMatch.mockResolvedValue(null)
  mockCaptureSubmitted.mockResolvedValue(undefined)

  const mockUpload = jest.fn().mockResolvedValue({ error: null })
  const mockRemove = jest.fn().mockResolvedValue({ error: null })
  ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
    upload: mockUpload,
    remove: mockRemove,
  })
  ;(supabaseAdmin as any)._mockUpload = mockUpload
  ;(supabaseAdmin as any)._mockRemove = mockRemove

  const mockInsert = jest.fn().mockResolvedValue({ error: null })
  ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({ insert: mockInsert })
  ;(supabaseAdmin as any)._mockInsert = mockInsert
})

describe('POST /api/audit-submissions', () => {
  it('returns 200 success for a valid submission', async () => {
    const res = await POST(makeFormRequest(validFields))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('uploads the file to the audit-submissions-backfill bucket', async () => {
    await POST(makeFormRequest(validFields))
    expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('audit-submissions-backfill')
    expect((supabaseAdmin as any)._mockUpload).toHaveBeenCalled()
  })

  it('inserts a row with the matched report id when a match is found', async () => {
    mockFindMatch.mockResolvedValueOnce('report-123')
    await POST(makeFormRequest(validFields))
    expect((supabaseAdmin as any)._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', matched_report_id: 'report-123' })
    )
  })

  it('inserts a row with matched_report_id null when no match is found', async () => {
    await POST(makeFormRequest(validFields))
    expect((supabaseAdmin as any)._mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ matched_report_id: null })
    )
  })

  it('captures audit_form_submitted with has_note false when no note was given', async () => {
    await POST(makeFormRequest(validFields))
    expect(mockCaptureSubmitted).toHaveBeenCalledWith({ hasNote: false })
  })

  it('captures audit_form_submitted with has_note true when a note was given', async () => {
    await POST(makeFormRequest({ ...validFields, note: 'extra context' }))
    expect(mockCaptureSubmitted).toHaveBeenCalledWith({ hasNote: true })
  })

  it('returns 400 for a missing email', async () => {
    const res = await POST(makeFormRequest({ ...validFields, email: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid email', async () => {
    const res = await POST(makeFormRequest({ ...validFields, email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when consentAck is not true', async () => {
    const res = await POST(makeFormRequest({ ...validFields, consentAck: 'false' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no file is attached', async () => {
    const res = await POST(makeFormRequest({ ...validFields, file: null }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a disallowed file type', async () => {
    const badFile = new File([new TextEncoder().encode('PK\x03\x04zip')], 'archive.zip', {
      type: 'application/zip',
    })
    const res = await POST(makeFormRequest({ ...validFields, file: badFile }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a file over 15MB', async () => {
    const bigBytes = new Uint8Array(15 * 1024 * 1024 + 1)
    const bigFile = new File([bigBytes], 'big.pdf', { type: 'application/pdf' })
    const res = await POST(makeFormRequest({ ...validFields, file: bigFile }))
    expect(res.status).toBe(400)
  })

  it('returns 400 and does not store the file when the malware scan reports unsafe', async () => {
    mockScan.mockResolvedValueOnce({ safe: false, reason: 'flagged_by_reputation_scan' })
    const res = await POST(makeFormRequest(validFields))
    expect(res.status).toBe(400)
    expect((supabaseAdmin as any)._mockUpload).not.toHaveBeenCalled()
  })

  it('returns 503 when the malware scan throws (fail closed)', async () => {
    mockScan.mockRejectedValueOnce(new Error('VIRUSTOTAL_API_KEY is not configured'))
    const res = await POST(makeFormRequest(validFields))
    expect(res.status).toBe(503)
  })

  it('returns an identical success response for a honeypot-triggered request, without storing it or firing analytics', async () => {
    const res = await POST(makeFormRequest({ ...validFields, honeypot: 'spam-bot-filled-this' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect((supabaseAdmin as any)._mockUpload).not.toHaveBeenCalled()
    expect((supabaseAdmin as any)._mockInsert).not.toHaveBeenCalled()
    expect(mockCaptureSubmitted).not.toHaveBeenCalled()
  })

  it('returns 500 and removes the uploaded file when the DB insert fails', async () => {
    ;(supabaseAdmin as any).from = jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    })
    const res = await POST(makeFormRequest(validFields))
    expect(res.status).toBe(500)
    expect((supabaseAdmin as any)._mockRemove).toHaveBeenCalled()
  })

  it('returns 429 after 5 requests from the same IP within the window', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeFormRequest({ ...validFields, email: `user${i}@example.com` }, '5.5.5.5'))
    }
    const res = await POST(
      makeFormRequest({ ...validFields, email: 'sixth@example.com' }, '5.5.5.5')
    )
    expect(res.status).toBe(429)
  })

  it('does not rate-limit requests from different IPs', async () => {
    await POST(makeFormRequest({ ...validFields, email: 'a@example.com' }, '1.1.1.1'))
    const res = await POST(makeFormRequest({ ...validFields, email: 'b@example.com' }, '2.2.2.2'))
    expect(res.status).toBe(200)
  })
})
