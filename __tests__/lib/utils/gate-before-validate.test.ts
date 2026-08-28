/**
 * @jest-environment node
 *
 * Locks the shared contract used by the three creation routes (Tasks 6–8):
 * hard gates run BEFORE URL validation, so a comp that fails a gate is never
 * HTTP-checked. global.fetch is the jest.fn from __tests__/setup.ts.
 */
import type { MarketCheckComparable, MarketCheckPrediction } from '@/lib/api/marketcheck-client'
import { gateListings } from '@/lib/utils/comp-gates'
import { validateListingUrls } from '@/lib/utils/url-validator'

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

describe('gate-before-validate contract', () => {
  it('never HTTP-checks a comp that fails a hard gate', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      url: 'https://dealer.example.com/inventory/final-12345',
    })

    const good = makeListing({
      vin: 'GOOD',
      price: 20000, // on the predicted price → passes the ±40% band
      vdp_url: 'https://dealer.example.com/inventory/good',
    })
    const gateFailer = makeListing({
      vin: 'BAD',
      price: 100000, // 5x the predicted price → fails the ±40% band
      vdp_url: 'https://dealer.example.com/inventory/bad',
    })

    const gated = gateListings([good, gateFailer], 20000)
    expect(gated.map(l => l.vin)).toEqual(['GOOD'])

    const prediction = {
      recentComparables: { num_found: gated.length, listings: gated },
    } as unknown as MarketCheckPrediction

    await validateListingUrls(prediction)

    const checkedUrls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]))
    expect(checkedUrls).not.toContain('https://dealer.example.com/inventory/bad')
    expect(checkedUrls).toContain('https://dealer.example.com/inventory/good')
  })
})
