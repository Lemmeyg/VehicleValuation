# MarketCheck Data Structure Update

## Overview
This update changes how MarketCheck API data is stored in the Supabase database to optimize storage and focus on the most valuable data: **recent comparables** and **all statistical analysis**.

## What Changed

### Before (Old Structure)
- ✅ Stored ALL comparables listings (up to 42+ vehicles)
- ✅ Stored recent comparables listings
- ✅ Stored statistics from both datasets

### After (New Structure)
- ❌ **NO LONGER STORE** all comparables listings (too large, less relevant)
- ✅ **ONLY STORE** recent comparables listings (actual sales data, most valuable)
- ✅ **STORE ALL STATISTICS** from both comparables and recent_comparables
- ✅ Added dedicated columns for faster queries

## Why This Change?

1. **Storage Efficiency**: Storing 42+ full vehicle listings is wasteful when we only need the stats
2. **Data Relevance**: Recent sales comparables are more valuable than active listings
3. **Query Performance**: New indexed columns for common queries
4. **Cost Optimization**: Smaller JSONB payloads = lower storage costs

## Database Changes

### New Columns Added to `reports` Table

```sql
-- Top-level columns for fast queries (cached from JSONB)
marketcheck_predicted_price INTEGER
marketcheck_msrp INTEGER
marketcheck_price_range_min INTEGER
marketcheck_price_range_max INTEGER
marketcheck_confidence VARCHAR(10)  -- 'low', 'medium', 'high'
marketcheck_total_comparables_found INTEGER
marketcheck_recent_comparables_found INTEGER
```

### New JSONB Structure (`marketcheck_valuation` column)

```json
{
  "predictedPrice": 27367,
  "msrp": 38000,
  "priceRange": {
    "min": 24630,
    "max": 30104
  },
  "confidence": "high",
  "dataSource": "marketcheck",
  "requestParams": {
    "vin": "...",
    "miles": 50000,
    "zip": "80202",
    "dealer_type": "franchise"
  },

  // Metadata about ALL comparables (listings NOT stored)
  "totalComparablesFound": 42,

  // Statistics from ALL comparables (42 vehicles)
  "comparablesStats": {
    "price": {
      "min": 18445,
      "max": 34288,
      "mean": 27387.17,
      "median": 27483,
      "stddev": 3801.9,
      "percentiles": {
        "5.0": 21570.65,
        "25.0": 24767.75,
        "50.0": 27483,
        "75.0": 30501.75,
        "90.0": 32145.7,
        "95.0": 33522.25,
        "99.0": 34103.09
      }
    },
    "miles": { /* same structure */ },
    "dos_active": { /* same structure */ }
  },

  // Recent comparables: ONLY THESE LISTINGS ARE STORED
  "recentComparables": {
    "num_found": 9,
    "listings": [
      {
        "id": "JTMDWRFV9LD537924-a03d3871-089f",
        "vin": "JTMDWRFV9LD537924",
        "year": 2020,
        "make": "Toyota",
        "model": "RAV4",
        "trim": "Limited",
        "price": 29998,
        "miles": 78819,
        "dom": 85,
        "dom_180": 16,
        "dom_active": 16,
        "dos_active": 16,
        "dealer_type": "franchise",
        "dealer_id": 10010052,
        "dealer_name": "Carmax Golden",
        "vdp_url": "https://www.carmax.com/car/27590929",
        "photo_url": "...",
        "location": {
          "city": "...",
          "state": "...",
          "zip": "...",
          "distance_miles": 10.5
        },
        "latitude": "39.723688",
        "longitude": "-105.185908",
        "listing_date": "2024-11-15",
        "mc_website_id": 10010052,
        "source": "marketcheck"
      }
      // ... up to 10 recent sales
    ],
    "stats": {
      "price": { /* statistics for recent sales only */ },
      "miles": { /* statistics for recent sales only */ },
      "dos_active": { /* statistics for recent sales only */ }
    }
  },

  "generatedAt": "2024-12-29T00:00:00.000Z"
}
```

## How to Apply This Update

### Step 1: Run the SQL Migration

```bash
# Navigate to your project directory
cd vehicle-valuation-saas

# Apply the migration to Supabase
npx supabase db push
```

Or manually run the SQL file in Supabase Dashboard:
- Go to: https://supabase.com/dashboard → Your Project → SQL Editor
- Copy contents of: `supabase/migrations/20251229000000_update_marketcheck_data_structure.sql`
- Click "Run"

### Step 2: Verify the Migration

```sql
-- Check that new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reports'
  AND column_name LIKE 'marketcheck%';

-- Should return:
-- marketcheck_valuation (jsonb)
-- marketcheck_predicted_price (integer)
-- marketcheck_msrp (integer)
-- marketcheck_price_range_min (integer)
-- marketcheck_price_range_max (integer)
-- marketcheck_confidence (character varying)
-- marketcheck_total_comparables_found (integer)
-- marketcheck_recent_comparables_found (integer)
```

### Step 3: Test the Code Changes

The TypeScript code has been updated automatically. Test it:

```bash
# Run your test suite
npm test

# Or test manually with a sample VIN
# (Your existing API routes will automatically use the new structure)
```

## Code Changes Summary

### Updated Files
1. ✅ `lib/api/marketcheck-client.ts` - Updated to store only recent comparables
2. ✅ `supabase/migrations/20251229000000_update_marketcheck_data_structure.sql` - Database schema
3. ✅ `supabase/migrations/20251229000001_rollback_marketcheck_data_structure.sql` - Rollback script

### Key Changes in `marketcheck-client.ts`

**Removed:**
- `comparables` array (no longer stored)
- `comparablesReturned` field (no longer relevant)

**Added:**
- `comparablesStats` - statistics from ALL comparables (42+ vehicles)
- Enhanced `recentComparables` - now includes `vdp_url` and `dealer_name`
- Better filtering and sorting for recent comparables

**Kept:**
- All existing interfaces and types
- Error handling and retry logic
- Mock data function (updated to match new structure)

## Data You Still Have Access To

### ✅ What You CAN Query

1. **Predicted Price & Range**
   - Main prediction: `marketcheck_predicted_price`
   - MSRP: `marketcheck_msrp`
   - Price range: `marketcheck_price_range_min`, `marketcheck_price_range_max`

2. **Statistics from ALL Comparables (42+ vehicles)**
   - Price stats: min, max, mean, median, percentiles
   - Mileage stats: full distribution
   - Days on market: DOS active statistics

3. **Recent Sales Comparables (up to 10 listings)**
   - Full vehicle details
   - Actual sale prices
   - Dealer information
   - Location data
   - Days on market
   - VDP URLs for more info

4. **Recent Sales Statistics**
   - Separate stats for just the recent sales
   - Price, mileage, and market time analysis

### ❌ What You Can NO LONGER Query

- Individual listings from the "all comparables" dataset (42+ vehicles)
- You still have the STATISTICS from these vehicles, just not the individual listings

## Example Queries

### Get Recent Comparables for a Report

```typescript
const report = await supabase
  .from('reports')
  .select('marketcheck_valuation')
  .eq('id', reportId)
  .single()

const recentComparables = report.marketcheck_valuation?.recentComparables?.listings || []
console.log(`Found ${recentComparables.length} recent sales`)
```

### Get Price Statistics from All Comparables

```typescript
const priceStats = report.marketcheck_valuation?.comparablesStats?.price
console.log(`Price range: $${priceStats.min} - $${priceStats.max}`)
console.log(`Mean price: $${priceStats.mean}`)
console.log(`Median price: $${priceStats.median}`)
console.log(`75th percentile: $${priceStats.percentiles['75.0']}`)
```

### Query Reports by Predicted Price Range

```sql
SELECT id, vin, marketcheck_predicted_price
FROM reports
WHERE marketcheck_predicted_price BETWEEN 25000 AND 35000
  AND marketcheck_confidence = 'high'
ORDER BY marketcheck_predicted_price DESC;
```

## Rollback Instructions

If you need to revert this change:

```bash
# Apply the rollback migration
psql $DATABASE_URL -f supabase/migrations/20251229000001_rollback_marketcheck_data_structure.sql
```

Or in Supabase Dashboard:
- SQL Editor → Run the rollback SQL file

**Note:** The rollback only removes the new columns. Your existing `marketcheck_valuation` JSONB data remains intact.

## Migration Safety

✅ **Safe Migration**
- No data loss
- Existing `marketcheck_valuation` column unchanged
- Only adds new columns (backwards compatible)
- Can be rolled back easily

✅ **Future-Proof**
- New code automatically uses the new structure
- Old reports with old structure will still work (JSONB is flexible)
- Gradual migration as new reports are created

## Testing Checklist

- [ ] Migration applied successfully to Supabase
- [ ] New columns exist in `reports` table
- [ ] Existing reports still load correctly
- [ ] New reports create with updated structure
- [ ] API routes return expected data
- [ ] PDF generation works with new structure
- [ ] Report preview shows recent comparables correctly

## Questions?

- Check the SQL migration file for detailed comments
- Review the updated TypeScript interfaces in `marketcheck-client.ts`
- Test with the example payload provided in the MarketCheck API docs

---

**Migration Created:** 2024-12-29
**Version:** 1.0
**Status:** Ready to deploy
