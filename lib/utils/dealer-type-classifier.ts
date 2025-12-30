/**
 * Dealer Type Classifier
 *
 * Determines if a vehicle should be valued at a franchise or independent dealer
 * based on make and market positioning.
 *
 * Used for MarketCheck API price prediction to get accurate dealer-specific pricing.
 */

// Luxury and major brands typically sold at franchise dealers
const FRANCHISE_MAKES = new Set([
  // German Luxury
  'BMW',
  'MERCEDES-BENZ',
  'MERCEDES',
  'AUDI',
  'PORSCHE',
  'VOLKSWAGEN',
  'VW',
  // American Luxury
  'CADILLAC',
  'LINCOLN',
  'TESLA',
  // Japanese Luxury
  'LEXUS',
  'ACURA',
  'INFINITI',
  // Mass Market - Major Brands (primarily franchise)
  'HONDA',
  'TOYOTA',
  'FORD',
  'CHEVROLET',
  'CHEVY',
  'GMC',
  'NISSAN',
  'HYUNDAI',
  'KIA',
  'MAZDA',
  'SUBARU',
  'JEEP',
  'RAM',
  'DODGE',
  'CHRYSLER',
  // European Mass Market
  'VOLVO',
  'MINI',
  'LAND ROVER',
  'RANGE ROVER',
  'JAGUAR',
  // Other Major Brands
  'BUICK',
  'GENESIS',
  'MITSUBISHI',
])

// Discontinued brands more commonly sold at independent dealers
const INDEPENDENT_MAKES = new Set([
  'SATURN',
  'PONTIAC',
  'OLDSMOBILE',
  'PLYMOUTH',
  'MERCURY',
  'SAAB',
  'HUMMER',
  'SCION',
  'ISUZU',
  'SUZUKI',
  'DAEWOO',
  'GEO',
])

export type DealerType = 'franchise' | 'independent'

export interface DealerTypeResult {
  dealerType: DealerType
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

/**
 * Classify dealer type based on vehicle make and year
 *
 * @param make - Vehicle manufacturer (e.g., "Honda", "Ford")
 * @param year - Vehicle year (string or number)
 * @returns Classification result with confidence and reasoning
 *
 * @example
 * ```typescript
 * classifyDealerType('Honda', 2020)
 * // { dealerType: 'franchise', confidence: 'high', reasoning: 'Honda is a major brand...' }
 *
 * classifyDealerType('Saturn', 2008)
 * // { dealerType: 'independent', confidence: 'high', reasoning: 'Saturn is a discontinued brand...' }
 * ```
 */
export function classifyDealerType(make: string, year: string | number): DealerTypeResult {
  const normalizedMake = make.trim().toUpperCase()
  const vehicleYear = typeof year === 'string' ? parseInt(year) : year
  const currentYear = new Date().getFullYear()
  const vehicleAge = currentYear - vehicleYear

  // Rule 1: Known franchise brands
  if (FRANCHISE_MAKES.has(normalizedMake)) {
    return {
      dealerType: 'franchise',
      confidence: vehicleAge <= 10 ? 'high' : 'medium',
      reasoning: `${make} is a major brand typically sold at franchise dealers${
        vehicleAge > 10 ? ', though older models may also be found at independent dealers' : ''
      }`,
    }
  }

  // Rule 2: Discontinued brands → independent
  if (INDEPENDENT_MAKES.has(normalizedMake)) {
    return {
      dealerType: 'independent',
      confidence: 'high',
      reasoning: `${make} is a discontinued brand typically sold at independent dealers`,
    }
  }

  // Rule 3: Very old vehicles (>15 years) → independent
  if (vehicleAge > 15) {
    return {
      dealerType: 'independent',
      confidence: 'medium',
      reasoning: `Vehicle is ${vehicleAge} years old, typically sold at independent dealers`,
    }
  }

  // Rule 4: Default to franchise for recent vehicles
  if (vehicleAge <= 10) {
    return {
      dealerType: 'franchise',
      confidence: 'low',
      reasoning: 'Default classification for recent vehicle from recognized brand',
    }
  }

  // Rule 5: Fallback to independent for older unknowns
  return {
    dealerType: 'independent',
    confidence: 'low',
    reasoning: 'Default classification for older vehicle from less common brand',
  }
}

/**
 * Get human-readable label for dealer type
 *
 * @param dealerType - The dealer type
 * @returns Formatted label
 *
 * @example
 * ```typescript
 * getDealerTypeLabel('franchise') // "Franchise Dealer"
 * getDealerTypeLabel('independent') // "Independent Dealer"
 * ```
 */
export function getDealerTypeLabel(dealerType: DealerType): string {
  return dealerType === 'franchise' ? 'Franchise Dealer' : 'Independent Dealer'
}

/**
 * Get short label for dealer type (for UI badges)
 *
 * @param dealerType - The dealer type
 * @returns Short label
 */
export function getDealerTypeShortLabel(dealerType: DealerType): string {
  return dealerType === 'franchise' ? 'Franchise' : 'Independent'
}
