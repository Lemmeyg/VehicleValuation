/**
 * @jest-environment node
 */
import type { MarketCheckComparable } from '@/lib/api/marketcheck-client'
import { selectDisplayComparables, linkFailurePreference } from '@/lib/utils/comparables-ranker'

function makeListing(o: Partial<MarketCheckComparable> = {}): MarketCheckComparable {
  return {
    year: 2020,
    make: 'Toyota',
    model: 'Highlander',
    miles: 100000,
    price: 20000,
    source: 'marketcheck',
    url_validated: true,
    source_tier: 'franchise',
    location: { zip: '89503' },
    dos_active: 20,
    ...o,
  }
}
function valuation(listings: MarketCheckComparable[], predictedPrice = 20000) {
  return { predictedPrice, recentComparables: { num_found: listings.length, listings } }
}
const subject = { year: 2020, mileage: 100000, zip: '89503', model: 'Highlander', trim: 'XLE' }

/** A checked-failed comp: link check ran and did not return `valid`. */
function failed(
  vin: string,
  reason: NonNullable<MarketCheckComparable['url_check_result']> | undefined,
  o: Partial<MarketCheckComparable> = {}
): MarketCheckComparable {
  return makeListing({ vin, url_validated: false, url_check_result: reason, ...o })
}

describe('linkFailurePreference', () => {
  it('ranks bot-block failures (blocked / transient) first', () => {
    expect(linkFailurePreference('blocked')).toBe(0)
    expect(linkFailurePreference('transient')).toBe(0)
  })
  it('ranks a redirect in the middle', () => {
    expect(linkFailurePreference('redirected')).toBe(1)
  })
  it('ranks "page gone" (dead) last', () => {
    expect(linkFailurePreference('dead')).toBe(2)
  })
  it('treats a missing reason as middle priority (pre-Task-4 report)', () => {
    expect(linkFailurePreference(undefined)).toBe(1)
  })
})

describe('selectDisplayComparables — fill-to-limit back-fill', () => {
  it('a live pool >= limit returns exactly `limit` live comps and no failed-check comp', () => {
    const live = Array.from({ length: 12 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, miles: 100000 + i * 100 })
    )
    const dead = Array.from({ length: 5 }, (_, i) => failed(`D${i}`, 'blocked', { miles: 100000 }))
    const out = selectDisplayComparables(valuation([...live, ...dead]), subject, 10)
    expect(out.length).toBe(10)
    expect(out.every(l => l.url_validated === true)).toBe(true)
  })

  it('live 3 + failedCheck 20 -> returns 10 (3 live + 7 back-filled), not capped at 2', () => {
    const live = Array.from({ length: 3 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, miles: 100000 + i * 100 })
    )
    const dead = Array.from({ length: 20 }, (_, i) =>
      failed(`D${i}`, 'blocked', { miles: 100000 + i * 200 })
    )
    const out = selectDisplayComparables(valuation([...live, ...dead]), subject, 10)
    expect(out.length).toBe(10)
    expect(out.filter(l => l.url_validated === true).length).toBe(3)
    expect(out.filter(l => l.url_validated === false).length).toBe(7)
  })

  it('back-fill selection prefers failure reason over score: blocked/redirected beat a higher-scoring dead comp', () => {
    const live = Array.from({ length: 8 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, miles: 100000 + i * 1000 })
    )
    // need = 2. D has the best odometer match (highest score) but the worst reason.
    const B = failed('B', 'blocked', { miles: 115000 })
    const R = failed('R', 'redirected', { miles: 118000 })
    const D = failed('D', 'dead', { miles: 100000 })
    const out = selectDisplayComparables(valuation([...live, B, R, D]), subject, 10).map(l => l.vin)
    expect(out).toContain('B')
    expect(out).toContain('R')
    expect(out).not.toContain('D')
  })

  it('within one failure-reason group the back-fill takes the higher-scoring comps first', () => {
    const live = Array.from({ length: 8 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, miles: 100000 + i * 1000 })
    )
    // need = 2, three `blocked` candidates separated only by odometer.
    const hi = failed('BHI', 'blocked', { miles: 101000 })
    const mid = failed('BMID', 'blocked', { miles: 112000 })
    const lo = failed('BLO', 'blocked', { miles: 124000 })
    const out = selectDisplayComparables(valuation([...live, hi, mid, lo]), subject, 10).map(
      l => l.vin
    )
    expect(out).toContain('BHI')
    expect(out).toContain('BMID')
    expect(out).not.toContain('BLO')
  })

  it('a url_validated:false comp that fails a hard gate (price 0 / >±40%) is never back-filled', () => {
    const live = Array.from({ length: 3 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, miles: 100000 + i * 100 })
    )
    const price0 = failed('PRICE0', 'blocked', { price: 0 })
    const farPrice = failed('FARPRICE', 'blocked', { price: 40000 }) // >40% off 20000
    const out = selectDisplayComparables(valuation([...live, price0, farPrice]), subject, 10).map(
      l => l.vin
    )
    expect(out.sort()).toEqual(['LIVE0', 'LIVE1', 'LIVE2'])
    expect(out).not.toContain('PRICE0')
    expect(out).not.toContain('FARPRICE')
  })

  it('live 0 + failedCheck all "dead" still returns up to `limit` (dead is last-resort, never excluded)', () => {
    const dead = Array.from({ length: 15 }, (_, i) =>
      failed(`D${i}`, 'dead', { miles: 100000 + i * 300 })
    )
    const out = selectDisplayComparables(valuation(dead), subject, 10)
    expect(out.length).toBe(10)
    expect(out.every(l => l.url_validated === false)).toBe(true)
    expect(out.every(l => l.url_check_result === 'dead')).toBe(true)
  })

  it('a pre-Task-4 failed comp (url_validated:false, no url_check_result) is still back-filled', () => {
    const live = Array.from({ length: 3 }, (_, i) =>
      makeListing({ vin: `LIVE${i}`, miles: 100000 + i * 100 })
    )
    const legacy = Array.from({ length: 4 }, (_, i) =>
      failed(`LEG${i}`, undefined, { miles: 100000 + i * 200 })
    )
    const out = selectDisplayComparables(valuation([...live, ...legacy]), subject, 10)
    expect(out.length).toBe(7)
    expect(out.filter(l => l.url_validated === false).length).toBe(4)
  })
})
