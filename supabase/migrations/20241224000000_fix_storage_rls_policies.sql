-- =====================================================
-- Fix RLS Policies for Admin Uploads
-- Migration: 20241224000000
-- Description: Adds RLS policies to allow authenticated admin users to upload files and manage articles
-- =====================================================

-- ============================================================================
-- ARTICLES TABLE RLS POLICIES FOR ADMIN USERS
-- ============================================================================

-- Allow authenticated admin users to insert articles
CREATE POLICY "Authenticated admin users can insert articles"
  ON articles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Allow authenticated admin users to update articles
CREATE POLICY "Authenticated admin users can update articles"
  ON articles FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Allow authenticated admin users to delete articles
CREATE POLICY "Authenticated admin users can delete articles"
  ON articles FOR DELETE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- ============================================================================
-- STORAGE RLS POLICIES FOR ADMIN USERS
-- ============================================================================

-- Knowledge Base: Allow authenticated admin users to upload files
CREATE POLICY "Authenticated admin users can upload knowledge base files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-base-content'
    AND auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Knowledge Base: Allow authenticated admin users to update files
CREATE POLICY "Authenticated admin users can update knowledge base files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'knowledge-base-content'
    AND auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Knowledge Base: Allow authenticated admin users to delete files
CREATE POLICY "Authenticated admin users can delete knowledge base files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-base-content'
    AND auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Authenticated admin users can insert articles" ON articles IS
  'Allows authenticated users with is_admin metadata to insert articles';

COMMENT ON POLICY "Authenticated admin users can update articles" ON articles IS
  'Allows authenticated users with is_admin metadata to update articles';

COMMENT ON POLICY "Authenticated admin users can delete articles" ON articles IS
  'Allows authenticated users with is_admin metadata to delete articles';

COMMENT ON POLICY "Authenticated admin users can upload knowledge base files" ON storage.objects IS
  'Allows authenticated users with is_admin metadata to upload files to knowledge-base-content bucket';

COMMENT ON POLICY "Authenticated admin users can update knowledge base files" ON storage.objects IS
  'Allows authenticated users with is_admin metadata to update files in knowledge-base-content bucket';

COMMENT ON POLICY "Authenticated admin users can delete knowledge base files" ON storage.objects IS
  'Allows authenticated users with is_admin metadata to delete files from knowledge-base-content bucket';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- To verify the policies are working, run:
--
-- SELECT policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'storage'
-- AND tablename = 'objects'
-- AND policyname LIKE '%knowledge base%';
--
-- You should see policies for both service_role and authenticated users
