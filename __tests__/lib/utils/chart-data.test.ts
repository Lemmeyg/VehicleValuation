import {
  createPriceDistribution,
  findClosestBin,
  getBinColor,
  getScatterColor,
  getMileageExtent,
  getPriceExtent,
  generateTicks,
} from '@/lib/utils/chart-data'

describe('createPriceDistribution', () => {
  const listings = [
    { price: 10000 },
    { price: 12000 },
    { price: 15000 },
    { price: 18000 },
    { price: 20000 },
    { price: 22000 },
  ]

  it('returns 10 bins', () => {
    const bins = createPriceDistribution(listings, 12000, 20000)
    expect(bins).toHaveLength(10)
  })

  it('returns empty array for empty listings', () => {
    expect(createPriceDistribution([], 10000, 20000)).toHaveLength(0)
  })

  it('bin counts sum to total listings', () => {
    const bins = createPriceDistribution(listings, 12000, 20000)
    const total = bins.reduce((sum, b) => sum + b.count, 0)
    expect(total).toBe(listings.length)
  })

  it('each bin has a range label, count, and midpoint', () => {
    const bins = createPriceDistribution(listings, 12000, 20000)
    expect(bins[0]).toMatchObject({
      range: expect.stringContaining('$'),
      count: expect.any(Number),
      midpoint: expect.any(Number),
    })
  })
})

describe('findClosestBin', () => {
  it('returns the range label of the closest bin', () => {
    const bins = createPriceDistribution([{ price: 10000 }, { price: 20000 }], 10000, 20000)
    const result = findClosestBin(bins, 15000)
    expect(typeof result).toBe('string')
  })

  it('returns empty string for empty bins', () => {
    expect(findClosestBin([], 15000)).toBe('')
  })
})

describe('getBinColor', () => {
  it('returns emerald for bins within market range', () => {
    expect(getBinColor(15000, 15000, 12000, 20000)).toBe('#10b981')
  })

  it('returns slate for bins below market range', () => {
    expect(getBinColor(8000, 15000, 12000, 20000)).toBe('#94a3b8')
  })

  it('returns blue for bins above market range', () => {
    expect(getBinColor(25000, 15000, 12000, 20000)).toBe('#3b82f6')
  })

  it('treats boundary values as within range', () => {
    expect(getBinColor(12000, 15000, 12000, 20000)).toBe('#10b981')
    expect(getBinColor(20000, 15000, 12000, 20000)).toBe('#10b981')
  })
})

describe('getScatterColor', () => {
  it('returns orange for displayed comparables regardless of price', () => {
    expect(getScatterColor(8000, 15000, 12000, 20000, true)).toBe('#f97316')
    expect(getScatterColor(25000, 15000, 12000, 20000, true)).toBe('#f97316')
  })

  it('returns emerald when price is within range and not displayed', () => {
    expect(getScatterColor(15000, 15000, 12000, 20000, false)).toBe('#10b981')
  })

  it('returns slate when price is below range and not displayed', () => {
    expect(getScatterColor(8000, 15000, 12000, 20000, false)).toBe('#94a3b8')
  })

  it('returns blue when price is above range and not displayed', () => {
    expect(getScatterColor(25000, 15000, 12000, 20000, false)).toBe('#3b82f6')
  })
})

describe('getMileageExtent', () => {
  it('returns padded extent enclosing all values', () => {
    const [min, max] = getMileageExtent([{ mileage: 50000 }, { mileage: 100000 }])
    expect(min).toBeLessThan(50000)
    expect(max).toBeGreaterThan(100000)
    expect(min).toBeGreaterThanOrEqual(0)
  })

  it('returns default for empty data', () => {
    expect(getMileageExtent([])).toEqual([0, 100000])
  })
})

describe('getPriceExtent', () => {
  it('returns padded extent enclosing all values', () => {
    const [min, max] = getPriceExtent([{ price: 10000 }, { price: 20000 }])
    expect(min).toBeLessThan(10000)
    expect(max).toBeGreaterThan(20000)
  })

  it('returns default for empty data', () => {
    expect(getPriceExtent([])).toEqual([0, 50000])
  })
})

describe('generateTicks', () => {
  it('generates correct number of ticks', () => {
    expect(generateTicks(0, 100, 5)).toHaveLength(5)
  })

  it('first tick equals min and last tick equals max', () => {
    const ticks = generateTicks(10000, 50000, 5)
    expect(ticks[0]).toBe(10000)
    expect(ticks[4]).toBe(50000)
  })

  it('handles equal min and max', () => {
    expect(generateTicks(15000, 15000, 4)).toEqual([15000])
  })
})
