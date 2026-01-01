# MarketCheck Integration Testing Guide

**Phase 1 MVP Testing - Mock Data Implementation**

Date: December 19, 2024
Status: Database migration applied ✓

---

## Prerequisites

✅ Database migration applied (mileage, zip_code, dealer_type, marketcheck_valuation columns added)
✅ Development server running on http://localhost:3000
✅ Mock data functions implemented (no API keys required for Phase 1)

---

## Test Plan

### Test 1: Form Validation - New Report Page

**URL**: http://localhost:3000/reports/new

**Test Cases**:

1. **VIN Field**
   - Enter VIN: `1HGBH41JXMN109186` (from TEST_DATA.md - Honda Accord)
   - Verify character counter shows: 17/17 characters
   - Verify green color when complete

2. **Mileage Field**
   - Enter mileage: `42000`
   - Verify accepts numeric input only
   - Verify helper text: "Enter the current odometer reading in miles"
   - Test edge cases:
     - Min: `0` (should accept)
     - Max: `999999` (should accept)
     - Out of range: `1000000` (should show error)
     - Invalid: `-500` (should prevent or show error)

3. **ZIP Code Field**
   - Enter ZIP: `90210`
   - Verify accepts only numeric input (letters automatically removed)
   - Verify character counter: 5/5 digits
   - Verify green color when complete
   - Verify helper text: "Your location helps us find accurate comparable vehicles in your area"

4. **Submit Button State**
   - Before all fields filled: Button should be **disabled**
   - After all fields valid: Button should be **enabled**
   - Click "Continue" to proceed

**Expected Result**: Form validates all fields and redirects to report page after 2-second mock delay

---

### Test 2: API Integration - Report Creation

**What Happens Behind the Scenes**:

1. VIN validation (server-side)
2. Mileage validation (0-999,999)
3. ZIP validation (exactly 5 digits)
4. VinAudit mock call (vehicle data)
5. Auto.dev mock call (accident data)
6. **Dealer type classification** (Honda = franchise)
7. CarsXE mock call (market valuation)
8. **MarketCheck mock call** (price prediction with 10 comparables)
9. Database insert with all new fields

**Expected Console Output** (check browser DevTools or server logs):

```
[DEALER_TYPE] {
  make: 'Honda',
  year: '2021',
  classification: 'franchise',
  confidence: 'high',
  reasoning: 'Honda is a major brand typically sold at franchise dealers'
}

[MARKETCHECK_SUCCESS] {
  predictedPrice: 22500,
  comparables: 10,
  dealerType: 'franchise'
}
```

**Expected API Call Logs** (in database `api_call_logs` table):
- VinAudit: success, $0.02 cost
- Auto.dev: success, $0.00 cost
- CarsXE: success, $0.00 cost
- **MarketCheck: success, $0.10 cost**

---

### Test 3: Dual Valuation Display

**URL**: http://localhost:3000/reports/{id} (redirected after Test 1)

**What to Verify**:

#### CarsXE Card (Blue Theme)
- Header: "Market Valuation"
- Badge: "CarsXE" (blue background)
- Shows three values:
  - **Low**: ~$18,000
  - **Average**: ~$20,000
  - **High**: ~$22,000
- Confidence: High
- Data points: ~50 comparables

#### MarketCheck Card (Emerald Theme)
- Header: "Price Prediction"
- Badge: "MarketCheck" (emerald background)
- Shows:
  - **Predicted Dealer Price**: $22,500 (large, centered)
  - **Price Range**: $20,250 - $24,750
  - **Dealer Type**: Franchise
  - **Location**: 90210
  - **Mileage**: 42,000 miles
  - **Comparables**: 10 vehicles found (847 total)

#### Layout
- Desktop (>1024px): Side-by-side cards
- Mobile (<1024px): Stacked cards

---

### Test 4: Comparables Table

**Location**: Below the dual valuation cards

**Verify Table Contains**:
- Header: "Comparable Vehicles (10 shown)"
- Columns:
  1. **Vehicle**: Year Make Model Trim
  2. **Mileage**: Formatted with commas
  3. **Price**: Formatted as currency
  4. **Location**: City, State ZIP
  5. **Distance**: Miles from your location

**Sample Row** (mock data):
```
2021 Honda Accord EX
45,000 miles
$21,800
Beverly Hills, CA 90210
12 miles
```

**Verify**:
- All 10 rows display correctly
- Prices vary (should not all be identical)
- Locations are within reasonable distance
- Hover effect on rows (background changes to gray-50)

---

### Test 5: Database Verification

**Run this SQL in Supabase SQL Editor**:

```sql
SELECT
  vin,
  mileage,
  zip_code,
  dealer_type,
  marketcheck_valuation->>'predictedPrice' as mc_predicted_price,
  marketcheck_valuation->>'confidence' as mc_confidence,
  jsonb_array_length(marketcheck_valuation->'comparables') as mc_comparables_count,
  created_at
FROM reports
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result**:
```
vin: 1HGBH41JXMN109186
mileage: 42000
zip_code: 90210
dealer_type: franchise
mc_predicted_price: 22500
mc_confidence: high
mc_comparables_count: 10
created_at: [timestamp]
```

---

### Test 6: Edge Cases & Error Handling

#### Test 6.1: Invalid VIN
- Enter VIN: `INVALID123456789` (invalid format)
- **Expected**: Error message before reaching API

#### Test 6.2: Out of Range Mileage
- Enter mileage: `5000000`
- **Expected**: "Please enter a valid mileage between 0 and 999,999"

#### Test 6.3: Invalid ZIP Code
- Enter ZIP: `ABC12` (letters)
- **Expected**: Input automatically filters to numeric only
- Enter ZIP: `123` (too short)
- **Expected**: Button remains disabled, counter shows 3/5

#### Test 6.4: MarketCheck Failure Simulation
**Manual Code Test** (temporary edit to test graceful degradation):

Edit `lib/api/marketcheck-client.ts` temporarily:
```typescript
// Change line to force failure:
return { success: false, error: 'Simulated API failure' }
```

**Expected Behavior**:
- Report still creates successfully
- CarsXE valuation still displays
- MarketCheck card does NOT display
- No comparables table
- Console shows: `[MARKETCHECK_FAILURE]` warning
- Database: `marketcheck_valuation` = null

**IMPORTANT**: Revert the change after testing!

---

### Test 7: Different Vehicle Types

Test dealer type classification with different makes:

#### Test 7.1: Franchise Brand (Toyota)
- VIN: `4T1B11HK1LU123456` (Toyota Camry)
- Mileage: `35000`
- ZIP: `10001`
- **Expected dealer_type**: `franchise`

#### Test 7.2: Discontinued Brand (Saturn)
- VIN: `1G8ZG52B2WZ123456` (Saturn Ion - if available)
- Mileage: `120000`
- ZIP: `60601`
- **Expected dealer_type**: `independent`

#### Test 7.3: Old Vehicle (>15 years)
- VIN for 2005 vehicle
- **Expected dealer_type**: `independent`

---

## Test Results Checklist

- [ ] Form displays all three fields (VIN, mileage, ZIP)
- [ ] Form validation works (button disabled until complete)
- [ ] VIN character counter works (X/17)
- [ ] ZIP character counter works (X/5)
- [ ] Mileage accepts numeric input only
- [ ] ZIP auto-filters to numeric only
- [ ] Form submission creates report successfully
- [ ] Dealer type auto-classified correctly (console log)
- [ ] Report page shows dual valuation cards
- [ ] CarsXE card displays (blue theme)
- [ ] MarketCheck card displays (emerald theme)
- [ ] Predicted price matches expected range (~$22,500)
- [ ] Comparables table shows 10 vehicles
- [ ] Comparables table has all 5 columns
- [ ] Database stores mileage correctly
- [ ] Database stores zip_code correctly
- [ ] Database stores dealer_type correctly
- [ ] Database stores marketcheck_valuation JSONB
- [ ] marketcheck_valuation contains 10 comparables
- [ ] Graceful degradation works (if MarketCheck fails)

---

## Known Issues / Notes

### Phase 1 Limitations (Mock Data):
- All prices are calculated, not from real market data
- Comparables use template data with variations
- 2-second artificial delay on MarketCheck call
- No real API costs incurred

### Before Phase 2 (Real API):
- Obtain MarketCheck API key from https://www.marketcheck.com/api
- Add to `.env.local`: `MARKETCHECK_API_KEY=mc_live_...`
- Change `fetchMarketCheckDataMock` to `fetchMarketCheckData` in `app/api/reports/create/route.ts`
- Test with real VINs and verify pricing accuracy
- Monitor API costs in `api_call_logs` table

---

## Troubleshooting

### Issue: "Column does not exist" error
**Solution**: Migration not applied. Re-run the SQL in Supabase dashboard.

### Issue: MarketCheck card not showing
**Check**:
1. Console for errors (DevTools)
2. Server logs for `[MARKETCHECK_SUCCESS]` or `[MARKETCHECK_FAILURE]`
3. Database: `marketcheck_valuation` should not be null

### Issue: Comparables table empty
**Check**:
- `marketcheck_valuation.comparables` array length
- Should contain exactly 10 items
- Verify JSONB structure in database

### Issue: Wrong dealer type
**Check**:
- Console log `[DEALER_TYPE]` for classification reasoning
- Review `lib/utils/dealer-type-classifier.ts` logic
- Verify vehicle make is in correct list (franchise vs independent)

---

## Next Steps After Testing

1. ✅ Verify all checklist items pass
2. Document any bugs or issues found
3. Plan Phase 2: Real API integration
4. Plan Phase 3: PostHog analytics events
5. Production deployment preparation

---

## Test VINs for Reference

From `TEST_DATA.md`:

```
Honda Accord (Franchise): 1HGBH41JXMN109186
Toyota Camry (Franchise): 4T1B11HK1LU123456
Ford F-150 (Franchise): 1FTFW1E50LFA12345
```

Use these with varying mileage and ZIP codes to test different scenarios.

---

**Test Date**: ___________________
**Tested By**: ___________________
**Result**: ☐ PASS  ☐ FAIL  ☐ PARTIAL

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
