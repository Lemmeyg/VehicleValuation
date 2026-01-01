'use client'

import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Label,
} from 'recharts'

interface MarketChartsProps {
  listings: Array<{
    price: number
    miles: number
    year?: number
    make?: string
    model?: string
    trim?: string
  }>
  displayedComparables?: Array<{
    price: number
    miles: number
    year?: number
    make?: string
    model?: string
    trim?: string
  }>
  estimatedValue: number
  lowRange: number
  highRange: number
  subjectVehicle: {
    mileage: number
    year?: number
    make?: string
    model?: string
  }
}

export function MarketCharts({ listings, displayedComparables, estimatedValue, lowRange, highRange, subjectVehicle }: MarketChartsProps) {
  // Prepare data for price distribution histogram
  const priceDistribution = createPriceDistribution(listings, lowRange, highRange)

  // Create a Set of displayed comparables for quick lookup
  const displayedSet = new Set(
    displayedComparables?.map(comp => `${comp.price}-${comp.miles}`) || []
  )

  // Prepare data for price vs mileage scatter plot
  const scatterData = listings.map((listing, idx) => {
    const key = `${listing.price}-${listing.miles}`
    return {
      mileage: listing.miles,
      price: listing.price,
      name: `${listing.year} ${listing.make} ${listing.model}`,
      index: idx,
      isSubject: false,
      isDisplayed: displayedSet.has(key),
    }
  })

  // Add subject vehicle as a separate data point
  const subjectVehicleData = {
    mileage: subjectVehicle.mileage,
    price: estimatedValue,
    name: `${subjectVehicle.year} ${subjectVehicle.make} ${subjectVehicle.model} (Your Vehicle)`,
    index: -1,
    isSubject: true,
  }

  // Calculate axis ranges for scatter plot with padding (include subject vehicle)
  const allScatterData = [...scatterData, subjectVehicleData]
  const mileageExtent = getMileageExtent(allScatterData)
  const priceExtent = getPriceExtent(allScatterData)

  // Calculate average mileage for reference line
  const averageMileage = scatterData.reduce((sum, d) => sum + d.mileage, 0) / scatterData.length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Price Distribution Histogram */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Price Distribution
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Distribution of {listings.length} comparable vehicle prices
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={priceDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{
                value: 'Price Range',
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 13, fill: '#475569' },
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              label={{
                value: 'Number of Vehicles',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 13, fill: '#475569' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [`${value || 0} vehicles`, 'Count']}
            />
            <ReferenceLine
              x={findClosestBin(priceDistribution, estimatedValue)}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: 'Your Vehicle',
                position: 'top',
                fill: '#10b981',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {priceDistribution.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBinColor(entry.midpoint, estimatedValue, lowRange, highRange)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-slate-400"></div>
            <span className="text-slate-600">Below Market</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500"></div>
            <span className="text-slate-600">Market Range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-slate-600">Above Market</span>
          </div>
        </div>
      </div>

      {/* Price vs Mileage Scatter Plot */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Price vs. Mileage Analysis
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Relationship between mileage and pricing for comparable vehicles
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 30, right: 10, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              dataKey="mileage"
              domain={mileageExtent}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              label={{
                value: 'Mileage (miles)',
                position: 'insideBottom',
                offset: -10,
                style: { fontSize: 13, fill: '#475569' },
              }}
            />
            <YAxis
              type="number"
              dataKey="price"
              domain={priceExtent}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              label={{
                value: 'Price',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 13, fill: '#475569' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: 12,
              }}
              formatter={(value: number | undefined, name: string | undefined) => {
                const val = value || 0
                if (name === 'price') return [`$${val.toLocaleString()}`, 'Price']
                if (name === 'mileage') return [`${val.toLocaleString()} mi`, 'Mileage']
                return [val, name || '']
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.name || 'Vehicle'
                }
                return 'Vehicle'
              }}
            />
            {/* Reference line for average mileage */}
            <ReferenceLine
              x={averageMileage}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
            >
              <Label
                value={`Avg Mileage: ${(averageMileage / 1000).toFixed(0)}k mi`}
                position="top"
                fill="#10b981"
                fontSize={11}
                fontWeight={600}
              />
            </ReferenceLine>
            {/* Comparable vehicles scatter */}
            <Scatter data={scatterData} fill="#3b82f6">
              {scatterData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getScatterColor(entry.price, estimatedValue, lowRange, highRange, entry.isDisplayed)}
                />
              ))}
            </Scatter>
            {/* Subject vehicle - larger yellow dot */}
            <Scatter
              data={[subjectVehicleData]}
              fill="#fbbf24"
              shape="diamond"
            />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rotate-45 bg-amber-400"></div>
            <span className="text-slate-600">Your Vehicle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-slate-600">Market Comparables</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
            <span className="text-slate-600">Below Market</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">Market Range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-600">Above Market</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to create price distribution bins
function createPriceDistribution(
  listings: Array<{ price: number }>,
  lowRange: number,
  highRange: number
) {
  if (listings.length === 0) {
    return []
  }

  // Calculate bin width (divide range into 10 bins)
  const minPrice = Math.min(...listings.map(l => l.price), lowRange)
  const maxPrice = Math.max(...listings.map(l => l.price), highRange)
  const range = maxPrice - minPrice
  const binWidth = range / 10
  const bins: { range: string; count: number; midpoint: number }[] = []

  // Create bins
  for (let i = 0; i < 10; i++) {
    const binStart = minPrice + i * binWidth
    const binEnd = minPrice + (i + 1) * binWidth
    const count = listings.filter(l => l.price >= binStart && l.price < binEnd).length

    // Format range label
    const rangeLabel = `$${(binStart / 1000).toFixed(0)}-${(binEnd / 1000).toFixed(0)}k`

    bins.push({
      range: rangeLabel,
      count,
      midpoint: (binStart + binEnd) / 2,
    })
  }

  return bins
}

// Helper function to find the closest bin for a value
function findClosestBin(
  bins: Array<{ range: string; midpoint: number }>,
  value: number
): string {
  if (bins.length === 0) return ''

  let closestBin = bins[0]
  let minDiff = Math.abs(bins[0].midpoint - value)

  for (const bin of bins) {
    const diff = Math.abs(bin.midpoint - value)
    if (diff < minDiff) {
      minDiff = diff
      closestBin = bin
    }
  }

  return closestBin.range
}

// Helper function to determine bin color based on market range
function getBinColor(
  binMidpoint: number,
  estimatedValue: number,
  lowRange: number,
  highRange: number
): string {
  if (binMidpoint >= lowRange && binMidpoint <= highRange) {
    return '#10b981' // Emerald - within market range
  } else if (binMidpoint < lowRange) {
    return '#94a3b8' // Slate - below market
  } else {
    return '#3b82f6' // Blue - above market
  }
}

// Helper function to determine scatter point color
function getScatterColor(
  price: number,
  estimatedValue: number,
  lowRange: number,
  highRange: number,
  isDisplayed: boolean
): string {
  // Displayed comparables get a distinct orange color
  if (isDisplayed) {
    return '#f97316' // Orange - displayed in Market Comparables
  }

  if (price >= lowRange && price <= highRange) {
    return '#10b981' // Emerald - within market range
  } else if (price < lowRange) {
    return '#94a3b8' // Slate - below market
  } else {
    return '#3b82f6' // Blue - above market
  }
}

// Helper function to calculate mileage extent with padding
function getMileageExtent(data: Array<{ mileage: number }>): [number, number] {
  if (data.length === 0) return [0, 100000]

  const mileages = data.map(d => d.mileage)
  const min = Math.min(...mileages)
  const max = Math.max(...mileages)
  const padding = (max - min) * 0.1 // 10% padding

  return [Math.max(0, min - padding), max + padding]
}

// Helper function to calculate price extent with padding
function getPriceExtent(data: Array<{ price: number }>): [number, number] {
  if (data.length === 0) return [0, 50000]

  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const padding = (max - min) * 0.1 // 10% padding

  return [Math.max(0, min - padding), max + padding]
}
