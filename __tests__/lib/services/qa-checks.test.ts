import { QA_CHECKS, type QaCheckContext } from '@/lib/services/qa-checks'

function getCheck(key: string) {
  const check = QA_CHECKS.find(c => c.key === key)
  if (!check) throw new Error(`No check registered for key ${key}`)
  return check
}

const baseContext: QaCheckContext = {
  autodevVinData: null,
  vehicleDataYear: null,
  marketcheckData: null,
  subject: { year: 2021, mileage: 35000, zip: '90210', model: 'Accord', trim: undefined },
}

describe('vehicle_identified', () => {
  it('passes when autodevVinData is present', () => {
    const result = getCheck('vehicle_identified').run({
      ...baseContext,
      autodevVinData: { make: 'Honda' },
    })
    expect(result.passed).toBe(true)
  })

  it('passes when vehicleDataYear is set and autodevVinData is absent', () => {
    const result = getCheck('vehicle_identified').run({ ...baseContext, vehicleDataYear: 2019 })
    expect(result.passed).toBe(true)
  })

  it('fails when neither is present', () => {
    const result = getCheck('vehicle_identified').run(baseContext)
    expect(result.passed).toBe(false)
  })
})

describe('valuation_complete', () => {
  it('passes when predictedPrice > 0 and raw priceRange.min/max are both present', () => {
    const result = getCheck('valuation_complete').run({
      ...baseContext,
      marketcheckData: { predictedPrice: 25000, priceRange: { min: 22000, max: 28000 } } as never,
    })
    expect(result.passed).toBe(true)
  })

  it('fails when priceRange is missing even though predictedPrice > 0 (the ±10% fallback trap)', () => {
    const result = getCheck('valuation_complete').run({
      ...baseContext,
      marketcheckData: { predictedPrice: 25000 } as never,
    })
    expect(result.passed).toBe(false)
  })

  it('fails when predictedPrice is 0', () => {
    const result = getCheck('valuation_complete').run({
      ...baseContext,
      marketcheckData: { predictedPrice: 0, priceRange: { min: 0, max: 0 } } as never,
    })
    expect(result.passed).toBe(false)
  })
})

describe('ten_comps_displayed', () => {
  function makeListings(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      vin: `COMP${i}`,
      price: 25000,
      miles: 30000,
      url_validated: true,
      source_tier: 'primary',
    }))
  }

  it('fails with exactly 9 displayed comps', () => {
    const result = getCheck('ten_comps_displayed').run({
      ...baseContext,
      marketcheckData: {
        predictedPrice: 25000,
        recentComparables: { listings: makeListings(9) },
      } as never,
    })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain('9 displayed')
  })

  it('passes with exactly 10 displayed comps', () => {
    const result = getCheck('ten_comps_displayed').run({
      ...baseContext,
      marketcheckData: {
        predictedPrice: 25000,
        recentComparables: { listings: makeListings(10) },
      } as never,
    })
    expect(result.passed).toBe(true)
    expect(result.detail).toContain('10 displayed')
  })
})

describe('pdf_built', () => {
  it('passes when pdfResult.success is true', () => {
    const result = getCheck('pdf_built').run({ ...baseContext, pdfResult: { success: true } })
    expect(result.passed).toBe(true)
  })

  it('fails when pdfResult.success is false', () => {
    const result = getCheck('pdf_built').run({
      ...baseContext,
      pdfResult: { success: false, error: 'upload failed' },
    })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain('upload failed')
  })

  it('fails when pdfResult is absent', () => {
    const result = getCheck('pdf_built').run(baseContext)
    expect(result.passed).toBe(false)
  })
})
