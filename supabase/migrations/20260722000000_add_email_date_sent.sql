-- Records when report-delivery info (link, vehicle year/make/model) was sent
-- to Zoho Campaigns for this report, so it is only ever sent once. Mirrors
-- the existing abandoned_recovery_sent_at pattern. See
-- docs/superpowers/specs/2026-07-22-report-delivery-zoho-automation-design.md.
--
-- Apply manually via the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS email_date_sent timestamptz;
