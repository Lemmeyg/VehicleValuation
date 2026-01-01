/**
 * Listing Filter Utilities
 *
 * Provides flexible filtering strategies for MarketCheck comparable listings.
 * All listings are stored in the database - filtering happens on display.
 */

import { MarketCheckComparable } from '@/lib/api/marketcheck-client'

export type FilterStrategy =
  | 'top_price'           // Top 10 by price (highest first)
  | 'closest_price'       // Closest to predicted price
  | 'closest_mileage'     // Closest to target mileage
  | 'lowest_mileage'      // Lowest mileage first
  | 'closest_distance'    // Closest geographic distance
  | 'newest_listings'     // Most recently listed
  | 'fastest_selling'     // Lowest days on market
  | 'dealer_type'         // Filter by dealer type (franchise/independent)
  | 'price_range'         // Within specific price range
  | 'mileage_range'       // Within specific mileage range

export interface FilterOptions {
  strategy: FilterStrategy
  limit?: number // Default: 10

  // Strategy-specific options
  targetPrice?: number     // For 'closest_price'
  targetMileage?: number   // For 'closest_mileage'
  dealerType?: 'franchise' | 'independent' // For 'dealer_type'
  minPrice?: number        // For 'price_range'
  maxPrice?: number        // For 'price_range'
  minMiles?: number        // For 'mileage_range'
  maxMiles?: number        // For 'mileage_range'
}

/**
 * Filter and sort listings based on strategy
 */
export function filterListings(
  listings: MarketCheckComparable[],
  options: FilterOptions
): MarketCheckComparable[] {
  if (!listings || listings.length === 0) return []

  const limit = options.limit ?? 10
  let filtered = [...listings]

  // Apply pre-filters based on strategy options
  if (options.dealerType) {
    filtered = filtered.filter(l => l.dealer_type === options.dealerType)
  }

  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    filtered = filtered.filter(l => {
      if (options.minPrice !== undefined && l.price < options.minPrice) return false
      if (options.maxPrice !== undefined && l.price > options.maxPrice) return false
      return true
    })
  }

  if (options.minMiles !== undefined || options.maxMiles !== undefined) {
    filtered = filtered.filter(l => {
      if (options.minMiles !== undefined && l.miles < options.minMiles) return false
      if (options.maxMiles !== undefined && l.miles > options.maxMiles) return false
      return true
    })
  }

  // Apply sorting strategy
  switch (options.strategy) {
    case 'top_price':
      filtered.sort((a, b) => b.price - a.price)
      break

    case 'closest_price':
      if (!options.targetPrice) {
        console.warn('closest_price strategy requires targetPrice option')
        return filtered.slice(0, limit)
      }
      filtered.sort((a, b) => {
        const diffA = Math.abs(a.price - options.targetPrice!)
        const diffB = Math.abs(b.price - options.targetPrice!)
        return diffA - diffB
      })
      break

    case 'closest_mileage':
      if (!options.targetMileage) {
        console.warn('closest_mileage strategy requires targetMileage option')
        return filtered.slice(0, limit)
      }
      filtered.sort((a, b) => {
        const diffA = Math.abs(a.miles - options.targetMileage!)
        const diffB = Math.abs(b.miles - options.targetMileage!)
        return diffA - diffB
      })
      break

    case 'lowest_mileage':
      filtered.sort((a, b) => a.miles - b.miles)
      break

    case 'closest_distance':
      filtered = filtered.filter(l => l.location?.distance_miles !== undefined)
      filtered.sort((a, b) => {
        const distA = a.location?.distance_miles ?? Infinity
        const distB = b.location?.distance_miles ?? Infinity
        return distA - distB
      })
      break

    case 'newest_listings':
      filtered = filtered.filter(l => l.listing_date !== undefined)
      filtered.sort((a, b) => {
        const dateA = new Date(a.listing_date!).getTime()
        const dateB = new Date(b.listing_date!).getTime()
        return dateB - dateA // Newest first
      })
      break

    case 'fastest_selling':
      filtered = filtered.filter(l => l.dos_active !== undefined || l.dom !== undefined)
      filtered.sort((a, b) => {
        const daysA = a.dos_active ?? a.dom ?? Infinity
        const daysB = b.dos_active ?? b.dom ?? Infinity
        return daysA - daysB // Lowest days first
      })
      break

    case 'dealer_type':
      // Already filtered above, just sort by price
      filtered.sort((a, b) => b.price - a.price)
      break

    case 'price_range':
      // Already filtered above, just sort by price
      filtered.sort((a, b) => b.price - a.price)
      break

    case 'mileage_range':
      // Already filtered above, sort by mileage
      filtered.sort((a, b) => a.miles - b.miles)
      break

    default:
      console.warn(`Unknown filter strategy: ${options.strategy}`)
  }

  return filtered.slice(0, limit)
}

/**
 * Get top N listings by price (default strategy)
 */
export function getTopListings(
  listings: MarketCheckComparable[],
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, { strategy: 'top_price', limit })
}

/**
 * Get listings closest to a target price
 */
export function getClosestPriceListings(
  listings: MarketCheckComparable[],
  targetPrice: number,
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, {
    strategy: 'closest_price',
    targetPrice,
    limit
  })
}

/**
 * Get listings closest to a target mileage
 */
export function getClosestMileageListings(
  listings: MarketCheckComparable[],
  targetMileage: number,
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, {
    strategy: 'closest_mileage',
    targetMileage,
    limit
  })
}

/**
 * Get listings with lowest mileage
 */
export function getLowestMileageListings(
  listings: MarketCheckComparable[],
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, { strategy: 'lowest_mileage', limit })
}

/**
 * Get franchise dealer listings only
 */
export function getFranchiseListings(
  listings: MarketCheckComparable[],
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, {
    strategy: 'dealer_type',
    dealerType: 'franchise',
    limit
  })
}

/**
 * Get independent dealer listings only
 */
export function getIndependentListings(
  listings: MarketCheckComparable[],
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, {
    strategy: 'dealer_type',
    dealerType: 'independent',
    limit
  })
}

/**
 * Get listings within a price range
 */
export function getListingsInPriceRange(
  listings: MarketCheckComparable[],
  minPrice: number,
  maxPrice: number,
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, {
    strategy: 'price_range',
    minPrice,
    maxPrice,
    limit
  })
}

/**
 * Get listings geographically closest to subject vehicle
 */
export function getClosestListings(
  listings: MarketCheckComparable[],
  limit: number = 10
): MarketCheckComparable[] {
  return filterListings(listings, { strategy: 'closest_distance', limit })
}

/**
 * Get statistics about all listings (before filtering)
 */
export function getListingsStats(listings: MarketCheckComparable[]) {
  if (!listings || listings.length === 0) {
    return {
      total: 0,
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgMiles: 0,
      minMiles: 0,
      maxMiles: 0,
      franchiseCount: 0,
      independentCount: 0,
    }
  }

  const prices = listings.map(l => l.price).filter(p => p > 0)
  const miles = listings.map(l => l.miles).filter(m => m > 0)

  return {
    total: listings.length,
    avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgMiles: miles.reduce((a, b) => a + b, 0) / miles.length,
    minMiles: Math.min(...miles),
    maxMiles: Math.max(...miles),
    franchiseCount: listings.filter(l => l.dealer_type === 'franchise').length,
    independentCount: listings.filter(l => l.dealer_type === 'independent').length,
  }
}
