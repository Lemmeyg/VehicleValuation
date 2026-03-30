-- Add pdf_storage_path column to reports table.
-- Stores the Supabase Storage path (e.g. reports/{user_id}/total-loss-report-2019-Honda-Civic.pdf)
-- so the API can generate fresh signed URLs without relying on a potentially-stale public URL.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
