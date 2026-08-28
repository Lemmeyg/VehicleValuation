/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { passesHardGates, gateListings } from '@/lib/utils/comp-gates'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 100000,
    price: 20000,
    source: 'marketcheck',
    ...o,
  }
}
const subject = { model: 'Highlander' }

describe('passesHardGates', () => {
  it('passes a clean comp', () => {
    expect(passesHardGates(makeListing(), subject, 20000)).toBe(true)
  })
  it('drops a different model', () => {
    expect(passesHardGates(makeListing({ model: 'Camry' }), subject, 20000)).toBe(false)
  })
  it('is case-insensitive on model', () => {
    expect(passesHardGates(makeListing({ model: 'HIGHLANDER' }), subject, 20000)).toBe(true)
  })
  it('keeps a comp when subject.model is unknown', () => {
    expect(passesHardGates(makeListing({ model: 'Camry' }), {}, 20000)).toBe(true)
  })
  it('drops zero / missing price', () => {
    expect(passesHardGates(makeListing({ price: 0 }), subject, 20000)).toBe(false)
    expect(
      passesHardGates(makeListing({ price: undefined as unknown as number }), subject, 20000)
    ).toBe(false)
  })
  it('drops missing mileage', () => {
    expect(
      passesHardGates(makeListing({ miles: undefined as unknown as number }), subject, 20000)
    ).toBe(false)
  })
  it('drops a price more than 40% from the predicted price', () => {
    expect(passesHardGates(makeListing({ price: 29000 }), subject, 20000)).toBe(false) // +45%
    expect(passesHardGates(makeListing({ price: 27000 }), subject, 20000)).toBe(true) // +35%
  })
  it('skips the price band when predictedPrice is absent', () => {
    expect(passesHardGates(makeListing({ price: 99000 }), subject, undefined)).toBe(true)
  })
})

describe('gateListings', () => {
  it('returns only the passing comps, order preserved', () => {
    const listings = [
      makeListing({ vin: 'OK1' }),
      makeListing({ vin: 'BADMODEL', model: 'Camry' }),
      makeListing({ vin: 'OK2' }),
      makeListing({ vin: 'BADPRICE', price: 100000 }),
    ]
    expect(gateListings(listings, subject, 20000).map(l => l.vin)).toEqual(['OK1', 'OK2'])
  })
})
