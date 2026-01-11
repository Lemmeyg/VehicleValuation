-- =====================================================
-- Create Vehicle Reports Storage Bucket
-- Migration: 20260111000000
-- Description: Creates the vehicle-reports storage bucket and RLS policies for PDF uploads
-- =====================================================

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Create the vehicle-reports bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-reports', 'vehicle-reports', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES FOR VEHICLE REPORTS
-- ============================================================================

-- Allow authenticated users to upload their own reports
CREATE POLICY "Users can upload their own vehicle reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow authenticated users to read their own reports
CREATE POLICY "Users can read their own vehicle reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow public read access for vehicle reports (since bucket is public)
CREATE POLICY "Anyone can read vehicle reports"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-reports');

-- Allow authenticated users to update their own reports
CREATE POLICY "Users can update their own vehicle reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow authenticated users to delete their own reports
CREATE POLICY "Users can delete their own vehicle reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can upload their own vehicle reports" ON storage.objects IS
  'Allows authenticated users to upload PDF reports to their own folder in vehicle-reports bucket';

COMMENT ON POLICY "Users can read their own vehicle reports" ON storage.objects IS
  'Allows authenticated users to read PDF reports from their own folder in vehicle-reports bucket';

COMMENT ON POLICY "Anyone can read vehicle reports" ON storage.objects IS
  'Allows public read access to vehicle reports (for sharing PDF links)';

COMMENT ON POLICY "Users can update their own vehicle reports" ON storage.objects IS
  'Allows authenticated users to update PDF reports in their own folder';

COMMENT ON POLICY "Users can delete their own vehicle reports" ON storage.objects IS
  'Allows authenticated users to delete PDF reports from their own folder';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- To verify the bucket was created, run:
--
-- SELECT id, name, public FROM storage.buckets WHERE id = 'vehicle-reports';
--
-- To verify the policies are working, run:
--
-- SELECT policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'storage'
-- AND tablename = 'objects'
-- AND policyname LIKE '%vehicle reports%';
