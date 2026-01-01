/**
 * Report Security Validation Middleware
 *
 * Validates report data integrity before calling external APIs
 * Prevents parameter tampering and unauthorized access
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'
import { isValidVin, sanitizeVin } from '@/lib/utils/vin-validator'

export interface ValidationResult {
  valid: boolean
  error?: string
  errorCode?: string
}

/**
 * Validate report ownership and authentication
 */
export async function validateReportOwnership(
  reportId: string,
  userId: string
): Promise<ValidationResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: report, error } = await supabase
      .from('reports')
      .select('id, user_id')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single()

    if (error || !report) {
      return {
        valid: false,
        error: 'Report not found or access denied',
        errorCode: 'UNAUTHORIZED',
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Report ownership check failed:', error)
    return {
      valid: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate payment was successful before API calls
 *
 * In development mode (DISABLE_PAYMENT_CHECK=true), payment validation is skipped
 */
export async function validatePaymentStatus(reportId: string): Promise<ValidationResult> {
  // Development bypass: Skip payment check if environment variable is set
  const skipPaymentCheck = process.env.DISABLE_PAYMENT_CHECK === 'true'

  if (skipPaymentCheck) {
    console.log('[Validation] Payment check SKIPPED (development mode)')
    return { valid: true }
  }

  try {
    const supabase = await createServerSupabaseClient()

    const { data: report, error} = await supabase
      .from('reports')
      .select('id, stripe_payment_id, lemon_squeezy_payment_id, price_paid')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return {
        valid: false,
        error: 'Report not found',
        errorCode: 'NOT_FOUND',
      }
    }

    // Check for payment from either Stripe (legacy) or LemonSqueezy (current)
    const hasPayment = report.stripe_payment_id || report.lemon_squeezy_payment_id
    if (!hasPayment || !report.price_paid) {
      return {
        valid: false,
        error: 'Payment not confirmed',
        errorCode: 'PAYMENT_REQUIRED',
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Payment status check failed:', error)
    return {
      valid: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate report data integrity (no tampering)
 */
export async function validateReportData(reportId: string): Promise<
  ValidationResult & {
    data?: {
      vin: string
      mileage: number
      zip_code: string
    }
  }
> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: report, error } = await supabase
      .from('reports')
      .select('id, vin, mileage, zip_code')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return {
        valid: false,
        error: 'Report not found',
        errorCode: 'NOT_FOUND',
      }
    }

    // Validate VIN
    const sanitized = sanitizeVin(report.vin)
    if (!isValidVin(sanitized)) {
      return {
        valid: false,
        error: 'Invalid VIN format',
        errorCode: 'INVALID_VIN',
      }
    }

    // Validate mileage
    if (!report.mileage || report.mileage < 0 || report.mileage > 999999) {
      return {
        valid: false,
        error: 'Invalid mileage',
        errorCode: 'INVALID_MILEAGE',
      }
    }

    // Validate ZIP code
    if (!report.zip_code || !/^\d{5}$/.test(report.zip_code)) {
      return {
        valid: false,
        error: 'Invalid ZIP code',
        errorCode: 'INVALID_ZIP',
      }
    }

    return {
      valid: true,
      data: {
        vin: sanitized,
        mileage: report.mileage,
        zip_code: report.zip_code,
      },
    }
  } catch (error) {
    console.error('[Validation] Report data check failed:', error)
    return {
      valid: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Complete validation before MarketCheck API call
 *
 * Validates:
 * - User authentication
 * - Report ownership
 * - Payment confirmation
 * - Data integrity (VIN, mileage, ZIP)
 */
export async function validateBeforeMarketCheckCall(
  reportId: string,
  userId: string
): Promise<
  ValidationResult & {
    data?: {
      vin: string
      mileage: number
      zip_code: string
    }
  }
> {
  // 1. Validate ownership
  const ownershipCheck = await validateReportOwnership(reportId, userId)
  if (!ownershipCheck.valid) {
    return ownershipCheck
  }

  // 2. Validate payment
  const paymentCheck = await validatePaymentStatus(reportId)
  if (!paymentCheck.valid) {
    return paymentCheck
  }

  // 3. Validate data integrity
  const dataCheck = await validateReportData(reportId)
  if (!dataCheck.valid) {
    return dataCheck
  }

  return {
    valid: true,
    data: dataCheck.data,
  }
}
