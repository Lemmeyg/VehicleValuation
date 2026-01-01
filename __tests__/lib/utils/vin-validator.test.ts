/**
 * VIN Validator Unit Tests
 *
 * Tests VIN validation, checksum calculation, and sanitization
 */

import {
  isValidVinFormat,
  isValidVinChecksum,
  isValidVin,
  sanitizeVin,
  getVinValidationError,
  extractVinInfo,
} from '@/lib/utils/vin-validator'

describe('VIN Validator', () => {
  // Real valid VINs for testing
  const validVins = [
    '1HGBH41JXMN109186', // Honda Accord
    '1FTFW1ET5EKE51227', // Ford F-150
    '5YJSA1E26FF123456', // Tesla Model S
  ]

  const invalidVins = [
    '1HGBH41JXMN109187', // Invalid checksum (last digit changed)
    'INVALID123456789', // Too short
    '1HGBH41JXMN1091861', // Too long (18 chars)
    '1HGBH41IXMN109186', // Contains 'I' (not allowed)
    '1HGBH41OXMN109186', // Contains 'O' (not allowed)
    '1HGBH41QXMN109186', // Contains 'Q' (not allowed)
  ]

  describe('isValidVinFormat', () => {
    it('should accept valid VIN formats', () => {
      validVins.forEach(vin => {
        expect(isValidVinFormat(vin)).toBe(true)
      })
    })

    it('should reject VINs with wrong length', () => {
      expect(isValidVinFormat('1HGBH41JXMN10918')).toBe(false) // 16 chars
      expect(isValidVinFormat('1HGBH41JXMN1091861')).toBe(false) // 18 chars
      expect(isValidVinFormat('SHORT')).toBe(false)
      expect(isValidVinFormat('')).toBe(false)
    })

    it('should reject VINs with invalid characters', () => {
      expect(isValidVinFormat('1HGBH41IXMN109186')).toBe(false) // Contains 'I'
      expect(isValidVinFormat('1HGBH41OXMN109186')).toBe(false) // Contains 'O'
      expect(isValidVinFormat('1HGBH41QXMN109186')).toBe(false) // Contains 'Q'
      expect(isValidVinFormat('1HGBH41-XMN109186')).toBe(false) // Contains '-'
    })

    it('should be case-insensitive', () => {
      expect(isValidVinFormat('1hgbh41jxmn109186')).toBe(true)
      expect(isValidVinFormat('1HGBH41JXMN109186')).toBe(true)
    })
  })

  describe('isValidVinChecksum', () => {
    it('should accept VINs with valid checksum', () => {
      validVins.forEach(vin => {
        expect(isValidVinChecksum(vin)).toBe(true)
      })
    })

    it('should reject VINs with invalid checksum', () => {
      expect(isValidVinChecksum('1HGBH41JXMN109187')).toBe(false) // Last digit changed
      expect(isValidVinChecksum('1HGBH41JXMN109185')).toBe(false) // Last digit changed
    })

    it('should reject VINs with invalid format', () => {
      expect(isValidVinChecksum('SHORT')).toBe(false)
      expect(isValidVinChecksum('1HGBH41IXMN109186')).toBe(false) // Contains 'I'
    })

    it('should handle checksum value X', () => {
      // VINs with 'X' as check digit (when remainder is 10)
      const vinWithX = '1M8GDM9AXKP042788' // Example VIN with X as check digit
      expect(isValidVinChecksum(vinWithX)).toBe(true)
    })
  })

  describe('isValidVin', () => {
    it('should accept fully valid VINs', () => {
      validVins.forEach(vin => {
        expect(isValidVin(vin)).toBe(true)
      })
    })

    it('should reject invalid VINs', () => {
      invalidVins.forEach(vin => {
        expect(isValidVin(vin)).toBe(false)
      })
    })
  })

  describe('sanitizeVin', () => {
    it('should remove spaces', () => {
      expect(sanitizeVin('1HG BH41 JXMN 109186')).toBe('1HGBH41JXMN109186')
      expect(sanitizeVin('1HG BH41 JXMN 109186 ')).toBe('1HGBH41JXMN109186')
    })

    it('should convert to uppercase', () => {
      expect(sanitizeVin('1hgbh41jxmn109186')).toBe('1HGBH41JXMN109186')
      expect(sanitizeVin('1HgBh41JxMn109186')).toBe('1HGBH41JXMN109186')
    })

    it('should handle both space removal and uppercase conversion', () => {
      expect(sanitizeVin('1hg bh41 jxmn 109186')).toBe('1HGBH41JXMN109186')
    })

    it('should preserve valid VINs', () => {
      expect(sanitizeVin('1HGBH41JXMN109186')).toBe('1HGBH41JXMN109186')
    })
  })

  describe('getVinValidationError', () => {
    it('should return null for valid VINs', () => {
      validVins.forEach(vin => {
        expect(getVinValidationError(vin)).toBeNull()
      })
    })

    it('should return error for missing VIN', () => {
      expect(getVinValidationError('')).toBe('VIN is required')
    })

    it('should return error for wrong length', () => {
      expect(getVinValidationError('SHORT')).toBe('VIN must be exactly 17 characters')
      expect(getVinValidationError('1HGBH41JXMN10918')).toBe('VIN must be exactly 17 characters')
    })

    it('should return error for invalid characters', () => {
      expect(getVinValidationError('1HGBH41IXMN109186')).toBe('VIN contains invalid characters (I, O, Q not allowed)')
      expect(getVinValidationError('1HGBH41OXMN109186')).toBe('VIN contains invalid characters (I, O, Q not allowed)')
    })

    it('should return error for invalid checksum', () => {
      expect(getVinValidationError('1HGBH41JXMN109187')).toBe('Invalid VIN checksum - please verify the VIN')
    })

    it('should sanitize before validation', () => {
      // Should pass after sanitization
      expect(getVinValidationError('1hg bh41 jxmn 109186')).toBeNull()
    })
  })

  describe('extractVinInfo', () => {
    it('should extract VIN components', () => {
      const info = extractVinInfo('1HGBH41JXMN109186')

      expect(info).not.toBeNull()
      expect(info?.vin).toBe('1HGBH41JXMN109186')
      expect(info?.wmi).toBe('1HG') // Honda
      expect(info?.vds).toBe('BH41JX')
      expect(info?.vis).toBe('MN109186')
      expect(info?.modelYear).toBe('M') // 2021
      expect(info?.plantCode).toBe('N')
      expect(info?.isValid).toBe(true)
    })

    it('should return null for invalid VIN format', () => {
      expect(extractVinInfo('SHORT')).toBeNull()
      expect(extractVinInfo('1HGBH41IXMN109186')).toBeNull() // Contains 'I'
    })

    it('should sanitize VIN before extraction', () => {
      const info = extractVinInfo('1hg bh41 jxmn 109186')
      expect(info).not.toBeNull()
      expect(info?.vin).toBe('1HGBH41JXMN109186')
    })

    it('should mark invalid checksum VINs as not valid', () => {
      const info = extractVinInfo('1HGBH41JXMN109187') // Invalid checksum
      expect(info).not.toBeNull()
      expect(info?.isValid).toBe(false)
    })
  })
})
