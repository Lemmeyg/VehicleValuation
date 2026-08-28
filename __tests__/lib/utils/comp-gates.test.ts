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

describe('C1 — token-overlap model gate + safety valve', () => {
  it("keeps every comp when subject 'c-max energi' and comp 'c-max' share a token", () => {
    const cmax = { model: 'c-max energi' }
    const comps = [
      makeListing({ vin: 'A', model: 'c-max' }),
      makeListing({ vin: 'B', model: 'C-Max' }),
    ]
    expect(passesHardGates(comps[0], cmax, 20000)).toBe(true)
    expect(gateListings(comps, cmax, 20000).map(l => l.vin)).toEqual(['A', 'B'])
  })

  it("drops every comp when subject 'Highlander' and comp 'Camry' share no token", () => {
    const hl = { model: 'Highlander' }
    expect(passesHardGates(makeListing({ model: 'Camry' }), hl, 20000)).toBe(false)
    expect(passesHardGates(makeListing({ model: 'Sienna' }), hl, 20000)).toBe(false)
  })

  it('safety valve: a pure model-gate wipeout returns the non-model-gated comps and warns', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const hl = { model: 'Highlander' }
    const comps = [
      makeListing({ vin: 'X', model: 'Camry', price: 20000, miles: 90000 }),
      makeListing({ vin: 'Y', model: 'Sienna', price: 21000, miles: 95000 }),
    ]
    expect(gateListings(comps, hl, 20000).map(l => l.vin)).toEqual(['X', 'Y'])
    expect(warnSpy).toHaveBeenCalledWith(
      '[gateListings] model gate emptied the pool; keeping non-model-gated comps',
      expect.objectContaining({ subjectModel: 'Highlander' })
    )
    warnSpy.mockRestore()
  })

  it('safety valve does NOT rescue a wipeout with a non-model failure (price band) as well', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const hl = { model: 'Highlander' }
    const comps = [
      makeListing({ vin: 'X', model: 'Camry', price: 100000 }),
      makeListing({ vin: 'Y', model: 'Sienna', price: 120000 }),
    ]
    expect(gateListings(comps, hl, 20000)).toEqual([])
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
