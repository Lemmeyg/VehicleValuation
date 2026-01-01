/**
 * Report Validation Unit Tests
 *
 * Tests report ownership, payment validation, and security checks
 */

import {
  validateReportOwnership,
  validatePaymentStatus,
  validateReportData,
} from '@/lib/security/report-validation'
import { createServerSupabaseClient } from '@/lib/db/supabase'

// Mock Supabase client
jest.mock('@/lib/db/supabase', () => ({
  createServerSupabaseClient: jest.fn(),
}))

const mockSupabaseClient = {
  from: jest.fn(),
}

describe('Report Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient)
  })

  describe('validateReportOwnership', () => {
    it('should return valid for matching user and report', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'report-123', user_id: 'user-456' },
          error: null,
        }),
      })

      const result = await validateReportOwnership('report-123', 'user-456')

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return invalid for mismatched user', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      })

      const result = await validateReportOwnership('report-123', 'wrong-user')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Report not found or access denied')
      expect(result.errorCode).toBe('UNAUTHORIZED')
    })

    it('should return invalid when report not found', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'No rows returned' },
        }),
      })

      const result = await validateReportOwnership('nonexistent-report', 'user-456')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('UNAUTHORIZED')
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const result = await validateReportOwnership('report-123', 'user-456')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('VALIDATION_ERROR')
    })
  })

  describe('validatePaymentStatus', () => {
    const originalEnv = process.env.DISABLE_PAYMENT_CHECK

    afterEach(() => {
      process.env.DISABLE_PAYMENT_CHECK = originalEnv
    })

    it('should return valid when payment exists (LemonSqueezy)', async () => {
      process.env.DISABLE_PAYMENT_CHECK = 'false'

      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            stripe_payment_id: null,
            lemon_squeezy_payment_id: 'ls-order-123',
            price_paid: 49.00,
          },
          error: null,
        }),
      })

      const result = await validatePaymentStatus('report-123')

      expect(result.valid).toBe(true)
    })

    it('should return valid when payment exists (Stripe legacy)', async () => {
      process.env.DISABLE_PAYMENT_CHECK = 'false'

      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            stripe_payment_id: 'pi_123456',
            lemon_squeezy_payment_id: null,
            price_paid: 29.00,
          },
          error: null,
        }),
      })

      const result = await validatePaymentStatus('report-123')

      expect(result.valid).toBe(true)
    })

    it('should return invalid when no payment exists', async () => {
      process.env.DISABLE_PAYMENT_CHECK = 'false'

      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            stripe_payment_id: null,
            lemon_squeezy_payment_id: null,
            price_paid: null,
          },
          error: null,
        }),
      })

      const result = await validatePaymentStatus('report-123')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Payment not confirmed')
      expect(result.errorCode).toBe('PAYMENT_REQUIRED')
    })

    it('should bypass validation when DISABLE_PAYMENT_CHECK=true', async () => {
      process.env.DISABLE_PAYMENT_CHECK = 'true'

      // Should not call database at all
      const result = await validatePaymentStatus('report-123')

      expect(result.valid).toBe(true)
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    it('should return invalid when report not found', async () => {
      process.env.DISABLE_PAYMENT_CHECK = 'false'

      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      })

      const result = await validatePaymentStatus('nonexistent-report')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('NOT_FOUND')
    })
  })

  describe('validateReportData', () => {
    it('should return valid for correct report data', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            vin: '1HGBH41JXMN109186',
            mileage: 35000,
            zip_code: '10001',
          },
          error: null,
        }),
      })

      const result = await validateReportData('report-123')

      expect(result.valid).toBe(true)
    })

    it('should return invalid for invalid VIN', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            vin: 'INVALID',
            mileage: 35000,
            zip_code: '10001',
          },
          error: null,
        }),
      })

      const result = await validateReportData('report-123')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid VIN')
    })

    it('should return invalid for negative mileage', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            vin: '1HGBH41JXMN109186',
            mileage: -1000,
            zip_code: '10001',
          },
          error: null,
        }),
      })

      const result = await validateReportData('report-123')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid mileage')
    })

    it('should return invalid for excessive mileage', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            vin: '1HGBH41JXMN109186',
            mileage: 1000000,
            zip_code: '10001',
          },
          error: null,
        }),
      })

      const result = await validateReportData('report-123')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid mileage')
    })

    it('should return invalid for invalid ZIP code', async () => {
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'report-123',
            vin: '1HGBH41JXMN109186',
            mileage: 35000,
            zip_code: 'INVALID',
          },
          error: null,
        }),
      })

      const result = await validateReportData('report-123')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid ZIP code')
    })
  })
})
