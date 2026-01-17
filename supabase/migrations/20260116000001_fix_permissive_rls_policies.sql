-- ============================================================================
-- Fix Permissive RLS Policies (Always True Warnings)
-- ============================================================================
-- This migration addresses Supabase linter warnings about RLS policies that
-- use WITH CHECK (true) for INSERT operations.
--
-- The warnings are for:
-- 1. api_call_logs - "Service role can insert api logs"
-- 2. contact_messages - "Anyone can insert contact messages" (duplicate)
-- 3. contact_messages - "Anyone can submit contact messages"
-- 4. payments - "Service role can insert payments"
-- 5. supplier_leads - "Anyone can create leads"
--
-- Analysis:
-- - Service role policies (api_call_logs, payments): Service role bypasses RLS
--   anyway, so these policies just document intent. We'll restrict to service_role.
-- - Public form policies (contact_messages, supplier_leads): These are intentionally
--   open for public forms. We'll add basic validation to prevent empty submissions.
--
-- Migration: 20260116000001_fix_permissive_rls_policies.sql
-- ============================================================================


-- ============================================================================
-- 1. Fix api_call_logs INSERT policy
-- ============================================================================
-- Service role bypasses RLS, but we can make the policy more explicit.
-- Regular users should not be able to insert API logs directly.

DROP POLICY IF EXISTS "Service role can insert api logs" ON public.api_call_logs;

-- Create a more restrictive policy - only service role can insert
-- Note: service_role bypasses RLS, but this documents the intent
-- and prevents anon/authenticated from inserting directly
CREATE POLICY "Only service role can insert api logs"
  ON public.api_call_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also add a policy for authenticated to see their own logs only
-- (already exists, just documenting)


-- ============================================================================
-- 2. Fix contact_messages INSERT policies (remove duplicates)
-- ============================================================================
-- There are two INSERT policies - consolidate into one with basic validation.

DROP POLICY IF EXISTS "Anyone can insert contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;

-- Create a single policy with basic validation
-- Validates that email and message are not empty
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate email is provided and looks like an email
    email IS NOT NULL
    AND length(trim(email)) > 0
    AND email ~ '^[^@]+@[^@]+\.[^@]+$'
    -- Validate message is provided
    AND message IS NOT NULL
    AND length(trim(message)) > 0
    -- Status must be 'unread' for new submissions
    AND (status IS NULL OR status = 'unread')
    -- admin_notes must be null for new submissions
    AND admin_notes IS NULL
  );


-- ============================================================================
-- 3. Fix payments INSERT policy
-- ============================================================================
-- Similar to api_call_logs - restrict to service role only.

DROP POLICY IF EXISTS "Service role can insert payments" ON public.payments;

-- Payments should only be created by the service role (via Stripe webhooks)
CREATE POLICY "Only service role can insert payments"
  ON public.payments
  FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ============================================================================
-- 4. Fix supplier_leads INSERT policy
-- ============================================================================
-- This is a public form, but we can add basic validation.

DROP POLICY IF EXISTS "Anyone can create leads" ON public.supplier_leads;

-- Create policy with basic validation
CREATE POLICY "Anyone can create leads"
  ON public.supplier_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate required fields are provided
    supplier_slug IS NOT NULL
    AND length(trim(supplier_slug)) > 0
    AND contact_name IS NOT NULL
    AND length(trim(contact_name)) > 0
    AND contact_email IS NOT NULL
    AND length(trim(contact_email)) > 0
    AND contact_email ~ '^[^@]+@[^@]+\.[^@]+$'
    AND message IS NOT NULL
    AND length(trim(message)) > 0
    -- Status must be 'new' for new leads
    AND (status IS NULL OR status = 'new')
    -- Source should be set by application
    AND (source IS NULL OR source IN ('directory_page', 'supplier_page', 'search', 'referral'))
    -- If user_id is provided, it must match the authenticated user
    AND (
      user_id IS NULL
      OR user_id = auth.uid()
    )
  );


-- ============================================================================
-- Migration Notes
-- ============================================================================
-- After this migration:
--
-- 1. api_call_logs: INSERT restricted to service_role
--    - Prevents regular users from inserting fake API logs
--
-- 2. contact_messages: Single INSERT policy with validation
--    - Requires valid email format
--    - Requires non-empty message
--    - Prevents setting admin_notes on insert
--    - Forces status to 'unread'
--
-- 3. payments: INSERT restricted to service_role
--    - Prevents users from creating fake payment records
--
-- 4. supplier_leads: INSERT with validation
--    - Requires valid email format
--    - Requires non-empty contact info and message
--    - Forces status to 'new'
--    - If user_id provided, must match authenticated user
--
-- The Supabase linter warnings should be resolved or reduced.
-- Some warnings may persist for service_role policies, which is acceptable
-- as service_role bypasses RLS anyway.
-- ============================================================================
