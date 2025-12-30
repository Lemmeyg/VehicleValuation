-- Rollback: Update MarketCheck Data Structure
-- Migration: 20251229000001_rollback_marketcheck_data_structure.sql
-- Date: 2024-12-29
--
-- This rollback migration removes the changes from 20251229000000_update_marketcheck_data_structure.sql
-- Use this if you need to revert to the previous schema

-- =============================================
-- REMOVE INDEXES
-- =============================================

DROP INDEX IF EXISTS idx_reports_marketcheck_predicted_price;
DROP INDEX IF EXISTS idx_reports_marketcheck_confidence;

-- =============================================
-- REMOVE CONSTRAINTS
-- =============================================

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_marketcheck_confidence_check;

-- =============================================
-- REMOVE COLUMNS
-- =============================================

ALTER TABLE reports
  DROP COLUMN IF EXISTS marketcheck_predicted_price,
  DROP COLUMN IF EXISTS marketcheck_msrp,
  DROP COLUMN IF EXISTS marketcheck_price_range_min,
  DROP COLUMN IF EXISTS marketcheck_price_range_max,
  DROP COLUMN IF EXISTS marketcheck_confidence,
  DROP COLUMN IF EXISTS marketcheck_total_comparables_found,
  DROP COLUMN IF EXISTS marketcheck_recent_comparables_found;

-- =============================================
-- NOTES
-- =============================================
-- This rollback does NOT modify the marketcheck_valuation JSONB column
-- Your existing JSONB data will remain intact
-- You may need to manually update your application code to work with the old schema
