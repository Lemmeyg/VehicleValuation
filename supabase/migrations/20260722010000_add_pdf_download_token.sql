-- Adds an opaque token + 7-day expiry for the customer-facing secure PDF
-- download route (/api/reports/download/[token]), mirroring the existing
-- access_token pattern used for anonymous report-view access. See
-- docs/superpowers/specs/2026-07-22-secure-pdf-download-link-design.md.
--
-- Apply manually via the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS pdf_download_token UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pdf_download_token_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.reports.pdf_download_token IS
  'Opaque UUID token for the customer-facing PDF download route (/api/reports/download/[token]). Generated once when the PDF finishes generating.';

COMMENT ON COLUMN public.reports.pdf_download_token_expires_at IS
  'Expiry timestamp for pdf_download_token. Set to NOW() + 7 days at PDF generation. Enforced by application code, not by the underlying Supabase signed URL.';

NOTIFY pgrst, 'reload schema';
