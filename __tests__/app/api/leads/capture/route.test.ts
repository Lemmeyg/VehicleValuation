/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'

jest.mock('@/lib/db/supabase')
import { supabaseAdmin } from '@/lib/db/supabase'
import { POST, _rateLimitMap } from '@/app/api/leads/capture/route'

function makeRequest(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://localhost/api/leads/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  _rateLimitMap.clear()
  ;(supabaseAdmin as any).rpc = jest.fn().mockResolvedValue({ data: null, error: null })
})

describe('POST /api/leads/capture', () => {
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
    const req = new NextRequest('http://localhost/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with { ok: true } for valid email', async () => {
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('calls upsert_lead RPC with form_submitted lead type', async () => {
    await POST(makeRequest({ email: 'user@example.com' }))
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'form_submitted',
    })
  })

  it('normalises email to lowercase before saving', async () => {
    await POST(makeRequest({ email: 'User@Example.COM' }))
    expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
      p_email: 'user@example.com',
      p_lead_type: 'form_submitted',
    })
  })

  it('returns 500 when RPC fails', async () => {
    ;(supabaseAdmin as any).rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(500)
  })

  it('returns 429 after rate limit exceeded from same IP', async () => {
    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ email: `user${i}@example.com` }, '9.9.9.9'))
    }
    const res = await POST(makeRequest({ email: 'extra@example.com' }, '9.9.9.9'))
    expect(res.status).toBe(429)
  })

  it('does not rate-limit requests from different IPs', async () => {
    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ email: `user${i}@example.com` }, '3.3.3.3'))
    }
    const res = await POST(makeRequest({ email: 'other@example.com' }, '4.4.4.4'))
    expect(res.status).toBe(200)
  })
})
