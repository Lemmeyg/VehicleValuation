-- BL-62: reconcile the reports.status CHECK constraint with the values the code
-- actually writes.
--
-- The original constraint (20241210000000_initial_schema.sql) only allowed
-- 'draft', 'pending', 'completed', 'failed'. Since then the LemonSqueezy webhook
-- has written 'vin_decode_failed' (a paid report whose VIN cannot be decoded) with
-- no migration to match, and BL-62 adds 'valuation_failed' (the vehicle-data
-- provider returned no valuation at all, so we halt before shipping a $0 report).
-- Both are legitimate terminal states for a report that needs manual handling
-- (refund + hand-built report), not delivery.
--
-- Whether the original constraint is still enforced on the live table is unknown
-- (this table has a history of silently-dropped CHECKs), so DROP ... IF EXISTS
-- then ADD is safe either way.
--
-- If the ADD CONSTRAINT step fails, it means a row already holds a status value
-- not in the list below — inspect `SELECT DISTINCT status FROM public.reports`
-- and widen the list (or fix the row) before re-running.
--
-- Apply manually via the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_status_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN (
    'draft',
    'pending',
    'completed',
    'failed',
    'vin_decode_failed',
    'valuation_failed'
  ));

NOTIFY pgrst, 'reload schema';
