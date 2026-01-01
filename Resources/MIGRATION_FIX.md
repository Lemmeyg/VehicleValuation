# Database Migration Fix

## Issue
When applying the initial schema migration (`20241210000000_initial_schema.sql`), PostgreSQL returned an error:

```
ERROR: 0A000: cannot use subquery in column generation expression
LINE 98: final_settlement_amount > carrier_offer_amount + (SELECT price_paid FROM reports WHERE id = report_id)
```

## Root Cause
PostgreSQL does not allow subqueries in `GENERATED` column expressions. The original schema attempted to use a subquery to fetch `price_paid` from the `reports` table to calculate if a refund request was valid.

## Solution
**Removed the generated column** and replaced it with a **simple stored column** (`report_cost`):

### Before (❌ Error):
```sql
CREATE TABLE refund_requests (
  ...
  carrier_offer_amount INTEGER NOT NULL,
  final_settlement_amount INTEGER NOT NULL,

  -- This caused the error (subquery not allowed)
  is_valid BOOLEAN GENERATED ALWAYS AS (
    final_settlement_amount > carrier_offer_amount + (SELECT price_paid FROM reports WHERE id = report_id)
  ) STORED,
  ...
);
```

### After (✅ Fixed):
```sql
CREATE TABLE refund_requests (
  ...
  carrier_offer_amount INTEGER NOT NULL,
  final_settlement_amount INTEGER NOT NULL,
  report_cost INTEGER NOT NULL, -- Cache the report cost at request time
  ...
);
```

### Added Helper Function
To validate refund eligibility, a PostgreSQL function was added:

```sql
CREATE OR REPLACE FUNCTION is_refund_valid(
  p_final_settlement INTEGER,
  p_carrier_offer INTEGER,
  p_report_cost INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_final_settlement > p_carrier_offer + p_report_cost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

## Usage

### When Creating a Refund Request
In your application code, you must now:
1. Fetch the `price_paid` from the `reports` table
2. Store it as `report_cost` when creating the refund request

**Example:**
```typescript
// Fetch the report
const { data: report } = await supabase
  .from('reports')
  .select('price_paid')
  .eq('id', reportId)
  .single()

// Create refund request with cached report_cost
const { data, error } = await supabase
  .from('refund_requests')
  .insert({
    report_id: reportId,
    user_id: userId,
    carrier_offer_amount: 500000, // $5000
    final_settlement_amount: 700000, // $7000
    report_cost: report.price_paid, // Cache the cost (e.g., 2900 = $29)
    acv_report_url: 'https://...',
    settlement_report_url: 'https://...',
  })
```

### Validating Refund Eligibility
Use the helper function in SQL queries:

```sql
SELECT
  *,
  is_refund_valid(final_settlement_amount, carrier_offer_amount, report_cost) AS is_eligible
FROM refund_requests
WHERE id = 'some-uuid';
```

Or in application code:
```typescript
function isRefundValid(finalSettlement: number, carrierOffer: number, reportCost: number): boolean {
  return finalSettlement > carrierOffer + reportCost
}
```

## Benefits of This Approach
1. ✅ **Simpler**: No complex generated columns
2. ✅ **Faster**: No subquery execution on every row access
3. ✅ **Historical accuracy**: Captures the report cost at the time of the refund request (important if pricing changes)
4. ✅ **PostgreSQL compatible**: Works with all PostgreSQL versions

## Migration Status
- ✅ Schema fixed
- ✅ Helper function added
- ✅ Comments updated
- ⏭️ Ready to apply in Supabase dashboard

You can now re-run the migration SQL in your Supabase dashboard without errors.
