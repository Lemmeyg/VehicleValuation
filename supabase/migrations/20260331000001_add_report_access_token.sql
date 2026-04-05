-- Migration: Add access_token columns for anonymous report access
-- Date: 2026-03-31
-- Purpose: Store a UUID token and 24-hour expiry on anonymous reports so
--          buyers can view their report via a token URL without signing in.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.reports.access_token IS
  'UUID token for anonymous report access. NULL for authenticated reports. Generated once at report creation.';

COMMENT ON COLUMN public.reports.access_token_expires_at IS
  'Expiry timestamp for access_token. Set to NOW() + 24 hours at creation. NULL for authenticated reports.';

NOTIFY pgrst, 'reload schema';
