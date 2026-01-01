-- =====================================================
-- CRITICAL SECURITY FIX: Contact Messages RLS Policies
-- =====================================================
-- This migration fixes the insecure RLS policies on the
-- contact_messages table that were using user_metadata
-- (which is user-editable).
--
-- Now uses the secure is_admin() function that checks
-- the admins table instead.
-- =====================================================

-- Drop old insecure policies that used user_metadata
DROP POLICY IF EXISTS "Only admins can read contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Only admins can update contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Only admins can delete contact messages" ON public.contact_messages;

-- Create new secure policies using admins table
CREATE POLICY "Only admins can read contact messages"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Only admins can update contact messages"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete contact messages"
  ON public.contact_messages FOR DELETE TO authenticated
  USING (public.is_admin());

-- Allow anyone (including anonymous users) to insert contact messages
-- This is intentional - we want users to be able to submit contact forms
CREATE POLICY "Anyone can insert contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Contact messages RLS policies updated to use secure is_admin() function';
END $$;
