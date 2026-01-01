/**
 * Magic Link API Integration Tests
 *
 * Tests magic link authentication endpoint
 * CRITICAL: Supabase auth is mocked to prevent real email sends
 */

import { POST } from '@/app/api/auth/magic-link/route'
import { supabaseAdmin } from '@/lib/db/supabase'

// Mock Supabase admin client
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    auth: {
      signInWithOtp: jest.fn(),
    },
    from: jest.fn(),
  },
}))

describe('POST /api/auth/magic-link', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Email Validation', () => {
    it('should accept valid email', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject missing email', async () => {
      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject invalid email format', async () => {
      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('format')
    })

    it('should sanitize email (trim and lowercase)', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '  USER@EXAMPLE.COM  ',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(supabaseAdmin.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: expect.any(Object),
      })
    })
  })

  describe('Magic Link Sending', () => {
    it('should send magic link successfully', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('sent')
      expect(supabaseAdmin.auth.signInWithOtp).toHaveBeenCalled()
    })

    it('should include reportId in redirect URL if provided', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ error: null }),
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          reportId: 'report-123',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(supabaseAdmin.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('reportId=report-123'),
          shouldCreateUser: true,
        },
      })
    })

    it('should link report to email when reportId provided', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockIs = jest.fn().mockResolvedValue({ error: null })

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        is: mockIs,
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          reportId: 'report-123',
        }),
      })

      await POST(request)

      expect(supabaseAdmin.from).toHaveBeenCalledWith('reports')
      expect(mockUpdate).toHaveBeenCalledWith({ email: 'user@example.com' })
      expect(mockEq).toHaveBeenCalledWith('id', 'report-123')
      expect(mockIs).toHaveBeenCalledWith('user_id', null)
    })
  })

  describe('Error Handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Email service error' },
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to send magic link')
    })

    it('should handle rate limiting errors', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Rate limit exceeded',
          status: 429,
          code: 'over_email_send_rate_limit',
        },
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('wait')
      expect(data.code).toBe('rate_limit')
    })

    it('should not fail request if report email update fails', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          reportId: 'report-123',
        }),
      })

      const response = await POST(request)

      // Should still succeed even if report update failed
      expect(response.status).toBe(200)
    })
  })

  describe('Security', () => {
    it('should not expose internal error details', async () => {
      ;(supabaseAdmin.auth.signInWithOtp as jest.Mock).mockImplementation(() => {
        throw new Error('Internal database error with sensitive info')
      })

      const request = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).not.toContain('database')
      expect(data.error).not.toContain('sensitive')
      expect(data.error).toBe('An unexpected error occurred. Please try again.')
    })
  })
})
