-- Migration: Allow Anonymous Payments
-- Date: 2026-03-31
-- Purpose: Make payments.user_id nullable to support anonymous purchases
--          where the buyer pays before creating an account.
--          The user_id is stamped later via /api/reports/[id]/claim.

-- Make user_id nullable
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;

-- Update the RLS policy for service_role inserts (no change needed — service role bypasses RLS)
-- Update comment to reflect new behaviour
COMMENT ON COLUMN public.payments.user_id IS 'Supabase auth user ID. NULL for anonymous purchases until the buyer claims their report via /api/reports/[id]/claim.';

NOTIFY pgrst, 'reload schema';
