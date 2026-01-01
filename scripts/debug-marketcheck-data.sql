-- Debug Script: Check MarketCheck Data Structure
-- This script helps verify that MarketCheck listings are being stored correctly

-- 1. Check if reports have MarketCheck data
SELECT
  id,
  vin,
  created_at,
  marketcheck_predicted_price,
  marketcheck_total_comparables_found,
  marketcheck_recent_comparables_found,
  -- Check if JSONB columns exist
  CASE
    WHEN marketcheck_valuation IS NULL THEN 'NO DATA'
    WHEN marketcheck_valuation IS NOT NULL THEN 'HAS DATA'
  END as has_marketcheck_data
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check the structure of recentComparables in the latest report
SELECT
  id,
  vin,
  -- Extract the number of recent comparables found
  (marketcheck_valuation->'recentComparables'->>'num_found')::int as recent_comparables_count,
  -- Extract the array length of listings
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as listings_array_length,
  -- Check if listings exist
  CASE
    WHEN marketcheck_valuation->'recentComparables'->'listings' IS NULL THEN 'NO LISTINGS'
    WHEN jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') = 0 THEN 'EMPTY ARRAY'
    ELSE 'HAS LISTINGS'
  END as listings_status
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 3. Extract first listing from recentComparables to verify structure
SELECT
  id,
  vin,
  -- Extract the first listing
  marketcheck_valuation->'recentComparables'->'listings'->0 as first_listing
FROM reports
WHERE marketcheck_valuation IS NOT NULL
  AND marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL
  AND jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') > 0
ORDER BY created_at DESC
LIMIT 1;

-- 4. Count reports with and without listings
SELECT
  COUNT(*) as total_reports_with_marketcheck,
  COUNT(CASE
    WHEN marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL
      AND jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') > 0
    THEN 1
  END) as reports_with_listings,
  COUNT(CASE
    WHEN marketcheck_valuation->'recentComparables'->'listings' IS NULL
      OR jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') = 0
    THEN 1
  END) as reports_without_listings
FROM reports
WHERE marketcheck_valuation IS NOT NULL;

-- 5. Check the full marketcheck_valuation structure for the latest report
SELECT
  id,
  vin,
  created_at,
  -- Pretty print the JSONB structure
  jsonb_pretty(marketcheck_valuation) as marketcheck_data
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
