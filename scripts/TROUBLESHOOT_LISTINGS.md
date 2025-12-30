# Troubleshooting: Can't Find Listings in Database

## Quick Diagnosis

### Step 1: Check if you have any MarketCheck data at all

Run this query in Supabase SQL Editor:

```sql
SELECT id, vin, created_at, marketcheck_valuation
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**

#### Scenario A: No rows returned
**Problem**: No reports have MarketCheck data yet
**Solution**: Run a MarketCheck fetch for any report first

#### Scenario B: Returns a row
**Next Step**: Check the structure of `marketcheck_valuation` column

---

### Step 2: Identify the data structure

Run this query:

```sql
SELECT
  id,
  vin,
  jsonb_pretty(marketcheck_valuation) as data
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Look for these patterns:**

#### Pattern 1: NEW STRUCTURE ✅ (what we want)
```json
{
  "predictedPrice": 27367,
  "recentComparables": {
    "num_found": 42,
    "listings": [
      {
        "id": "...",
        "vin": "...",
        "year": 2020,
        "make": "Honda",
        "price": 22800,
        ...
      }
    ]
  }
}
```
**Path to listings**: `marketcheck_valuation->'recentComparables'->'listings'`

#### Pattern 2: OLD STRUCTURE (before our changes)
```json
{
  "predictedPrice": 27367,
  "comparables": [
    {
      "year": 2020,
      "make": "Honda",
      ...
    }
  ]
}
```
**Path to listings**: `marketcheck_valuation->'comparables'`

#### Pattern 3: EMPTY LISTINGS
```json
{
  "predictedPrice": 27367,
  "recentComparables": {
    "num_found": 0,
    "listings": []
  }
}
```
**Problem**: API returned no recent comparables
**Cause**: Vehicle is rare, or ZIP code has no matches

---

### Step 3: Check listings count

Run this query:

```sql
SELECT
  id,
  vin,
  -- Check new structure
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as new_count,
  -- Check old structure
  jsonb_array_length(marketcheck_valuation->'comparables') as old_count,
  -- Check num_found
  (marketcheck_valuation->'recentComparables'->>'num_found')::int as num_found
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Interpretation:**

| new_count | old_count | num_found | Diagnosis |
|-----------|-----------|-----------|-----------|
| NULL | 10 | NULL | OLD STRUCTURE - need to re-fetch |
| 0 | NULL | 0 | NEW STRUCTURE but no listings found |
| 42 | NULL | 42 | ✅ PERFECT - new structure with data |
| NULL | NULL | NULL | BROKEN - no data at all |

---

## Common Issues & Solutions

### Issue 1: "I see old structure (comparables) not new structure"

**Cause**: This report was created before our code changes

**Solution**: Re-fetch MarketCheck data for this report
1. Go to report page
2. Click "Fetch MarketCheck Data" button (if available)
3. Or use API: `POST /api/reports/{id}/fetch-marketcheck`

**Alternative**: Create a new report - it will use the new structure

---

### Issue 2: "listings array is empty"

**Check the API response in terminal logs:**

Look for this in your server logs:
```
[MarketCheck] API success {
  totalComparables: 847,
  recentComparablesFound: 0,  ← THIS IS THE PROBLEM
  listingsStoredCount: 0,
  ...
}
```

**Possible causes:**

1. **Vehicle is very rare**: No recent sales in market
2. **ZIP code has no matches**: Try different ZIP code
3. **Model/trim filter too strict**: Filtering removed all listings
4. **API returned no recent_comparables**: Check API response

**Debug by checking the raw API response:**

In terminal, look for:
```
[MarketCheck] FULL API RESPONSE: { ... }
```

Check if `recent_comparables.listings` exists and has data.

---

### Issue 3: "I see recentComparables but listings is null"

**This means the API returned this structure:**
```json
{
  "recentComparables": {
    "num_found": 0
    // NO "listings" key at all
  }
}
```

**Cause**: MarketCheck API didn't include listings in response

**Possible reasons:**
1. Free tier vs Premium tier difference
2. API endpoint issue
3. Request parameters not correct

**Check your API call:**
```
/v2/predict/car/us/marketcheck_price/comparables
```

Make sure you're using the `/comparables` endpoint (not basic endpoint).

---

### Issue 4: "num_found says 42 but listings array has 0"

**Cause**: Filtering removed all listings

**Check the filter logic in marketcheck-client.ts:**

```typescript
.filter(comp => {
  if (!subjectVehicle) return true
  const matchesModel = !subjectVehicle.model ||
    comp.model?.toLowerCase() === subjectVehicle.model?.toLowerCase()
  const matchesTrim = !subjectVehicle.trim ||
    comp.trim?.toLowerCase() === subjectVehicle.trim?.toLowerCase()
  return matchesModel && matchesTrim
})
```

**Solution**:
- Check if `subjectVehicle.trim` is too specific
- May need to loosen the filter criteria

---

## Step-by-Step Diagnosis

### 1. Check if code changes are deployed

Verify the code has the new structure:

**In `lib/api/marketcheck-client.ts` line ~380:**
```typescript
// Should NOT have .slice(0, 10)
.sort((a, b) => b.price - a.price),  // ✅ Good
// .slice(0, 10),  // ❌ Bad (old code)
```

### 2. Create a test report

1. Create a new report with a common vehicle (e.g., Honda Civic)
2. Use a major city ZIP code (e.g., 90025 for Los Angeles)
3. Fetch MarketCheck data
4. Check terminal logs

**Expected logs:**
```
[MarketCheck] API success {
  predictedPrice: 27367,
  totalComparables: 847,
  recentComparablesFound: 42,
  listingsStoredCount: 42,  ← Should match recentComparablesFound
  responseTimeMs: 1523
}

[MarketCheck] Storing 42 listings in database (all recent comparables, no artificial limit)

[MarketCheck] Sample listings (first 3 of 42): [
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

### 3. Query the database

Run query #6 from `find-listings-in-database.sql`:

```sql
SELECT
  r.id,
  listing->>'year' as year,
  listing->>'make' as make,
  listing->>'model' as model,
  (listing->>'price')::int as price,
  (listing->>'miles')::int as miles
FROM reports r,
  jsonb_array_elements(r.marketcheck_valuation->'recentComparables'->'listings') as listing
WHERE r.marketcheck_valuation IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 10;
```

**If this returns rows**: ✅ Listings are there!
**If this returns nothing**: Continue diagnosis...

---

## Manual Database Inspection

### Open Supabase Table Editor

1. Go to Supabase Dashboard
2. Click "Table Editor"
3. Select "reports" table
4. Find a recent report
5. Click the `marketcheck_valuation` column
6. Look at the JSON structure

### What to look for:

```json
{
  "predictedPrice": 27367,
  "recentComparables": {           ← Must exist
    "num_found": 42,                ← Should be > 0
    "listings": [                    ← Must be an array with items
      {                              ← Each item is a vehicle
        "id": "listing_123",
        "year": 2020,
        "make": "Honda",
        "model": "Civic",
        "miles": 38000,
        "price": 22800,
        "dealer_type": "franchise",
        "location": {
          "city": "Los Angeles",
          "state": "CA"
        }
      }
      // ... more listings
    ]
  }
}
```

---

## Still Can't Find Them?

### Check the code is actually running

Add this temporary debug line to `app/api/reports/[id]/fetch-marketcheck/route.ts` after line 159:

```typescript
// Store MarketCheck results
const { error: mcUpdateError } = await supabase
  .from('reports')
  .update({
    marketcheck_valuation: marketcheckResult.data,
    // ... other fields
  })
  .eq('id', reportId)

// ADD THIS DEBUG LINE:
console.log('STORED DATA:', JSON.stringify(marketcheckResult.data.recentComparables, null, 2))
```

Then run a fetch and check the logs. This will show you EXACTLY what's being stored.

---

## Contact Support

If you've tried everything above and still can't find the listings:

1. **Provide this info:**
   - Output from query #2 (structure check)
   - Output from query #3 (listings status)
   - Terminal logs from MarketCheck fetch
   - Screenshot of Supabase table editor

2. **Check files:**
   - `lib/api/marketcheck-client.ts` - confirm no `.slice(0, 10)`
   - `app/api/reports/[id]/fetch-marketcheck/route.ts` - confirm line 159 stores `marketcheck_valuation`

3. **Most likely cause:**
   - Code changes not deployed/restarted
   - Using old reports (need to re-fetch)
   - API returning no recent_comparables

---

## Quick Test Command

Run this single query to diagnose everything:

```sql
WITH latest_report AS (
  SELECT *
  FROM reports
  WHERE marketcheck_valuation IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  id,
  vin,
  created_at,
  -- Structure check
  CASE
    WHEN marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL THEN 'NEW STRUCTURE'
    WHEN marketcheck_valuation->'comparables' IS NOT NULL THEN 'OLD STRUCTURE'
    ELSE 'UNKNOWN'
  END as structure,
  -- Counts
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as new_count,
  jsonb_array_length(marketcheck_valuation->'comparables') as old_count,
  (marketcheck_valuation->'recentComparables'->>'num_found')::int as num_found,
  -- Sample listing
  marketcheck_valuation->'recentComparables'->'listings'->0->>'make' as first_listing_make,
  (marketcheck_valuation->'recentComparables'->'listings'->0->>'price')::int as first_listing_price
FROM latest_report;
```

**Expected good result:**
```
structure: NEW STRUCTURE
new_count: 42
old_count: NULL
num_found: 42
first_listing_make: Honda
first_listing_price: 22800
```
