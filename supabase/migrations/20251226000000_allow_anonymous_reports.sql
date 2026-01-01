-- Migration: Allow Anonymous Reports
-- Date: 2025-12-26
-- Purpose: Modify reports table to support anonymous report creation

-- Make user_id nullable (for anonymous reports before payment)
ALTER TABLE reports ALTER COLUMN user_id DROP NOT NULL;

-- Make vehicle_data nullable (VIN decode API might fail initially)
ALTER TABLE reports ALTER COLUMN vehicle_data DROP NOT NULL;

-- Make price_paid nullable (not paid yet for anonymous reports)
ALTER TABLE reports ALTER COLUMN price_paid DROP NOT NULL;

-- Add email column for anonymous report tracking
ALTER TABLE reports ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_reports_email ON reports(email);

-- Add mileage and zip_code columns if they don't exist
ALTER TABLE reports ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);

-- Add dealer_type column if it doesn't exist
ALTER TABLE reports ADD COLUMN IF NOT EXISTS dealer_type VARCHAR(50);

-- Add marketcheck_valuation column if it doesn't exist
ALTER TABLE reports ADD COLUMN IF NOT EXISTS marketcheck_valuation JSONB;

-- Update RLS policy to allow anonymous report creation
DROP POLICY IF EXISTS "Allow anonymous report creation" ON reports;
DROP POLICY IF EXISTS "Users can create own reports" ON reports;

-- Create new INSERT policy that allows both authenticated and anonymous
CREATE POLICY "Users can create reports"
  ON reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Anonymous users: must have email, no user_id
    (auth.uid() IS NULL AND email IS NOT NULL AND user_id IS NULL)
    OR
    -- Authenticated users: must match user_id
    (auth.uid() = user_id)
  );

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Comments
COMMENT ON COLUMN reports.email IS 'Email for anonymous reports, used for account linking during payment';
COMMENT ON COLUMN reports.mileage IS 'Vehicle mileage at time of report creation';
COMMENT ON COLUMN reports.zip_code IS 'ZIP code for market valuation location';
COMMENT ON COLUMN reports.dealer_type IS 'Type of dealer: private, franchise, independent';
COMMENT ON COLUMN reports.marketcheck_valuation IS 'MarketCheck API valuation data';
