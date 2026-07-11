/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'

jest.mock('@/lib/db/supabase')
import { supabaseAdmin } from '@/lib/db/supabase'
jest.mock('@/lib/zoho-campaigns', () => ({
  addContactToList: jest.fn().mockResolvedValue(undefined),
}))
import { addContactToList } from '@/lib/zoho-campaigns'
const mockAddContactToList = addContactToList as jest.Mock
import { POST, _rateLimitMap } from '@/app/api/dispute-letter/route'

function makeRequest(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://localhost/api/dispute-letter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  _rateLimitMap.clear()
  ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })

  const mockCreateSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.url/file.docx' },
    error: null,
  })
  ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
    createSignedUrl: mockCreateSignedUrl,
  })
  ;(supabaseAdmin as any)._mockCreateSignedUrl = mockCreateSignedUrl
})

describe('POST /api/dispute-letter', () => {
  it('returns 400 for missing email', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/dispute-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with downloadUrl for valid email', async () => {
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.downloadUrl).toBe('https://signed.url/file.docx')
  })

  it('calls upsert_lead RPC with dispute_letter lead type', async () => {
    await POST(makeRequest({ email: 'user@example.com' }))
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'dispute_letter',
    })
  })

  it('still returns 200 even when lead RPC fails', async () => {
    ;(supabaseAdmin as any).rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.downloadUrl).toBe('https://signed.url/file.docx')
  })

  it('returns 500 when storage signed URL fails', async () => {
    const mockCreateSignedUrl = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage error' },
    })
    ;(supabaseAdmin.storage as any).from = jest.fn().mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    })
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('hello@totallosstoolkit.com')
  })

  it('returns 429 after 3 requests from same IP within window', async () => {
    await POST(makeRequest({ email: 'a@example.com' }, '5.5.5.5'))
    await POST(makeRequest({ email: 'b@example.com' }, '5.5.5.5'))
    await POST(makeRequest({ email: 'c@example.com' }, '5.5.5.5'))
    const res = await POST(makeRequest({ email: 'd@example.com' }, '5.5.5.5'))
    expect(res.status).toBe(429)
  })

  it('does not rate-limit requests from different IPs', async () => {
    await POST(makeRequest({ email: 'a@example.com' }, '1.1.1.1'))
    await POST(makeRequest({ email: 'b@example.com' }, '1.1.1.1'))
    await POST(makeRequest({ email: 'c@example.com' }, '1.1.1.1'))
    const res = await POST(makeRequest({ email: 'd@example.com' }, '2.2.2.2'))
    expect(res.status).toBe(200)
  })

  it('enrolls the downloader in the Zoho Campaigns dispute-letter list', async () => {
    process.env.ZOHO_CAMPAIGNS_DISPUTE_LETTER_LIST_KEY = 'test-list-key'
    await POST(makeRequest({ email: 'user@example.com' }))
    expect(mockAddContactToList).toHaveBeenCalledWith({
      listKey: 'test-list-key',
      email: 'user@example.com',
    })
  })

  it('still returns 200 even when Zoho Campaigns enrollment fails', async () => {
    mockAddContactToList.mockRejectedValueOnce(new Error('Zoho down'))
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
  })
})
