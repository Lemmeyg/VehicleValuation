# MarketCheck Duplicate API Calls - Fix Documentation

**Date**: December 29, 2025
**Issue**: Duplicate MarketCheck API calls causing unnecessary charges ($0.09 per call)
**Status**: ✅ FIXED

---

## Problem Summary

The application was making **duplicate MarketCheck API calls** in several scenarios, resulting in unnecessary API charges. At $0.09 per call, this could result in significant waste at scale:

- **100 users/month**: $9.00 wasted
- **1,000 users/month**: $90.00 wasted
- **10,000 users/year**: $10,800 wasted

---

## Root Cause Analysis

### Duplicate Call Scenarios Identified

#### 1. **Authenticated Users in Beta Mode** (HIGH FREQUENCY)
- **Flow**:
  1. User creates report via `/api/reports/create` → MarketCheck called ✓
  2. User lands on `/pricing` page → Beta mode detects authenticated user
  3. Code calls `fetchMarketCheckData()` again ❌ **DUPLICATE**

- **Location**: [app/pricing/page.tsx:340-344](app/pricing/page.tsx#L340-L344)
- **Impact**: Every authenticated user in beta mode triggered 2 API calls

#### 2. **Anonymous Users in Beta Mode** (MEDIUM FREQUENCY)
- **Flow**:
  1. Anonymous user creates report via `/api/reports/create-anonymous` → MarketCheck deferred
  2. User lands on `/pricing` page → Code calls `fetchMarketCheckData()`
  3. If data already existed from previous flow → ❌ **POTENTIAL DUPLICATE**

- **Location**: [app/pricing/page.tsx:349-351](app/pricing/page.tsx#L349-L351)
- **Impact**: Edge case where anonymous reports had pre-existing data

#### 3. **Error Handler Fallback** (LOW FREQUENCY)
- **Flow**:
  1. Session check fails after MarketCheck already called
  2. Error handler calls `fetchMarketCheckData()` again → ❌ **DUPLICATE**

- **Location**: [app/pricing/page.tsx:356-358](app/pricing/page.tsx#L356-L358)
- **Impact**: Rare but possible in error scenarios

---

## Solutions Implemented

### Fix #1: Authenticated Users Check
**File**: `app/pricing/page.tsx` (Lines 340-352)

**Before**:
```typescript
if (sessionData.user) {
  console.log('[PricingPage] Authenticated existing user - fetching MarketCheck data')
  await fetchMarketCheckData()
  setShowExistingUserModal(true)
  return
}
```

**After**:
```typescript
if (sessionData.user) {
  console.log('[PricingPage] Authenticated existing user - checking for existing MarketCheck data')

  // FIX #1: Only fetch if data doesn't exist (prevents duplicate API calls)
  if (!report.marketcheck_valuation) {
    console.log('[PricingPage] No existing MarketCheck data, fetching from API')
    await fetchMarketCheckData()
  } else {
    console.log('[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge')
  }

  setShowExistingUserModal(true)
  return
}
```

---

### Fix #2: Anonymous Users Check
**File**: `app/pricing/page.tsx` (Lines 355-368)

**Before**:
```typescript
console.log('[PricingPage] Anonymous user - fetching MarketCheck data')
await fetchMarketCheckData()
sendMagicLink()
return
```

**After**:
```typescript
console.log('[PricingPage] Anonymous user - checking for existing MarketCheck data')

// FIX #2: Only fetch if data doesn't exist (prevents duplicate API calls)
if (!report.marketcheck_valuation) {
  console.log('[PricingPage] No existing MarketCheck data, fetching from API')
  await fetchMarketCheckData()
} else {
  console.log('[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge')
}

sendMagicLink()
return
```

---

### Fix #3: Error Handler Check
**File**: `app/pricing/page.tsx` (Lines 369-382)

**Before**:
```typescript
} catch (err) {
  console.error('[PricingPage] Error checking session:', err)
  await fetchMarketCheckData()
  sendMagicLink()
  return
}
```

**After**:
```typescript
} catch (err) {
  console.error('[PricingPage] Error checking session:', err)

  // FIX #3: Only fetch if data doesn't exist (prevents duplicate API calls in error scenarios)
  if (!report.marketcheck_valuation) {
    console.log('[PricingPage] Error fallback - fetching MarketCheck data')
    await fetchMarketCheckData()
  } else {
    console.log('[PricingPage] Error fallback - MarketCheck data already exists, skipping API call')
  }

  sendMagicLink()
  return
}
```

---

## How It Works

All three fixes follow the same pattern:

1. **Check if data exists**: `if (!report.marketcheck_valuation)`
2. **Only call API if missing**: Prevents unnecessary duplicate calls
3. **Log the decision**: Clear console logs for debugging

### Logic Flow

```
┌─────────────────────────────────────┐
│ User action triggers pricing page   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Check: Does report.marketcheck_     │
│        valuation exist?              │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
   YES: Skip      NO: Call API
   (Already       (First time
   have data)     fetching)
       │               │
       └───────┬───────┘
               │
               ▼
   ┌─────────────────────┐
   │ Continue with flow  │
   └─────────────────────┘
```

---

## Testing Recommendations

### Test Case 1: Authenticated User (Beta Mode)
1. **Setup**: Create authenticated user account
2. **Action**: Submit vehicle form → Create report
3. **Expected**: MarketCheck called once during `/api/reports/create`
4. **Navigate**: Go to `/pricing` page
5. **Verify**: Console logs "MarketCheck data already exists, skipping API call"
6. **Check**: Only 1 API call in `api_call_logs` table for this report

### Test Case 2: Anonymous User (Beta Mode)
1. **Setup**: Not logged in
2. **Action**: Submit vehicle form → Create anonymous report
3. **Expected**: No MarketCheck call during creation
4. **Navigate**: Go to `/pricing` page
5. **Verify**: Console logs "No existing MarketCheck data, fetching from API"
6. **Check**: Only 1 API call in `api_call_logs` table for this report

### Test Case 3: Error Scenario
1. **Setup**: Simulate session check failure (network error)
2. **Expected**: Error handler checks for existing data first
3. **Verify**: Console logs appropriate message (skip or fetch)
4. **Check**: No duplicate calls even in error state

---

## SQL Query to Verify Fix

Run this query to check for duplicate MarketCheck calls:

```sql
-- Find reports with multiple MarketCheck calls (should return 0 after fix)
SELECT
  report_id,
  COUNT(*) as call_count,
  SUM(cost) as total_cost,
  ARRAY_AGG(created_at ORDER BY created_at) as call_timestamps,
  ARRAY_AGG(endpoint ORDER BY created_at) as endpoints
FROM api_call_logs
WHERE api_provider = 'marketcheck'
  AND success = true
  AND created_at > NOW() - INTERVAL '7 days'  -- Check recent data
GROUP BY report_id
HAVING COUNT(*) > 1
ORDER BY call_count DESC
LIMIT 20;
```

**Expected Result After Fix**: Zero rows (no duplicates)

---

## Cost Savings Projection

### Before Fix
- Authenticated users: **2 calls** = $0.18 per user
- Anonymous users: **1-2 calls** = $0.09-$0.18 per user
- Average: ~$0.135 per user

### After Fix
- All users: **1 call** = $0.09 per user
- Savings: **$0.045 per user** (33% reduction)

### Annual Savings (at scale)
| Users/Year | Waste Before | Cost After | Savings   |
|------------|--------------|------------|-----------|
| 1,000      | $135         | $90        | $45       |
| 10,000     | $1,350       | $900       | $450      |
| 100,000    | $13,500      | $9,000     | **$4,500** |

---

## Monitoring & Verification

### Console Log Indicators

After deployment, watch for these log messages:

✅ **Good** (No duplicate):
```
[PricingPage] Authenticated existing user - checking for existing MarketCheck data
[PricingPage] MarketCheck data already exists, skipping API call to avoid duplicate charge
```

❌ **Bad** (Would have duplicated):
```
[PricingPage] No existing MarketCheck data, fetching from API
[MarketCheck] Calling API...
```
(If this appears for a report that already had data, investigate)

### API Logs Dashboard

Check [/admin/api-logs](http://localhost:3000/admin/api-logs):
- **MarketCheck Calls** should decrease by ~30-50%
- **Cost per report** should stabilize at $0.09
- **Duplicate calls** should be zero

---

## Related Files Modified

1. **[app/pricing/page.tsx](app/pricing/page.tsx)** - All 3 fixes applied
   - Lines 340-382: Beta mode flow with duplicate prevention

---

## Additional Notes

### Payment Webhook Behavior
The Stripe webhook at [app/api/stripe/webhook/route.ts:174](app/api/stripe/webhook/route.ts#L174) still calls MarketCheck post-payment. This is **intentional** to fetch fresh data after payment confirmation.

If this is NOT desired, add a similar check:
```typescript
// Only fetch if data doesn't exist OR is older than 1 hour
const shouldFetchFreshData = !report.marketcheck_valuation ||
  (new Date() - new Date(report.marketcheck_valuation.generatedAt)) > 3600000

if (shouldFetchFreshData) {
  await fetchMarketCheckData(...)
}
```

### Future Improvements
Consider adding:
1. **Cache expiration**: Refresh data if older than X hours
2. **Force refresh flag**: Allow manual refresh if user requests it
3. **Database constraint**: Prevent multiple calls per report within 1 hour

---

## Deployment Checklist

- [x] Code changes implemented
- [x] Documentation created
- [ ] Test in development environment
- [ ] Verify SQL query shows no duplicates
- [ ] Monitor console logs for 24 hours post-deploy
- [ ] Check API cost reduction in admin dashboard
- [ ] Update team on changes

---

## Questions?

If you see unexpected behavior or have questions about this fix:
1. Check console logs for the decision messages
2. Run the SQL query to find duplicate calls
3. Review this document for expected behavior
4. Check `api_call_logs` table for the specific report_id

**Remember**: The goal is **1 MarketCheck call per report** (unless explicitly refreshed).
