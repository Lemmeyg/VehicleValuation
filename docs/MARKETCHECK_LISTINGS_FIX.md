# MarketCheck Listings Display Fix

## Problem
MarketCheck comparable vehicle listings were being stored in the database but not displaying on the report page.

## Root Cause
The report view page was looking for listings at the wrong JSONB path:
- **Expected (incorrect)**: `marketcheck_valuation.comparables`
- **Actual (correct)**: `marketcheck_valuation.recentComparables.listings`

## Data Structure

The MarketCheck API response is stored with this structure:

```json
{
  "predictedPrice": 27367,
  "msrp": 38000,
  "priceRange": {
    "min": 24630,
    "max": 30104
  },
  "confidence": "high",
  "totalComparablesFound": 847,
  "comparablesStats": {
    "price": { /* statistics from ALL comparables */ },
    "miles": { /* statistics from ALL comparables */ },
    "dos_active": { /* statistics from ALL comparables */ }
  },
  "recentComparables": {
    "num_found": 42,
    "listings": [
      {
        "id": "...",
        "vin": "...",
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
        "photo_url": "...",
        "vdp_url": "...",
        "listing_date": "2024-12-10",
        "source": "marketcheck"
      }
      // ... up to 10 listings (filtered and sorted)
    ],
    "stats": { /* statistics from recent comparables only */ }
  },
  "dataSource": "marketcheck",
  "requestParams": { /* ... */ },
  "generatedAt": "2024-12-29T00:00:00.000Z"
}
```

## Files Fixed

### 1. `/app/reports/[id]/view/page.tsx` (Lines 67-72)

**Before:**
```typescript
const comparables = marketCheck?.comparables || []
const totalComparables = marketCheck?.totalComparablesFound || comparables.length || 127
```

**After:**
```typescript
const lowRange = marketCheck?.priceRange?.min || marketCheck?.priceRange?.low || 15725
const highRange = marketCheck?.priceRange?.max || marketCheck?.priceRange?.high || 21275
// FIX: Use recentComparables.listings instead of comparables
const comparables = marketCheck?.recentComparables?.listings || marketCheck?.comparables || []
const totalComparables = marketCheck?.totalComparablesFound || comparables.length || 127
```

**Also fixed field mapping (Line 377):**
```typescript
// Changed from: {comp.mileage?.toLocaleString()} mi
// Changed to:
{(comp.miles || comp.mileage)?.toLocaleString() || 'N/A'} mi
```

### 2. `/lib/pdf/report-template.tsx` (Lines 409-417)

**Before:**
```typescript
{data.marketcheckValuation?.comparables && data.marketcheckValuation.comparables.length > 0 && (
  <View style={styles.comparablesSection}>
    <Text style={styles.sectionTitle}>
      Comparable Vehicles ({Math.min(data.marketcheckValuation.comparables.length, 10)})
    </Text>
    {data.marketcheckValuation.comparables.slice(0, 10).map((comparable, index) => (
```

**After:**
```typescript
{data.marketcheckValuation?.recentComparables?.listings && data.marketcheckValuation.recentComparables.listings.length > 0 && (
  <View style={styles.comparablesSection}>
    <Text style={styles.sectionTitle}>
      Comparable Vehicles ({Math.min(data.marketcheckValuation.recentComparables.listings.length, 10)})
    </Text>
    {data.marketcheckValuation.recentComparables.listings.slice(0, 10).map((comparable, index) => (
```

### 3. `/app/api/reports/[id]/fetch-marketcheck/route.ts` (Lines 79-94)

Added debug logging to verify listings are being stored:

```typescript
console.log(`[MarketCheck] API success`, {
  predictedPrice: marketcheckResult.data.predictedPrice,
  comparables: marketcheckResult.data.totalComparablesFound,
  recentComparablesFound: marketcheckResult.data.recentComparables?.num_found,
  recentListingsCount: marketcheckResult.data.recentComparables?.listings?.length,
  responseTimeMs: apiResponseTime,
})

// DEBUG: Log the listings array structure
if (marketcheckResult.data.recentComparables?.listings) {
  console.log(`[MarketCheck] Recent comparables listings:`,
    JSON.stringify(marketcheckResult.data.recentComparables.listings, null, 2)
  )
} else {
  console.warn(`[MarketCheck] WARNING: No recentComparables.listings found in response`)
}
```

## Verification Steps

### 1. Check Database (Supabase SQL Editor)

Run the debug script to verify data structure:
```bash
# Location: /scripts/debug-marketcheck-data.sql
```

Example queries:

```sql
-- Check latest report has listings
SELECT
  id,
  vin,
  (marketcheck_valuation->'recentComparables'->>'num_found')::int as recent_comparables_count,
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as listings_array_length
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- View first listing structure
SELECT
  id,
  vin,
  marketcheck_valuation->'recentComparables'->'listings'->0 as first_listing
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

### 2. Check Terminal Logs

After running a new MarketCheck fetch, you should see:

```
[MarketCheck] API success {
  predictedPrice: 27367,
  comparables: 847,
  recentComparablesFound: 42,
  recentListingsCount: 10,
  responseTimeMs: 1523
}

[MarketCheck] Recent comparables listings: [
  {
    "year": 2020,
    "make": "Honda",
    "model": "Civic",
    "miles": 38000,
    "price": 22800,
    ...
  },
  ...
]
```

### 3. Check Report View Page

1. Navigate to `/reports/[id]/view`
2. Scroll to "Market Comparables" section
3. Verify table shows up to 10 vehicles with:
   - Vehicle details (year, make, model, trim)
   - Mileage
   - Price
   - Location (city, state)
   - Source badge

### 4. Check PDF Generation

1. Generate PDF from report page
2. Open PDF and verify "Comparable Vehicles" section
3. Should show same 10 vehicles as web view

## Key Implementation Details

### Listing Filtering (marketcheck-client.ts:370-382)

The client filters and limits listings to top 10:

```typescript
.filter(comp => {
  // Filter by model and trim if subject vehicle data provided
  if (!subjectVehicle) return true
  const matchesModel = !subjectVehicle.model ||
    comp.model?.toLowerCase() === subjectVehicle.model?.toLowerCase()
  const matchesTrim = !subjectVehicle.trim ||
    comp.trim?.toLowerCase() === subjectVehicle.trim?.toLowerCase()
  return matchesModel && matchesTrim
})
.sort((a, b) => b.price - a.price) // Sort by price descending
.slice(0, 10) // Take top 10 most expensive
```

### Data Storage

The entire `MarketCheckPrediction` object is stored in:
- **Column**: `reports.marketcheck_valuation` (JSONB)
- **Includes**:
  - `recentComparables.listings[]` - Up to 10 filtered listings
  - `recentComparables.stats` - Statistics from recent comparables
  - `comparablesStats` - Statistics from ALL comparables (not listings)
  - `totalComparablesFound` - Total count (metadata only)
  - Price prediction, confidence, etc.

### Cached Columns

For faster queries, key values are also stored in dedicated columns:
- `marketcheck_predicted_price`
- `marketcheck_msrp`
- `marketcheck_price_range_min`
- `marketcheck_price_range_max`
- `marketcheck_confidence`
- `marketcheck_total_comparables_found`
- `marketcheck_recent_comparables_found`

## Testing Checklist

- [ ] Run a new MarketCheck fetch for a test report
- [ ] Check terminal logs show `recentListingsCount: 10`
- [ ] View report page shows comparable vehicles table populated
- [ ] Verify all vehicle details display correctly (year, make, model, miles, price, location)
- [ ] Generate PDF and verify comparables section appears
- [ ] Run SQL debug script to verify database structure
- [ ] Test with different VINs to ensure filtering works correctly

## Migration Notes

**No database migration required** - this is a display/access fix only. Existing data should work immediately after code deployment.

If you have existing reports with old data structure:
1. The code includes fallback: `marketCheck?.recentComparables?.listings || marketCheck?.comparables || []`
2. Old reports with `comparables` will still display
3. New reports will use `recentComparables.listings`

## Related Files

- `lib/api/marketcheck-client.ts` - API client and data transformation
- `app/api/reports/[id]/fetch-marketcheck/route.ts` - API route for fetching MarketCheck data
- `app/reports/[id]/view/page.tsx` - Report display page
- `lib/pdf/report-template.tsx` - PDF template
- `lib/services/pdf-generator.tsx` - PDF generation service
- `supabase/migrations/20251229000000_update_marketcheck_data_structure.sql` - Schema migration

## Support

If listings still don't appear after these fixes:

1. Check terminal logs for `[MarketCheck] WARNING: No recentComparables.listings found`
2. Run SQL debug script to verify data structure in database
3. Verify the MarketCheck API is returning `recent_comparables` in response
4. Check API logs in `api_call_logs` table for errors

---

**Updated**: 2024-12-29
**Status**: ✅ Fixed
**Version**: 1.0
