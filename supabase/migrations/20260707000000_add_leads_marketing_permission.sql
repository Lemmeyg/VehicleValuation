-- Adds marketing_permission to the leads table. All captured leads (dispute
-- letter downloads, form submissions, purchases) are marked as
-- marketing-permitted per current business decision — see
-- docs/superpowers/specs/2026-07-07-leads-marketing-permission-design.md.
-- NOT NULL DEFAULT true backfills all existing rows in the same statement.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS marketing_permission BOOLEAN NOT NULL DEFAULT true;
