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

function makeRequest(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`)
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

  it('still redirects unauthenticated user from /dashboard', async () => {
    const response = await proxy(makeRequest('/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
