-- Flags a report as already enrolled in the abandoned-report recovery
-- sequence, so the daily cron never enrolls the same report twice. See
-- docs/superpowers/specs/2026-07-07-post-payment-ideal-experience-design.md
-- N2 and docs/superpowers/plans/2026-07-10-abandoned-report-recovery-emails.md.
--
-- Apply manually via the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS abandoned_recovery_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_reports_abandoned_recovery_candidates
  ON public.reports (created_at)
  WHERE price_paid IS NULL AND abandoned_recovery_sent_at IS NULL AND email IS NOT NULL;
