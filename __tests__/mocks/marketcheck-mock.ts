/**
 * MarketCheck API Mock
 *
 * Provides realistic mock data for MarketCheck API calls
 * CRITICAL: Prevents $0.09 cost per API call during tests
 */

import type { MarketCheckResult } from '@/lib/api/marketcheck-client'

export const mockMarketCheckSuccess: MarketCheckResult = {
  success: true,
  data: {
    predictedPrice: 25000,
    priceRange: {
      min: 22500,
      max: 27500,
    },
    confidence: 0.85,
    comparablesReturned: 15,
    totalComparablesFound: 150,
    comparables: [
      {
        id: 'comp-1',
        vin: '1HGBH41JXMN109186',
        year: 2021,
        make: 'Honda',
        model: 'Accord',
        trim: 'EX-L',
        price: 24500,
        mileage: 35000,
        distance: 15,
        source: 'dealer',
        listingDate: '2024-01-15',
      },
      {
        id: 'comp-2',
        vin: '1HGBH41JXMN109187',
        year: 2021,
        make: 'Honda',
        model: 'Accord',
        trim: 'EX',
        price: 23000,
        mileage: 42000,
        distance: 22,
        source: 'dealer',
        listingDate: '2024-01-10',
      },
      {
        id: 'comp-3',
        vin: '1HGBH41JXMN109188',
        year: 2020,
        make: 'Honda',
        model: 'Accord',
        trim: 'EX-L',
        price: 26000,
        mileage: 28000,
        distance: 18,
        source: 'dealer',
        listingDate: '2024-01-20',
      },
    ],
  },
}

export const mockMarketCheckError: MarketCheckResult = {
  success: false,
  error: 'MarketCheck API error: Invalid VIN',
}

export const mockMarketCheckNoComparables: MarketCheckResult = {
  success: true,
  data: {
    predictedPrice: 25000,
    priceRange: {
      min: 22500,
      max: 27500,
    },
    confidence: 0.5,
    comparablesReturned: 0,
    totalComparablesFound: 0,
    comparables: [],
  },
}

/**
 * Mock implementation of fetchMarketCheckData
 */
export function createMockMarketCheckClient() {
  return {
    fetchMarketCheckData: jest.fn().mockResolvedValue(mockMarketCheckSuccess),
  }
}
