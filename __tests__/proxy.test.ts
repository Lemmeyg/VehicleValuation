/**
 * @jest-environment node
 *
 * Middleware (proxy.ts) tests
 * Verifies auth-bypass rules for report pages
 */
import { proxy } from '@/proxy'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@supabase/ssr')

const mockGetUser = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(createServerClient as jest.Mock).mockReturnValue({
    auth: { getUser: mockGetUser },
  })
})

function makeRequest(pathname: string, search = '') {
  return new NextRequest(`http://localhost:3000${pathname}${search}`)
}

describe('proxy middleware — unauthenticated user', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
  })

  it('redirects unauthenticated user from /reports/[id]', async () => {
    const response = await proxy(makeRequest('/reports/abc123'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated user to access /reports/[id]/success', async () => {
    const response = await proxy(makeRequest('/reports/abc123/success'))
    expect(response.status).not.toBe(307)
  })

  it('allows unauthenticated user to access /reports/[id]/view', async () => {
    const response = await proxy(makeRequest('/reports/abc123/view'))
    expect(response.status).not.toBe(307)
  })

  // BL-126: paying customers clicking "Save as PDF" were bounced to /login because
  // /print had no carve-out, making the print page's own ?token= check unreachable.
  it('allows unauthenticated user to access /reports/[id]/print', async () => {
    const response = await proxy(makeRequest('/reports/abc123/print'))
    expect(response.status).not.toBe(307)
  })

  it('allows unauthenticated token access to /reports/[id]/print', async () => {
    const response = await proxy(makeRequest('/reports/abc123/print', '?token=tok-123'))
    expect(response.status).not.toBe(307)
  })

  it('does not carve out unrelated nested report routes', async () => {
    const response = await proxy(makeRequest('/reports/abc123/print/extra'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('preserves the query string in the redirect param', async () => {
    const response = await proxy(makeRequest('/reports/abc123', '?token=tok-123'))
    expect(response.status).toBe(307)
    const location = response.headers.get('location') ?? ''
    const redirectParam = new URL(location).searchParams.get('redirect')
    expect(redirectParam).toBe('/reports/abc123?token=tok-123')
  })

  it('still redirects unauthenticated user from /dashboard', async () => {
    const response = await proxy(makeRequest('/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
