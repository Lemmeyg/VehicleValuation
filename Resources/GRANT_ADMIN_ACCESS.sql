-- =====================================================
-- GRANT ADMIN ACCESS
-- =====================================================
-- Run this script in Supabase SQL Editor to grant admin access
-- to your user account.
--
-- Instructions:
-- 1. Go to: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql
-- 2. Click "New Query"
-- 3. Copy and paste this entire file
-- 4. Update the email address below to match YOUR email
-- 5. Click "Run"
-- 6. Log out and log back in to the application
--
-- =====================================================

-- STEP 1: Find your user (replace with your actual email)
-- =====================================================
DO $$
DECLARE
    target_email TEXT := 'gordonlemmey@gmail.com';  -- ⚠️ UPDATE THIS EMAIL!
    user_record RECORD;
BEGIN
    -- Find the user
    SELECT * INTO user_record
    FROM auth.users
    WHERE email = target_email;

    -- Check if user exists
    IF NOT FOUND THEN
        RAISE NOTICE '❌ ERROR: User with email "%" not found!', target_email;
        RAISE NOTICE 'Available users:';
        FOR user_record IN
            SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 5
        LOOP
            RAISE NOTICE '  - %', user_record.email;
        END LOOP;
        RETURN;
    END IF;

    -- User exists, grant admin access
    RAISE NOTICE '✅ Found user: %', target_email;
    RAISE NOTICE 'User ID: %', user_record.id;

    -- Update user metadata to add admin flag
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
    WHERE id = user_record.id;

    RAISE NOTICE '✅ Admin access granted!';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: You must log out and log back in for changes to take effect.';
END $$;

-- =====================================================
-- STEP 2: Verify admin access was granted
-- =====================================================
SELECT
    email,
    created_at,
    raw_user_meta_data->>'is_admin' as is_admin_flag,
    CASE
        WHEN (raw_user_meta_data->>'is_admin')::boolean = true THEN '✅ YES - Admin rights granted'
        ELSE '❌ NO - Not an admin'
    END as admin_status,
    raw_user_meta_data
FROM auth.users
WHERE email = 'gordonlemmey@gmail.com'  -- ⚠️ UPDATE THIS EMAIL!
ORDER BY created_at DESC;

-- =====================================================
-- Alternative: List all current admins
-- =====================================================
-- Uncomment to see all users with admin access
/*
SELECT
    email,
    created_at,
    raw_user_meta_data->>'is_admin' as is_admin
FROM auth.users
WHERE (raw_user_meta_data->>'is_admin')::boolean = true
ORDER BY created_at DESC;
*/

-- =====================================================
-- Troubleshooting: If the above doesn't work
-- =====================================================
-- If you see errors, try this simpler version:
/*
UPDATE auth.users
SET raw_user_meta_data = '{"is_admin": true}'::jsonb
WHERE email = 'gordonlemmey@gmail.com';  -- ⚠️ UPDATE THIS EMAIL!
*/
