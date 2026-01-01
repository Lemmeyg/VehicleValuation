-- =====================================================
-- Verify Storage Policies for Content Management
-- =====================================================
-- Run this query to check if storage policies exist

-- Check all storage policies for your buckets
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname ILIKE '%knowledge%'
    OR policyname ILIKE '%supplier%'
  )
ORDER BY policyname;

-- Expected results:
-- You should see 8 policies total:
-- 1. Anyone can read knowledge base files (SELECT)
-- 2. Service role can upload knowledge base files (INSERT)
-- 3. Service role can update knowledge base files (UPDATE)
-- 4. Service role can delete knowledge base files (DELETE)
-- 5. Anyone can read supplier files (SELECT)
-- 6. Service role can upload supplier files (INSERT)
-- 7. Service role can update supplier files (UPDATE)
-- 8. Service role can delete supplier files (DELETE)
