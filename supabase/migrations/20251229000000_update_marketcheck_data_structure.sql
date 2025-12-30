-- Update MarketCheck Data Structure
-- Migration: 20251229000000_update_marketcheck_data_structure.sql
-- Date: 2024-12-29
--
-- Changes:
-- - Store only recent_comparables (not all comparables)
-- - Store all statistics from both comparables and recent_comparables
-- - Add dedicated columns for better querying
-- - Keep marketcheck_valuation JSONB for flexibility

-- =============================================
-- ADD NEW COLUMNS TO REPORTS TABLE
-- =============================================

-- Add predicted price as a top-level column for easy querying
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS marketcheck_predicted_price INTEGER,
  ADD COLUMN IF NOT EXISTS marketcheck_msrp INTEGER,
  ADD COLUMN IF NOT EXISTS marketcheck_price_range_min INTEGER,
  ADD COLUMN IF NOT EXISTS marketcheck_price_range_max INTEGER,
  ADD COLUMN IF NOT EXISTS marketcheck_confidence VARCHAR(10),
  ADD COLUMN IF NOT EXISTS marketcheck_total_comparables_found INTEGER,
  ADD COLUMN IF NOT EXISTS marketcheck_recent_comparables_found INTEGER;

-- Add constraint for confidence level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_marketcheck_confidence_check'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_marketcheck_confidence_check
      CHECK (marketcheck_confidence IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- =============================================
-- ADD INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reports_marketcheck_predicted_price ON reports(marketcheck_predicted_price);
CREATE INDEX IF NOT EXISTS idx_reports_marketcheck_confidence ON reports(marketcheck_confidence);

-- =============================================
-- ADD COLUMN DOCUMENTATION
-- =============================================

COMMENT ON COLUMN reports.marketcheck_predicted_price IS 'MarketCheck predicted price in cents (cached from JSONB for query performance)';
COMMENT ON COLUMN reports.marketcheck_msrp IS 'Manufacturer Suggested Retail Price in cents from MarketCheck API';
COMMENT ON COLUMN reports.marketcheck_price_range_min IS 'Minimum price in prediction range (cents)';
COMMENT ON COLUMN reports.marketcheck_price_range_max IS 'Maximum price in prediction range (cents)';
COMMENT ON COLUMN reports.marketcheck_confidence IS 'MarketCheck prediction confidence: low, medium, or high';
COMMENT ON COLUMN reports.marketcheck_total_comparables_found IS 'Total comparable vehicles found by MarketCheck (all comparables)';
COMMENT ON COLUMN reports.marketcheck_recent_comparables_found IS 'Number of recent comparable sales found by MarketCheck';

COMMENT ON COLUMN reports.marketcheck_valuation IS 'MarketCheck prediction data including:
- predictedPrice, msrp, priceRange, confidence
- comparablesStats: statistics from all comparables (price, miles, dos_active)
- recentComparables: array of recent sales with stats
- requestParams: vin, miles, zip, dealer_type
- generatedAt: ISO timestamp';

-- =============================================
-- MIGRATION NOTES
-- =============================================

-- Data Structure Changes:
-- Old: marketcheck_valuation stored all comparables + recent comparables
-- New: marketcheck_valuation stores only recent comparables + all stats
--
-- JSONB Structure (new):
-- {
--   "predictedPrice": 27367,
--   "msrp": 38000,
--   "priceRange": {"min": 24630, "max": 30104},
--   "confidence": "high",
--   "dataSource": "marketcheck",
--   "requestParams": {...},
--   "comparablesStats": {
--     "price": {...statistical data...},
--     "miles": {...statistical data...},
--     "dos_active": {...statistical data...}
--   },
--   "recentComparables": {
--     "num_found": 9,
--     "listings": [...array of recent sales...],
--     "stats": {
--       "price": {...statistical data...},
--       "miles": {...statistical data...},
--       "dos_active": {...statistical data...}
--     }
--   },
--   "totalComparablesFound": 42,
--   "recentComparablesFound": 9,
--   "generatedAt": "2024-12-29T00:00:00.000Z"
-- }
