/**
 * Unit Tests for Authentication Utilities
 *
 * Tests for auth helper functions in lib/db/auth.ts
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { User } from '@supabase/supabase-js'

// Mock the Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(),
}

// Mock the createServerSupabaseClient function
jest.mock('@/lib/db/supabase', () => ({
  createServerSupabaseClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Import after mocking
import { getUser, getSession, requireAuth, isAuthenticated, getUserProfile, signOut, isAuthError } from '@/lib/db/auth'

describe('Authentication Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser: Partial<User> = {
        id: '123',
        email: 'test@example.com',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const user = await getUser()

      expect(user).toEqual(mockUser)
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1)
    })

    it('should return null when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const user = await getUser()

      expect(user).toBeNull()
    })
  })

  describe('getSession', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        user: { id: '123', email: 'test@example.com' },
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const session = await getSession()

      expect(session).toEqual(mockSession)
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1)
    })

    it('should return null when no session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const session = await getSession()

      expect(session).toBeNull()
    })
  })

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser: Partial<User> = {
        id: '123',
        email: 'test@example.com',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const user = await requireAuth()

      expect(user).toEqual(mockUser)
    })

    it('should throw error when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', async () => {
      const mockUser: Partial<User> = {
        id: '123',
        email: 'test@example.com',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const authenticated = await isAuthenticated()

      expect(authenticated).toBe(true)
    })

    it('should return false when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const authenticated = await isAuthenticated()

      expect(authenticated).toBe(false)
    })
  })

  describe('getUserProfile', () => {
    it('should return profile when user is authenticated', async () => {
      const mockUser: Partial<User> = {
        id: '123',
        email: 'test@example.com',
      }

      const mockProfile = {
        id: '123',
        full_name: 'Test User',
        company: 'Test Company',
        email_notifications: true,
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
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

      const profile = await getUserProfile()

      expect(profile).toEqual(mockProfile)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_profiles')
      expect(mockFrom.select).toHaveBeenCalledWith('*')
      expect(mockFrom.eq).toHaveBeenCalledWith('id', '123')
      expect(mockFrom.single).toHaveBeenCalled()
    })

    it('should return null when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const profile = await getUserProfile()

      expect(profile).toBeNull()
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    it('should return null when profile fetch fails', async () => {
      const mockUser: Partial<User> = {
        id: '123',
        email: 'test@example.com',
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
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

      const profile = await getUserProfile()

      expect(profile).toBeNull()
    })
  })

  describe('signOut', () => {
    it('should call signOut on supabase client', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      })

      await signOut()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1)
    })
  })

  describe('isAuthError', () => {
    it('should return true for Unauthorized error', () => {
      const error = new Error('Unauthorized')
      expect(isAuthError(error)).toBe(true)
    })

    it('should return true for auth-related errors', () => {
      const error = new Error('auth error occurred')
      expect(isAuthError(error)).toBe(true)
    })

    it('should return false for non-auth errors', () => {
      const error = new Error('Something went wrong')
      expect(isAuthError(error)).toBe(false)
    })

    it('should return false for non-Error objects', () => {
      expect(isAuthError('not an error')).toBe(false)
      expect(isAuthError(null)).toBe(false)
      expect(isAuthError(undefined)).toBe(false)
      expect(isAuthError(123)).toBe(false)
    })
  })
})
