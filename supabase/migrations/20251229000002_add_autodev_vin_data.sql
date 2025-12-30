-- Add Auto.dev VIN Decode Support
-- Migration: 20251229000002_add_autodev_vin_data.sql
-- Date: 2024-12-29
--
-- Changes:
-- - Add autodev_vin_data JSONB column to reports table
-- - Store complete VIN decode response from Auto.dev API

-- =============================================
-- ADD AUTODEV VIN DATA COLUMN
-- =============================================

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS autodev_vin_data JSONB;

-- =============================================
-- ADD COLUMN DOCUMENTATION
-- =============================================

COMMENT ON COLUMN reports.autodev_vin_data IS 'Auto.dev VIN decode data including:
- vin, vinValid, wmi, checkDigit, checksum, origin
- make, model, trim, style, body, type
- engine, drive, transmission
- vehicle: {vin, year, make, model, manufacturer}
- generatedAt: ISO timestamp
Stored for future use as supplementary vehicle data.';

-- =============================================
-- MIGRATION NOTES
-- =============================================

-- This column stores the complete Auto.dev VIN decode API response
-- It supplements the existing vehicle_data from VinAudit
-- Provides additional specifications and validation data
--
-- Structure:
-- {
--   "vin": "1HGCM82633A123456",
--   "vinValid": true,
--   "wmi": "1HG",
--   "checkDigit": "3",
--   "checksum": true,
--   "origin": "United States",
--   "make": "Honda",
--   "model": "Civic",
--   "trim": "EX",
--   "style": "4dr Sedan",
--   "body": "Sedan",
--   "type": "Passenger Car",
--   "engine": "2.0L I4 DOHC 16V",
--   "drive": "FWD",
--   "transmission": "CVT",
--   "ambiguous": false,
--   "vehicle": {
--     "vin": "1HGCM82633A123456",
--     "year": 2020,
--     "make": "Honda",
--     "model": "Civic",
--     "manufacturer": "Honda Motor Company"
--   },
--   "generatedAt": "2024-12-29T12:34:56.000Z"
-- }
