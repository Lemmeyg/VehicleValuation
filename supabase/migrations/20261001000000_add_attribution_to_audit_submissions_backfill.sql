-- =====================================================
-- Add channel + page-version tags to audit_submissions_backfill
-- Migration: 20261001000000
-- Description: Workstream 7 (comps-upload loop). Records which channel sent each
-- submission (utm_campaign → source), which email/link version (utm_content) and
-- which page wording (page_variant, the copy-slot payload version), so Supabase —
-- the ground truth — can split uploads by experiment. All nullable/defaulted:
-- safe to apply before or after the code ships.
-- See docs/plans/2026-10-01-ws7-comps-upload-loop-harness.md (workspace repo).
-- =====================================================

ALTER TABLE audit_submissions_backfill
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS page_variant text NOT NULL DEFAULT 'default';

COMMENT ON COLUMN audit_submissions_backfill.source IS
  'Channel that sent the visitor (the link''s utm_campaign, e.g. comps_check_outreach); ''direct'' when absent.';
COMMENT ON COLUMN audit_submissions_backfill.utm_content IS
  'Email/link version (the link''s utm_content). Nullable.';
COMMENT ON COLUMN audit_submissions_backfill.page_variant IS
  'Version of the /comps-check wording shown (comps-check-copy flag payload version); ''default'' = built-in copy.';
