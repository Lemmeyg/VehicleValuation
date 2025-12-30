# Listing Filtering Quick Reference

Quick copy-paste examples for common filtering scenarios.

## Basic Usage

### Get All Listings
```typescript
const allListings = marketCheck?.recentComparables?.listings || []
console.log(`Total listings available: ${allListings.length}`)
```

### Top 10 by Price (Default)
```typescript
import { getTopListings } from '@/lib/utils/listing-filters'

const top10 = getTopListings(allListings, 10)
```

### Get Statistics
```typescript
import { getListingsStats } from '@/lib/utils/listing-filters'

const stats = getListingsStats(allListings)
console.log(`Average price: $${stats.avgPrice.toLocaleString()}`)
console.log(`Price range: $${stats.minPrice} - $${stats.maxPrice}`)
console.log(`Franchise dealers: ${stats.franchiseCount}`)
```

## Filter by Price

### Closest to Predicted Price
```typescript
import { getClosestPriceListings } from '@/lib/utils/listing-filters'

const predictedPrice = 27500
const closest = getClosestPriceListings(allListings, predictedPrice, 10)
```

### Within Price Range
```typescript
import { getListingsInPriceRange } from '@/lib/utils/listing-filters'

const affordable = getListingsInPriceRange(allListings, 20000, 30000, 15)
```

### Budget-Friendly (Bottom 10 by Price)
```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const cheapest = filterListings(allListings, {
  strategy: 'top_price',
  limit: 10
}).reverse() // Reverse to get lowest first
```

## Filter by Condition

### Lowest Mileage
```typescript
import { getLowestMileageListings } from '@/lib/utils/listing-filters'

const lowMileage = getLowestMileageListings(allListings, 10)
```

### Within Mileage Range
```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const midMileage = filterListings(allListings, {
  strategy: 'mileage_range',
  minMiles: 30000,
  maxMiles: 60000,
  limit: 10
})
```

## Filter by Dealer Type

### Franchise Dealers Only
```typescript
import { getFranchiseListings } from '@/lib/utils/listing-filters'

const franchise = getFranchiseListings(allListings, 10)
```

### Independent Dealers Only
```typescript
import { getIndependentListings } from '@/lib/utils/listing-filters'

const independent = getIndependentListings(allListings, 10)
```

## Filter by Location

### Closest to Subject Vehicle
```typescript
import { getClosestListings } from '@/lib/utils/listing-filters'

const nearest = getClosestListings(allListings, 10)
```

### Within Specific Distance (Custom)
```typescript
const withinRadius = allListings
  .filter(l => (l.location?.distance_miles ?? Infinity) <= 50)
  .slice(0, 10)
```

## Filter by Market Dynamics

### Newest Listings
```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const newest = filterListings(allListings, {
  strategy: 'newest_listings',
  limit: 10
})
```

### Fastest Selling (Low Days on Market)
```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const hotListings = filterListings(allListings, {
  strategy: 'fastest_selling',
  limit: 10
})
```

## Combined Filters

### Franchise + Price Range + Low Mileage
```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const premium = filterListings(allListings, {
  strategy: 'lowest_mileage',
  dealerType: 'franchise',
  minPrice: 25000,
  maxPrice: 35000,
  limit: 10
})
```

### Independent + Budget + High Mileage OK
```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const budget = filterListings(allListings, {
  strategy: 'price_range',
  dealerType: 'independent',
  maxPrice: 20000,
  limit: 10
})
```

## Display Patterns

### Show Count + Filter
```typescript
<div>
  <h2>Market Comparables</h2>
  <p>Showing top {displayedListings.length} of {allListings.length} listings</p>
  <ComparablesTable listings={displayedListings} />
</div>
```

### Show Stats + Filter
```typescript
const stats = getListingsStats(allListings)

<div>
  <h2>Market Comparables ({allListings.length} total)</h2>
  <p>
    Avg: {formatCurrency(stats.avgPrice)} •
    Range: {formatCurrency(stats.minPrice)} - {formatCurrency(stats.maxPrice)}
  </p>
  <ComparablesTable listings={displayedListings} />
</div>
```

### Multiple Views
```typescript
const topPrice = getTopListings(allListings, 5)
const lowMileage = getLowestMileageListings(allListings, 5)

<div className="grid grid-cols-2 gap-4">
  <div>
    <h3>Highest Priced</h3>
    <ComparablesTable listings={topPrice} />
  </div>
  <div>
    <h3>Best Condition</h3>
    <ComparablesTable listings={lowMileage} />
  </div>
</div>
```

## React Component Example

### Simple Filter Selector
```typescript
'use client'

import { useState } from 'react'
import { filterListings, FilterStrategy } from '@/lib/utils/listing-filters'

export function ComparablesView({ allListings }) {
  const [strategy, setStrategy] = useState<FilterStrategy>('top_price')

  const filtered = filterListings(allListings, { strategy, limit: 10 })

  return (
    <div>
      <select value={strategy} onChange={e => setStrategy(e.target.value)}>
        <option value="top_price">Highest Price</option>
        <option value="lowest_mileage">Lowest Mileage</option>
        <option value="closest_distance">Nearest</option>
        <option value="newest_listings">Most Recent</option>
      </select>

      <p>Showing {filtered.length} of {allListings.length} listings</p>

      <table>
        {filtered.map(comp => (
          <tr key={comp.id}>
            <td>{comp.year} {comp.make} {comp.model}</td>
            <td>${comp.price.toLocaleString()}</td>
            <td>{comp.miles.toLocaleString()} mi</td>
          </tr>
        ))}
      </table>
    </div>
  )
}
```

### Advanced Filter Controls
```typescript
'use client'

import { useState } from 'react'
import { filterListings } from '@/lib/utils/listing-filters'

export function AdvancedFilter({ allListings }) {
  const [dealerType, setDealerType] = useState<'franchise' | 'independent' | undefined>()
  const [maxPrice, setMaxPrice] = useState<number | undefined>()
  const [maxMiles, setMaxMiles] = useState<number | undefined>()

  const filtered = filterListings(allListings, {
    strategy: 'top_price',
    dealerType,
    maxPrice,
    maxMiles,
    limit: 20
  })

  return (
    <div>
      <div className="filters">
        <select value={dealerType} onChange={e => setDealerType(e.target.value)}>
          <option value="">All Dealers</option>
          <option value="franchise">Franchise Only</option>
          <option value="independent">Independent Only</option>
        </select>

        <input
          type="number"
          placeholder="Max Price"
          value={maxPrice || ''}
          onChange={e => setMaxPrice(Number(e.target.value) || undefined)}
        />

        <input
          type="number"
          placeholder="Max Miles"
          value={maxMiles || ''}
          onChange={e => setMaxMiles(Number(e.target.value) || undefined)}
        />
      </div>

      <p>{filtered.length} listings match your criteria</p>

      <ComparablesTable listings={filtered} />
    </div>
  )
}
```

## Export Functions

### Export to CSV
```typescript
function exportToCSV(listings: MarketCheckComparable[]) {
  const csv = [
    ['Year', 'Make', 'Model', 'Trim', 'Price', 'Miles', 'Dealer', 'Location'],
    ...listings.map(l => [
      l.year,
      l.make,
      l.model,
      l.trim || '',
      l.price,
      l.miles,
      l.dealer_type || '',
      `${l.location?.city || ''}, ${l.location?.state || ''}`
    ])
  ].map(row => row.join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comparables_${Date.now()}.csv`
  a.click()
}

<button onClick={() => exportToCSV(allListings)}>
  Export All {allListings.length} Listings
</button>
```

### Export to JSON
```typescript
function exportToJSON(listings: MarketCheckComparable[]) {
  const json = JSON.stringify(listings, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comparables_${Date.now()}.json`
  a.click()
}
```

## Performance Tips

### Use Memoization
```typescript
import { useMemo } from 'react'

const filtered = useMemo(() => {
  return filterListings(allListings, { strategy, limit })
}, [allListings, strategy, limit])
```

### Pagination for Large Sets
```typescript
const [page, setPage] = useState(0)
const pageSize = 10

const allFiltered = filterListings(allListings, { strategy: 'top_price', limit: 50 })
const paginated = allFiltered.slice(page * pageSize, (page + 1) * pageSize)

<div>
  <ComparablesTable listings={paginated} />
  <button onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
  <button onClick={() => setPage(p => p + 1)}>Next</button>
</div>
```

---

**See Also**:
- [Full Filtering Guide](./LISTING_FILTERING_GUIDE.md)
- [MarketCheck Listings Fix](./MARKETCHECK_LISTINGS_FIX.md)
