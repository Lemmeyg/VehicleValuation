-- Tracks whether a dispute_letter lead has been successfully enrolled in the
-- Zoho Campaigns "Dispute Letter Nurture" list. Set by the synchronous call
-- in app/api/dispute-letter/route.ts on success, or by the backstop cron
-- (/api/cron/dispute-letter-recovery) for anything the sync call missed. See
-- docs/superpowers/plans/2026-07-13-dispute-letter-leads-backstop-cron.md.
--
-- Apply manually via the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS dispute_letter_zoho_enrolled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_dispute_letter_recovery_candidates
  ON public.leads (created_at)
  WHERE lead_type = 'dispute_letter' AND dispute_letter_zoho_enrolled_at IS NULL;
