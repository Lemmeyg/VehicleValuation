-- =====================================================
-- CRITICAL SECURITY FIX: Secure Admin Roles Table
-- =====================================================
-- This migration fixes the critical security vulnerability where
-- admin status was stored in user_metadata (user-editable).
--
-- Now admin status is stored in a secure database table that only
-- the service role can modify.
-- =====================================================

-- Create admins table (secure, not user-editable)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add helpful comment
COMMENT ON TABLE public.admins IS 'Secure admin roles table. Only service role can modify. Users can only check their own admin status.';

-- Enable Row Level Security
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can manage admins table (INSERT, UPDATE, DELETE)
CREATE POLICY "Service role can manage admins"
  ON public.admins FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Policy: Authenticated users can check if they're admin (read-only)
CREATE POLICY "Users can check own admin status"
  ON public.admins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Drop ALL existing is_admin() functions (there might be multiple overloads)
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(UUID);

-- Create new secure is_admin() function
-- This function checks the admins table instead of user_metadata
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = COALESCE(check_user_id, auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION public.is_admin IS 'Securely checks if a user is an admin by querying the admins table.';

-- Grant initial admin access
-- IMPORTANT: Replace with your actual admin email
INSERT INTO public.admins (user_id, granted_by, notes)
SELECT id, id, 'Initial admin user - granted during security migration'
FROM auth.users
WHERE email = 'loladev2026@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Log the migration
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.admins;
  RAISE NOTICE 'Secure admins table created successfully. Current admin count: %', admin_count;
END $$;
