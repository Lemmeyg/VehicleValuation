-- =====================================================
-- Create audit_submissions_backfill table + storage bucket
-- Migration: 20260923000000
-- Description: Epic 3 (Scanned Doc Agent validation) — minimal table for the
-- one-time backfill smoke test. Deliberately has no status/scan_status/findings
-- columns: Skip reviews submissions by reading this table and the bucket
-- directly. See docs/superpowers/specs/2026-09-22-scanned-doc-agent-epic3-validation-design.md
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_submissions_backfill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  matched_report_id uuid REFERENCES reports(id),
  file_storage_path text NOT NULL,
  file_mime_type text NOT NULL,
  note text,
  consent_ack boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_submissions_backfill IS
  'Epic 3 smoke-test submissions for the Scanned Doc Agent validation. No status/review workflow at this phase — reviewed by reading the table directly.';
COMMENT ON COLUMN audit_submissions_backfill.matched_report_id IS
  'Best-effort match against reports.email where price_paid > 0. Nullable — many submitters will not match.';

-- RLS: enabled, zero policies. supabaseAdmin (service role) bypasses RLS by
-- design and is the only writer/reader — every other role is denied by default.
ALTER TABLE audit_submissions_backfill ENABLE ROW LEVEL SECURITY;

-- Private bucket — never publicly readable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-submissions-backfill', 'audit-submissions-backfill', false)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policies for this bucket: same default-deny-except-service-role
-- reasoning as the table above.
