-- Find Recent Comparable Listings in Database
-- Run this in your Supabase SQL Editor to locate the listings

-- =============================================
-- 1. CHECK IF YOU HAVE ANY REPORTS WITH MARKETCHECK DATA
-- =============================================
SELECT
  id,
  vin,
  created_at,
  CASE
    WHEN marketcheck_valuation IS NULL THEN 'NO MARKETCHECK DATA'
    WHEN marketcheck_valuation IS NOT NULL THEN 'HAS MARKETCHECK DATA'
  END as status
FROM reports
ORDER BY created_at DESC
LIMIT 10;

-- =============================================
-- 2. CHECK THE STRUCTURE OF MARKETCHECK_VALUATION
-- =============================================
-- This shows you what's actually in the JSONB column
SELECT
  id,
  vin,
  created_at,
  -- Pretty print the entire marketcheck_valuation JSONB
  jsonb_pretty(marketcheck_valuation) as marketcheck_data
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- =============================================
-- 3. CHECK FOR RECENT COMPARABLES LISTINGS
-- =============================================
SELECT
  id,
  vin,
  created_at,
  -- Check if recentComparables exists
  CASE
    WHEN marketcheck_valuation->'recentComparables' IS NULL THEN 'NO recentComparables KEY'
    WHEN marketcheck_valuation->'recentComparables'->'listings' IS NULL THEN 'NO listings KEY'
    WHEN jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') = 0 THEN 'EMPTY ARRAY'
    ELSE 'HAS LISTINGS'
  END as listings_status,
  -- Get the count
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as listings_count,
  -- Get num_found value
  (marketcheck_valuation->'recentComparables'->>'num_found')::int as num_found
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- =============================================
-- 4. VIEW THE ACTUAL LISTINGS (if they exist)
-- =============================================
SELECT
  id,
  vin,
  created_at,
  -- Extract the listings array
  marketcheck_valuation->'recentComparables'->'listings' as all_listings,
  -- Count
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as count
FROM reports
WHERE marketcheck_valuation IS NOT NULL
  AND marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL
  AND jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') > 0
ORDER BY created_at DESC
LIMIT 1;

-- =============================================
-- 5. VIEW FIRST LISTING IN DETAIL (Pretty Print)
-- =============================================
SELECT
  id,
  vin,
  created_at,
  -- Pretty print the first listing
  jsonb_pretty(marketcheck_valuation->'recentComparables'->'listings'->0) as first_listing_details
FROM reports
WHERE marketcheck_valuation IS NOT NULL
  AND marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL
  AND jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') > 0
ORDER BY created_at DESC
LIMIT 1;

-- =============================================
-- 6. EXTRACT ALL LISTINGS AS A TABLE VIEW
-- =============================================
-- This "explodes" the listings array into rows for easy viewing
SELECT
  r.id as report_id,
  r.vin as report_vin,
  r.created_at as report_created,
  -- Extract listing fields
  listing->>'id' as listing_id,
  listing->>'vin' as listing_vin,
  (listing->>'year')::int as year,
  listing->>'make' as make,
  listing->>'model' as model,
  listing->>'trim' as trim,
  (listing->>'miles')::int as miles,
  (listing->>'price')::int as price,
  listing->>'dealer_type' as dealer_type,
  listing->'location'->>'city' as city,
  listing->'location'->>'state' as state,
  (listing->'location'->>'distance_miles')::numeric as distance_miles,
  listing->>'listing_date' as listing_date,
  (listing->>'dom')::int as days_on_market,
  listing->>'source' as source
FROM reports r,
  jsonb_array_elements(r.marketcheck_valuation->'recentComparables'->'listings') as listing
WHERE r.marketcheck_valuation IS NOT NULL
  AND r.marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL
ORDER BY r.created_at DESC, (listing->>'price')::int DESC
LIMIT 50;

-- =============================================
-- 7. CHECK OLD DATA STRUCTURE (comparables vs recentComparables)
-- =============================================
-- This checks if your data is using the old structure
SELECT
  id,
  vin,
  created_at,
  -- Check for old structure
  CASE
    WHEN marketcheck_valuation->'comparables' IS NOT NULL THEN 'OLD STRUCTURE (comparables)'
    WHEN marketcheck_valuation->'recentComparables' IS NOT NULL THEN 'NEW STRUCTURE (recentComparables)'
    ELSE 'NO LISTINGS DATA'
  END as data_structure,
  -- Count in old structure
  jsonb_array_length(marketcheck_valuation->'comparables') as old_comparables_count,
  -- Count in new structure
  jsonb_array_length(marketcheck_valuation->'recentComparables'->'listings') as new_listings_count
FROM reports
WHERE marketcheck_valuation IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- =============================================
-- 8. SUMMARY: COUNT REPORTS BY DATA STRUCTURE
-- =============================================
SELECT
  CASE
    WHEN marketcheck_valuation IS NULL THEN 'No MarketCheck Data'
    WHEN marketcheck_valuation->'recentComparables'->'listings' IS NOT NULL THEN 'New Structure (recentComparables.listings)'
    WHEN marketcheck_valuation->'comparables' IS NOT NULL THEN 'Old Structure (comparables)'
    ELSE 'Unknown Structure'
  END as structure_type,
  COUNT(*) as report_count
FROM reports
GROUP BY structure_type
ORDER BY report_count DESC;
