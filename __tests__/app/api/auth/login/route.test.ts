/**
 * Integration Tests for Login API Route
 *
 * Tests for /api/auth/login endpoint
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { POST } from '@/app/api/auth/login/route'

// Mock the Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
  },
  from: jest.fn(),
}

jest.mock('@/lib/db/supabase', () => ({
  createRouteHandlerSupabaseClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should authenticate user successfully', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
    }

    const mockSession = {
      access_token: 'token123',
      refresh_token: 'refresh123',
    }

    const mockProfile = {
      id: '123',
      full_name: 'Test User',
      company: 'Test Company',
    }

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: mockUser,
        session: mockSession,
      },
      error: null,
    })

    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
    }

    mockSupabaseClient.from.mockReturnValue(mockFrom)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Login successful')
    expect(data.user.email).toBe('test@example.com')
    expect(data.user.profile).toEqual(mockProfile)
    expect(data.session).toEqual(mockSession)
  })

  it('should reject login with missing email', async () => {
    const request = new Request('http://localhost/api/auth/login', {
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

  it('should reject login with missing password', async () => {
    const request = new Request('http://localhost/api/auth/login', {
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

  it('should reject login with invalid credentials', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid email or password')
  })

  it('should handle login when profile fetch fails', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
    }

    const mockSession = {
      access_token: 'token123',
      refresh_token: 'refresh123',
    }

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: mockUser,
        session: mockSession,
      },
      error: null,
    })

    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' },
      }),
    }

    mockSupabaseClient.from.mockReturnValue(mockFrom)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Login successful')
    expect(data.user.profile).toBeNull()
  })
})
