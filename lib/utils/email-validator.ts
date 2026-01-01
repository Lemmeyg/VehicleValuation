/**
 * Email Validation Utilities
 *
 * Provides email validation and sanitization functions
 */

/**
 * Email validation regex
 * - Requires @ symbol
 * - Requires at least one character before @
 * - Requires at least one character after @
 * - Requires at least one dot after @
 * - Requires at least one character after final dot
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Check if email format is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  const sanitized = sanitizeEmail(email)
  return EMAIL_REGEX.test(sanitized)
}

/**
 * Sanitize email by trimming whitespace and converting to lowercase
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return ''
  }

  return email.trim().toLowerCase()
}

/**
 * Validate email and return error message if invalid
 *
 * @returns null if valid, error message string if invalid
 */
export function getEmailValidationError(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Email is required'
  }

  const sanitized = sanitizeEmail(email)

  if (!sanitized) {
    return 'Email is required'
  }

  if (sanitized.length < 3) {
    return 'Email is too short'
  }

  if (sanitized.length > 254) {
    // RFC 5321 max email length
    return 'Email is too long (max 254 characters)'
  }

  if (!isValidEmail(email)) {
    return 'Invalid email format'
  }

  return null
}

/**
 * Validate and sanitize email, throwing error if invalid
 *
 * @throws Error if email is invalid
 * @returns Sanitized email
 */
export function requireValidEmail(email: string): string {
  const error = getEmailValidationError(email)
  if (error) {
    throw new Error(error)
  }

  return sanitizeEmail(email)
}
