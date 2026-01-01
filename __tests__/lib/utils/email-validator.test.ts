/**
 * Email Validator Unit Tests
 *
 * Tests email validation, sanitization, and error handling
 */

import { isValidEmail, sanitizeEmail, getEmailValidationError } from '@/lib/utils/email-validator'

describe('Email Validator', () => {
  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('test.user@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.com')).toBe(true)
      expect(isValidEmail('user_name@example.com')).toBe(true)
      expect(isValidEmail('123@example.com')).toBe(true)
    })

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('invalid@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user @example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('should reject emails without domain extension', () => {
      expect(isValidEmail('user@domain')).toBe(false)
    })

    it('should handle edge cases', () => {
      // @ts-expect-error - Testing invalid input
      expect(isValidEmail(null)).toBe(false)
      // @ts-expect-error - Testing invalid input
      expect(isValidEmail(undefined)).toBe(false)
      // @ts-expect-error - Testing invalid input
      expect(isValidEmail(123)).toBe(false)
    })
  })

  describe('sanitizeEmail', () => {
    it('should trim whitespace', () => {
      expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com')
      expect(sanitizeEmail('\tuser@example.com\n')).toBe('user@example.com')
    })

    it('should convert to lowercase', () => {
      expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com')
      expect(sanitizeEmail('User@Example.Com')).toBe('user@example.com')
    })

    it('should handle both trim and lowercase', () => {
      expect(sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com')
    })

    it('should return empty string for invalid input', () => {
      // @ts-expect-error - Testing invalid input
      expect(sanitizeEmail(null)).toBe('')
      // @ts-expect-error - Testing invalid input
      expect(sanitizeEmail(undefined)).toBe('')
      // @ts-expect-error - Testing invalid input
      expect(sanitizeEmail(123)).toBe('')
      expect(sanitizeEmail('')).toBe('')
    })

    it('should preserve valid email structure', () => {
      expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com')
      expect(sanitizeEmail('user.name@example.co.uk')).toBe('user.name@example.co.uk')
    })
  })

  describe('getEmailValidationError', () => {
    it('should return null for valid emails', () => {
      expect(getEmailValidationError('user@example.com')).toBeNull()
      expect(getEmailValidationError('test.user@domain.co.uk')).toBeNull()
    })

    it('should return error for missing email', () => {
      expect(getEmailValidationError('')).toBe('Email is required')
      // @ts-expect-error - Testing invalid input
      expect(getEmailValidationError(null)).toBe('Email is required')
      // @ts-expect-error - Testing invalid input
      expect(getEmailValidationError(undefined)).toBe('Email is required')
    })

    it('should return error for invalid email format', () => {
      expect(getEmailValidationError('invalid')).toBe('Invalid email format')
      expect(getEmailValidationError('invalid@')).toBe('Invalid email format')
      expect(getEmailValidationError('@example.com')).toBe('Invalid email format')
    })

    it('should return error for email too long (RFC 5321)', () => {
      const longEmail = 'a'.repeat(250) + '@example.com' // 262 characters
      expect(getEmailValidationError(longEmail)).toBe('Email is too long (max 254 characters)')
    })

    it('should sanitize before validation', () => {
      // Should pass after trimming and lowercasing
      expect(getEmailValidationError('  USER@EXAMPLE.COM  ')).toBeNull()
    })
  })
})
