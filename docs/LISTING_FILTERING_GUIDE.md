# MarketCheck Listing Filtering System

## Overview

All MarketCheck comparable vehicle listings are now stored in the database without artificial limits. Filtering happens on the frontend/display layer, giving you complete flexibility to analyze and display listings in different ways.

## Architecture

### Data Flow

```
MarketCheck API Response
    ↓
Transform & Store ALL listings (no slice/limit)
    ↓
Store in database: reports.marketcheck_valuation JSONB
    ↓
Frontend: Apply filtering strategies
    ↓
Display filtered results (default: top 10 by price)
```

### Key Changes

1. **Backend (marketcheck-client.ts)**
   - ✅ Stores ALL recent comparable listings (no `.slice(0, 10)`)
   - ✅ Filters by model/trim match
   - ✅ Sorts by price descending
   - ❌ NO artificial limit on storage

2. **Frontend (report view page)**
   - ✅ Loads ALL listings from database
   - ✅ Applies filter strategy (default: top 10 by price)
   - ✅ Shows statistics from ALL listings
   - ✅ Displays filtered subset

3. **PDF Generation**
   - ✅ Uses same filtering logic
   - ✅ Shows "Top N of M" in title
   - ✅ Consistent with web view

## Filter Strategies

The system supports multiple filtering strategies via the `listing-filters.ts` utility module.

### Available Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `top_price` | Highest priced listings first | Default - show premium comparables |
| `closest_price` | Closest to predicted price | Find best market matches |
| `lowest_mileage` | Lowest mileage first | Show best condition vehicles |
| `closest_distance` | Geographically nearest | Local market analysis |
| `newest_listings` | Most recently listed | Current market trends |
| `fastest_selling` | Lowest days on market | Hot market indicators |
| `dealer_type` | Filter by franchise/independent | Dealer type analysis |
| `price_range` | Within specific price range | Custom price filtering |
| `mileage_range` | Within specific mileage range | Mileage-based filtering |

### Usage Examples

#### 1. Top 10 by Price (Default)

```typescript
import { getTopListings } from '@/lib/utils/listing-filters'

const allListings = marketCheck?.recentComparables?.listings || []
const top10 = getTopListings(allListings, 10)
```

#### 2. Closest to Predicted Price

```typescript
import { getClosestPriceListings } from '@/lib/utils/listing-filters'

const predictedPrice = 27500
const closestMatches = getClosestPriceListings(allListings, predictedPrice, 10)
```

#### 3. Franchise Dealers Only

```typescript
import { getFranchiseListings } from '@/lib/utils/listing-filters'

const franchiseOnly = getFranchiseListings(allListings, 10)
```

#### 4. Custom Filter Strategy

```typescript
import { filterListings } from '@/lib/utils/listing-filters'

const customFiltered = filterListings(allListings, {
  strategy: 'price_range',
  minPrice: 20000,
  maxPrice: 30000,
  limit: 15
})
```

#### 5. Multiple Filters Combined

```typescript
import { filterListings } from '@/lib/utils/listing-filters'

// Get franchise dealers within price range, sorted by mileage
const filtered = filterListings(allListings, {
  strategy: 'mileage_range',
  dealerType: 'franchise',
  minPrice: 20000,
  maxPrice: 30000,
  minMiles: 0,
  maxMiles: 50000,
  limit: 10
})
```

## Statistics

Get aggregate statistics from ALL listings (before filtering):

```typescript
import { getListingsStats } from '@/lib/utils/listing-filters'

const stats = getListingsStats(allListings)

console.log(stats)
// {
//   total: 42,
//   avgPrice: 25430,
//   minPrice: 18500,
//   maxPrice: 32100,
//   avgMiles: 45230,
//   minMiles: 12000,
//   maxMiles: 89000,
//   franchiseCount: 28,
//   independentCount: 14
// }
```

## Implementation Guide

### Step 1: Fetch ALL Listings

In your component/page:

```typescript
const vehicleData = report.vehicle_data as any
const marketCheck = report.marketcheck_valuation as any

// Get ALL listings (no filtering yet)
const allListings = marketCheck?.recentComparables?.listings || []
```

### Step 2: Apply Filter Strategy

```typescript
import { getTopListings, getListingsStats } from '@/lib/utils/listing-filters'

// Filter to desired subset
const displayedComparables = getTopListings(allListings, 10)

// Get statistics from ALL listings
const stats = getListingsStats(allListings)
```

### Step 3: Display Results

```typescript
return (
  <div>
    <h2>Market Comparables</h2>
    <p>Showing top {displayedComparables.length} of {allListings.length} listings</p>
    <p>
      Avg: ${stats.avgPrice.toLocaleString()} •
      Range: ${stats.minPrice.toLocaleString()} - ${stats.maxPrice.toLocaleString()}
    </p>

    <table>
      {displayedComparables.map(comp => (
        <tr key={comp.id}>
          <td>{comp.year} {comp.make} {comp.model}</td>
          <td>${comp.price.toLocaleString()}</td>
          <td>{comp.miles.toLocaleString()} mi</td>
        </tr>
      ))}
    </table>
  </div>
)
```

## Advanced Use Cases

### 1. Dynamic Filtering Based on User Input

Create a filter selector component:

```typescript
'use client'

import { useState } from 'react'
import { filterListings, FilterStrategy } from '@/lib/utils/listing-filters'

export function ComparablesFilter({ allListings }) {
  const [strategy, setStrategy] = useState<FilterStrategy>('top_price')
  const [limit, setLimit] = useState(10)

  const filtered = filterListings(allListings, { strategy, limit })

  return (
    <div>
      <select value={strategy} onChange={e => setStrategy(e.target.value as FilterStrategy)}>
        <option value="top_price">Highest Price</option>
        <option value="lowest_mileage">Lowest Mileage</option>
        <option value="closest_distance">Nearest Location</option>
        <option value="newest_listings">Most Recent</option>
      </select>

      <input
        type="number"
        value={limit}
        onChange={e => setLimit(Number(e.target.value))}
        min={1}
        max={50}
      />

      <ComparablesTable listings={filtered} />
    </div>
  )
}
```

### 2. Multiple Views of Same Data

Show different filtered views side-by-side:

```typescript
import {
  getTopListings,
  getLowestMileageListings,
  getFranchiseListings
} from '@/lib/utils/listing-filters'

const topPrice = getTopListings(allListings, 5)
const lowMileage = getLowestMileageListings(allListings, 5)
const franchise = getFranchiseListings(allListings, 5)

return (
  <div className="grid grid-cols-3 gap-4">
    <div>
      <h3>Highest Priced</h3>
      <ComparablesTable listings={topPrice} />
    </div>
    <div>
      <h3>Lowest Mileage</h3>
      <ComparablesTable listings={lowMileage} />
    </div>
    <div>
      <h3>Franchise Dealers</h3>
      <ComparablesTable listings={franchise} />
    </div>
  </div>
)
```

### 3. Export All Listings to CSV

```typescript
import { MarketCheckComparable } from '@/lib/api/marketcheck-client'

function exportToCSV(listings: MarketCheckComparable[]) {
  const headers = ['Year', 'Make', 'Model', 'Trim', 'Price', 'Miles', 'Dealer Type', 'Location']
  const rows = listings.map(l => [
    l.year,
    l.make,
    l.model,
    l.trim,
    l.price,
    l.miles,
    l.dealer_type,
    `${l.location?.city}, ${l.location?.state}`
  ])

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'comparables.csv'
  a.click()
}

// Usage
<button onClick={() => exportToCSV(allListings)}>
  Export All {allListings.length} Listings to CSV
</button>
```

## Database Storage

### JSONB Structure

```json
{
  "predictedPrice": 27367,
  "totalComparablesFound": 847,
  "recentComparables": {
    "num_found": 42,
    "listings": [
      {
        "id": "listing_123",
        "vin": "1HGCM82633A789012",
        "year": 2020,
        "make": "Honda",
        "model": "Civic",
        "trim": "EX",
        "miles": 38000,
        "price": 22800,
        "dealer_type": "franchise",
        "location": {
          "city": "Los Angeles",
          "state": "CA",
          "zip": "90025",
          "distance_miles": 5.2
        },
        "dom": 15,
        "dos_active": 12,
        "photo_url": "https://...",
        "vdp_url": "https://...",
        "listing_date": "2024-12-10",
        "dealer_name": "Honda Downtown",
        "source": "marketcheck"
      }
      // ... ALL 42 listings stored
    ],
    "stats": { /* statistics from recent comparables */ }
  },
  "comparablesStats": { /* statistics from ALL 847 comparables */ }
}
```

### Query Examples

```sql
-- Count total listings stored
SELECT
  id,
  vin,
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as listings_count
FROM reports
WHERE marketcheck_valuation IS NOT NULL;

-- Get franchise dealer listings only
SELECT
  id,
  vin,
  jsonb_array_length(
    (
      SELECT jsonb_agg(listing)
      FROM jsonb_array_elements(marketcheck_valuation->'recentComparables'->'listings') listing
      WHERE listing->>'dealer_type' = 'franchise'
    )
  ) as franchise_count
FROM reports
WHERE marketcheck_valuation IS NOT NULL;

-- Get listings within price range
SELECT
  id,
  vin,
  (
    SELECT jsonb_agg(listing)
    FROM jsonb_array_elements(marketcheck_valuation->'recentComparables'->'listings') listing
    WHERE (listing->>'price')::int BETWEEN 20000 AND 30000
  ) as listings_in_range
FROM reports
WHERE marketcheck_valuation IS NOT NULL;
```

## Performance Considerations

### Storage

- **Before**: Stored max 10 listings per report
- **After**: Stores ALL recent comparables (typically 20-50 listings)
- **Impact**: JSONB column size increases by ~40-200 KB per report
- **Optimization**: JSONB is highly compressed, minimal impact on database size

### Query Performance

- **Loading**: No impact - JSONB loads entire object regardless
- **Filtering**: Client-side JavaScript filtering is fast (<1ms for 50 items)
- **Indexing**: No additional indexes needed for JSONB filtering

### Best Practices

1. **Load once, filter many times**
   ```typescript
   // ✅ Good
   const allListings = marketCheck?.recentComparables?.listings || []
   const topPrice = getTopListings(allListings, 10)
   const lowMileage = getLowestMileageListings(allListings, 10)

   // ❌ Bad
   const topPrice = getTopListings(marketCheck?.recentComparables?.listings, 10)
   const lowMileage = getLowestMileageListings(marketCheck?.recentComparables?.listings, 10)
   ```

2. **Use memoization for expensive filters**
   ```typescript
   import { useMemo } from 'react'

   const filtered = useMemo(() => {
     return filterListings(allListings, { strategy, limit })
   }, [allListings, strategy, limit])
   ```

3. **Paginate large result sets**
   ```typescript
   const [page, setPage] = useState(0)
   const pageSize = 10
   const filtered = getTopListings(allListings, 50)
   const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize)
   ```

## Migration Notes

### For Existing Reports

- Old reports with `.slice(0, 10)` in database: Will continue to work (fallback in code)
- New reports: Will have ALL listings stored
- No migration needed - code handles both cases

### Backward Compatibility

The code includes fallbacks:
```typescript
const allListings = marketCheck?.recentComparables?.listings || marketCheck?.comparables || []
```

This ensures:
- New data structure: `recentComparables.listings` ✅
- Old data structure: `comparables` ✅
- Missing data: Empty array ✅

## Testing Checklist

- [ ] Verify ALL listings are stored (check `num_found` matches array length)
- [ ] Test each filter strategy works correctly
- [ ] Verify statistics calculation from ALL listings
- [ ] Test with different listing counts (0, 5, 50+)
- [ ] Check PDF generation shows filtered results
- [ ] Test backward compatibility with old reports
- [ ] Verify no performance degradation with 50+ listings

## Future Enhancements

Potential improvements:

1. **Interactive Filtering UI**: Allow users to change filter strategy in real-time
2. **Comparison Mode**: Select multiple listings to compare side-by-side
3. **Map View**: Show listings on interactive map using lat/long
4. **Price Alerts**: Notify when listings in certain criteria are added
5. **Historical Tracking**: Track listing price changes over time
6. **Advanced Analytics**: Show trends, outliers, market velocity

## Related Files

- `lib/api/marketcheck-client.ts` - API client (stores all listings)
- `lib/utils/listing-filters.ts` - Filtering utilities
- `app/reports/[id]/view/page.tsx` - Report view page
- `lib/pdf/report-template.tsx` - PDF template
- `docs/MARKETCHECK_LISTINGS_FIX.md` - Original fix documentation

---

**Created**: 2024-12-29
**Version**: 1.0
**Status**: ✅ Implemented
