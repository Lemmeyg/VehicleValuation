/**
 * Chart data calculation utilities
 * Shared between MarketCharts.tsx (browser) and lib/pdf/report-template.tsx (PDF)
 */

export interface PriceBin {
  range: string
  count: number
  midpoint: number
}

/**
 * Creates 10 price distribution bins from a list of listings.
 * Identical to the function previously in MarketCharts.tsx.
 */
export function createPriceDistribution(
  listings: Array<{ price: number }>,
  lowRange: number,
  highRange: number
): PriceBin[] {
  if (listings.length === 0) return []

  const minPrice = Math.min(...listings.map(l => l.price), lowRange)
  const maxPrice = Math.max(...listings.map(l => l.price), highRange)
  const range = maxPrice - minPrice
  const binWidth = range / 10
  const bins: PriceBin[] = []

  for (let i = 0; i < 10; i++) {
    const binStart = minPrice + i * binWidth
    const binEnd = minPrice + (i + 1) * binWidth
    const isLastBin = i === 9
    const count = listings.filter(
      l => l.price >= binStart && (isLastBin ? l.price <= binEnd : l.price < binEnd)
    ).length
    const rangeLabel = `$${(binStart / 1000).toFixed(0)}-${(binEnd / 1000).toFixed(0)}k`
    bins.push({ range: rangeLabel, count, midpoint: (binStart + binEnd) / 2 })
  }

  return bins
}

/**
 * Returns the range label of the bin whose midpoint is closest to the given value.
 */
export function findClosestBin(bins: PriceBin[], value: number): string {
  if (bins.length === 0) return ''
  let closest = bins[0]
  let minDiff = Math.abs(bins[0].midpoint - value)
  for (const bin of bins) {
    const diff = Math.abs(bin.midpoint - value)
    if (diff < minDiff) {
      minDiff = diff
      closest = bin
    }
  }
  return closest.range
}

/**
 * Returns the fill color for a price histogram bar.
 * Slate = below market, emerald = within range, blue = above market.
 */
export function getBinColor(
  binMidpoint: number,
  estimatedValue: number,
  lowRange: number,
  highRange: number
): string {
  if (binMidpoint >= lowRange && binMidpoint <= highRange) return '#10b981'
  if (binMidpoint < lowRange) return '#94a3b8'
  return '#3b82f6'
}

/**
 * Returns the fill color for a scatter plot dot.
 * Orange = currently displayed in comparables table.
 */
export function getScatterColor(
  price: number,
  estimatedValue: number,
  lowRange: number,
  highRange: number,
  isDisplayed: boolean
): string {
  if (isDisplayed) return '#f97316'
  if (price >= lowRange && price <= highRange) return '#10b981'
  if (price < lowRange) return '#94a3b8'
  return '#3b82f6'
}

/**
 * Returns [min, max] mileage extent with 10% padding on each side.
 */
export function getMileageExtent(data: Array<{ mileage: number }>): [number, number] {
  if (data.length === 0) return [0, 100000]
  const mileages = data.map(d => d.mileage)
  const min = Math.min(...mileages)
  const max = Math.max(...mileages)
  const padding = (max - min) * 0.1
  return [Math.max(0, min - padding), max + padding]
}

/**
 * Returns [min, max] price extent with 10% padding on each side.
 */
export function getPriceExtent(data: Array<{ price: number }>): [number, number] {
  if (data.length === 0) return [0, 50000]
  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const padding = (max - min) * 0.1
  return [Math.max(0, min - padding), max + padding]
}

/**
 * Generates `count` evenly-spaced tick values between min and max (inclusive).
 */
export function generateTicks(min: number, max: number, count: number): number[] {
  if (max === min) return [min]
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(min + i * step))
}
