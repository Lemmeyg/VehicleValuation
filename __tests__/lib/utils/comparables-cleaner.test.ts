/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { cleanAndFilterComparables } from '@/lib/utils/comparables-cleaner'

function makeListing(overrides: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    vin: `VIN${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
    year: 2020,
    make: 'Mazda',
    model: 'CX-5',
    miles: 55000,
    price: 18000,
    source: 'marketcheck',
    ...overrides,
  }
}

describe('cleanAndFilterComparables', () => {
  describe('0-mile filter', () => {
    it('removes listings with miles === 0', () => {
      const listings = [makeListing({ miles: 0 }), makeListing({ miles: 50000 })]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(1)
      expect(result[0].miles).toBe(50000)
    })

    it('removes listings with missing miles field', () => {
      const listings = [
        makeListing({ miles: undefined as unknown as number }),
        makeListing({ miles: 30000 }),
      ]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(1)
    })
  })

  describe('zero-price filter', () => {
    it('removes listings with price === 0', () => {
      const listings = [makeListing({ price: 0 }), makeListing({ price: 17000 })]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(1)
      expect(result[0].price).toBe(17000)
    })

    it('removes listings with missing price field', () => {
      const listings = [
        makeListing({ price: undefined as unknown as number }),
        makeListing({ price: 19000 }),
      ]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(1)
    })
  })

  describe('duplicate VIN filter', () => {
    it('keeps only the first occurrence of a duplicate VIN', () => {
      const vin = 'JM3KFBBM4L0818961'
      const listings = [
        makeListing({ vin, price: 18000 }),
        makeListing({ vin, price: 19000 }),
        makeListing({ price: 20000 }), // different VIN
      ]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(2)
      expect(result[0].price).toBe(18000)
    })

    it('keeps listings with no VIN (cannot deduplicate)', () => {
      const listings = [
        makeListing({ vin: undefined }),
        makeListing({ vin: undefined }),
      ]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(2)
    })
  })

  describe('year range filter', () => {
    it('drops listings newer than subjectYear + 2', () => {
      const listings = [
        makeListing({ year: 2023 }), // 2020 + 2 = 2022, so 2023 is out
        makeListing({ year: 2022 }), // exactly at ceiling — kept
        makeListing({ year: 2020 }),
      ]
      const result = cleanAndFilterComparables(listings, 2020)
      expect(result).toHaveLength(2)
      expect(result.map(l => l.year)).toEqual(expect.not.arrayContaining([2023]))
    })

    it('drops listings older than subjectYear - 5', () => {
      const listings = [
        makeListing({ year: 2014 }), // 2020 - 5 = 2015, so 2014 is out
        makeListing({ year: 2015 }), // exactly at floor — kept
        makeListing({ year: 2020 }),
      ]
      const result = cleanAndFilterComparables(listings, 2020)
      expect(result).toHaveLength(2)
      expect(result.map(l => l.year)).toEqual(expect.not.arrayContaining([2014]))
    })

    it('skips year filtering when subjectYear is not provided', () => {
      const listings = [
        makeListing({ year: 2026 }),
        makeListing({ year: 2010 }),
        makeListing({ year: 2020 }),
      ]
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(3)
    })

    it('replicates the bug scenario: 2026 new cars dropped for 2020 subject', () => {
      const listings = Array.from({ length: 10 }, () =>
        makeListing({ year: 2026, miles: 0, price: 42000 })
      )
      const result = cleanAndFilterComparables(listings, 2020)
      // Both 0-mile AND year filters fire — should drop all
      expect(result).toHaveLength(0)
    })
  })

  describe('dealer cap', () => {
    it('allows at most 3 listings from the same dealer', () => {
      const listings = Array.from({ length: 5 }, (_, i) =>
        makeListing({ dealer_name: 'Heritage Mazda Towson', price: 18000 + i * 100 })
      )
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(3)
    })

    it('applies cap per dealer independently', () => {
      const dealerA = Array.from({ length: 4 }, () => makeListing({ dealer_name: 'Dealer A' }))
      const dealerB = Array.from({ length: 4 }, () => makeListing({ dealer_name: 'Dealer B' }))
      const result = cleanAndFilterComparables([...dealerA, ...dealerB])
      expect(result).toHaveLength(6) // 3 from A + 3 from B
    })

    it('keeps listings with no dealer info regardless of count', () => {
      const listings = Array.from({ length: 5 }, () =>
        makeListing({ dealer_name: undefined, dealer_id: undefined })
      )
      const result = cleanAndFilterComparables(listings)
      expect(result).toHaveLength(5)
    })
  })

  describe('empty and trivial inputs', () => {
    it('returns empty array for empty input', () => {
      expect(cleanAndFilterComparables([])).toEqual([])
    })

    it('returns listings unchanged when all pass every filter', () => {
      const listings = [makeListing(), makeListing(), makeListing()]
      const result = cleanAndFilterComparables(listings, 2020)
      expect(result).toHaveLength(3)
    })
  })
})
