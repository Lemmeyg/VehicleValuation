/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { rankByBestMatch, type RankSubject } from '@/lib/utils/comparables-ranker'

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
const subject: RankSubject = {
  year: 2020,
  mileage: 100000,
  zip: '89503',
  model: 'Highlander',
  trim: 'XLE',
}

describe('rankByBestMatch', () => {
  it('orders by weighted relevance score, closest overall match first', () => {
    const listings = [
      makeListing({ vin: 'FAR', miles: 175000, location: { zip: '33101' }, dos_active: 200 }),
      makeListing({
        vin: 'NEAR',
        miles: 101000,
        location: { zip: '89502' },
        dos_active: 10,
        trim: 'XLE',
      }),
    ]
    expect(rankByBestMatch(listings, subject, 20000)[0].vin).toBe('NEAR')
  })

  it('does not mutate the input array', () => {
    const input = [
      makeListing({ vin: 'A', miles: 175000 }),
      makeListing({ vin: 'B', miles: 100000 }),
    ]
    const snapshot = input.map(l => l.vin)
    rankByBestMatch(input, subject, 20000)
    expect(input.map(l => l.vin)).toEqual(snapshot)
  })
})
