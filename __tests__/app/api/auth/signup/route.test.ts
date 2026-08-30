/**
 * Integration Tests for Signup API Route
 *
 * Tests for /api/auth/signup endpoint
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
// `jest` is the global, not the @jest/globals export — only the global
// `jest.mock` is hoisted above the (hoisted) import below, so the
// `@/lib/db/supabase` mock applies before the route pulls in the real client
// (which calls `cookies()` outside a request scope and throws).
import { POST } from '@/app/api/auth/signup/route'

// Mock the Supabase client
const mockSupabaseClient = {
  auth: {
    signUp: jest.fn(),
  },
}

jest.mock('@/lib/db/supabase', () => ({
  createRouteHandlerSupabaseClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// The signup route rate-limits to 3 attempts/min/IP and every test request
// shares the same (absent) IP, so the 4th test onward hit a real 429. Stub the
// limiter — rate-limit behaviour is covered separately in the reports/create
// route tests.
jest.mock('@/lib/rate-limit', () => ({
  signupLimiter: { check: jest.fn().mockResolvedValue(undefined) },
  loginLimiter: { check: jest.fn().mockResolvedValue(undefined) },
}))

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a new user account successfully', async () => {
    const mockUser = {
      id: '123',
      email: 'newuser@example.com',
    }

    const mockSession = {
      access_token: 'token123',
      refresh_token: 'refresh123',
    }

    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: {
        user: mockUser,
        session: mockSession,
      },
      error: null,
    })

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
        company: 'Test Company',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.message).toBe('Account created successfully')
    expect(data.user).toEqual(mockUser)
    expect(data.session).toEqual(mockSession)
  })

  it('should require email confirmation when enabled', async () => {
    const mockUser = {
      id: '123',
      email: 'newuser@example.com',
    }

    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: {
        user: mockUser,
        session: null, // No session = email confirmation required
      },
      error: null,
    })

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'password123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.requiresEmailConfirmation).toBe(true)
    expect(data.message).toContain('Confirmation email sent')
  })

  it('should reject signup with missing email', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        password: 'password123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email and password are required')
  })

  it('should reject signup with missing password', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email and password are required')
  })

  it('should reject signup with short password', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'short',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Password must be at least 8 characters long')
  })

  it('should handle duplicate email error', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'password123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Email already registered')
  })

  it('should handle other signup errors', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid email format' },
    })

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid email format')
  })
})
