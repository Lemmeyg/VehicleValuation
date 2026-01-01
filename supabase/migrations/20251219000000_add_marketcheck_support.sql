-- Add MarketCheck Price API Support
-- Migration: 20251219000000_add_marketcheck_support.sql
-- Date: 2024-12-19
--
-- Adds support for MarketCheck Price API Premium tier integration:
-- - Mileage (user-provided)
-- - ZIP code (for location-based pricing)
-- - Dealer type (auto-determined: franchise vs independent)
-- - MarketCheck valuation results (JSONB with top 10 comparables)

-- =============================================
-- ADD COLUMNS TO REPORTS TABLE
-- =============================================

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS mileage INTEGER,
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS dealer_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS marketcheck_valuation JSONB;

-- Add constraint for dealer_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_dealer_type_check'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_dealer_type_check
      CHECK (dealer_type IN ('franchise', 'independent'));
  END IF;
END $$;

-- =============================================
-- ADD INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reports_zip_code ON reports(zip_code);
CREATE INDEX IF NOT EXISTS idx_reports_dealer_type ON reports(dealer_type);

-- =============================================
-- ADD COLUMN DOCUMENTATION
-- =============================================

COMMENT ON COLUMN reports.mileage IS 'Vehicle mileage in miles (user-provided for MarketCheck API)';
COMMENT ON COLUMN reports.zip_code IS 'ZIP code for location-based price prediction (MarketCheck API)';
COMMENT ON COLUMN reports.dealer_type IS 'Dealer type: franchise or independent (auto-determined from vehicle make)';
COMMENT ON COLUMN reports.marketcheck_valuation IS 'MarketCheck price prediction results including top 10 comparable vehicles';
