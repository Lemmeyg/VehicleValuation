/**
 * VIN (Vehicle Identification Number) Validation Utility
 *
 * Validates VIN format and checksum according to ISO 3779 and NHTSA standards.
 */

/**
 * VIN transliteration values for checksum calculation
 * Letters are mapped to numbers according to NHTSA standard
 */
const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
}

/**
 * Position weights for checksum calculation
 */
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

/**
 * Validate VIN format (basic check)
 *
 * @param vin - Vehicle Identification Number
 * @returns true if format is valid, false otherwise
 */
export function isValidVinFormat(vin: string): boolean {
  // VIN must be exactly 17 characters
  if (!vin || vin.length !== 17) {
    return false
  }

  // VIN must contain only alphanumeric characters
  // Excluding I, O, Q (easily confused with 1, 0)
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i
  if (!vinRegex.test(vin)) {
    return false
  }

  return true
}

/**
 * Calculate VIN check digit
 *
 * @param vin - Vehicle Identification Number
 * @returns calculated check digit (0-9 or 'X')
 */
function calculateCheckDigit(vin: string): string {
  const vinUpper = vin.toUpperCase()
  let sum = 0

  for (let i = 0; i < 17; i++) {
    const char = vinUpper[i]
    const value = VIN_TRANSLITERATION[char]

    if (value === undefined) {
      return '' // Invalid character
    }

    sum += value * VIN_WEIGHTS[i]
  }

  const remainder = sum % 11
  return remainder === 10 ? 'X' : remainder.toString()
}

/**
 * Validate VIN checksum (position 9)
 *
 * @param vin - Vehicle Identification Number
 * @returns true if checksum is valid, false otherwise
 */
export function isValidVinChecksum(vin: string): boolean {
  if (!isValidVinFormat(vin)) {
    return false
  }

  const checkDigit = calculateCheckDigit(vin)
  const providedCheckDigit = vin[8].toUpperCase()

  return checkDigit === providedCheckDigit
}

/**
 * Complete VIN validation (format + checksum)
 *
 * @param vin - Vehicle Identification Number
 * @returns true if VIN is valid, false otherwise
 */
export function isValidVin(vin: string): boolean {
  return isValidVinFormat(vin) && isValidVinChecksum(vin)
}

/**
 * Sanitize VIN input (remove spaces, convert to uppercase)
 *
 * @param vin - Raw VIN input
 * @returns sanitized VIN
 */
export function sanitizeVin(vin: string): string {
  return vin.replace(/\s+/g, '').toUpperCase()
}

/**
 * Get VIN validation error message
 *
 * @param vin - Vehicle Identification Number
 * @returns error message or null if valid
 */
export function getVinValidationError(vin: string): string | null {
  const sanitized = sanitizeVin(vin)

  if (!sanitized) {
    return 'VIN is required'
  }

  if (sanitized.length !== 17) {
    return 'VIN must be exactly 17 characters'
  }

  if (!isValidVinFormat(sanitized)) {
    return 'VIN contains invalid characters (I, O, Q not allowed)'
  }

  if (!isValidVinChecksum(sanitized)) {
    return 'Invalid VIN checksum - please verify the VIN'
  }

  return null
}

/**
 * Extract basic VIN information (without API calls)
 *
 * @param vin - Vehicle Identification Number
 * @returns basic VIN information
 */
export function extractVinInfo(vin: string) {
  const sanitized = sanitizeVin(vin)

  if (!isValidVinFormat(sanitized)) {
    return null
  }

  // Extract basic info from VIN structure
  const wmi = sanitized.substring(0, 3) // World Manufacturer Identifier
  const vds = sanitized.substring(3, 9) // Vehicle Descriptor Section
  const vis = sanitized.substring(9, 17) // Vehicle Identifier Section
  const modelYear = sanitized[9] // Model year character
  const plantCode = sanitized[10] // Assembly plant

  return {
    vin: sanitized,
    wmi,
    vds,
    vis,
    modelYear,
    plantCode,
    isValid: isValidVin(sanitized),
  }
}
