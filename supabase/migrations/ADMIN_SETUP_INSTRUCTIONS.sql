-- Instructions: How to Grant Admin Access to Users
-- ================================================
-- After running the contact_messages migration, you need to grant admin access to specific users.
-- There are two ways to do this in Supabase:

-- METHOD 1: Update User Metadata (Recommended for Supabase Auth)
-- ---------------------------------------------------------------
-- This updates the user's metadata to include an admin role.
-- Replace 'YOUR-USER-ID-HERE' with the actual UUID of your admin user.

-- To find your user ID, run:
-- SELECT id, email FROM auth.users;

-- Then update the user's metadata:
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'your-admin-email@example.com';  -- Replace with your admin email

-- Verify the change:
SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'your-admin-email@example.com';


-- METHOD 2: Alternative - Use a Simple Admin Emails List
-- --------------------------------------------------------
-- If you prefer a simpler approach, you can modify the RLS policies to check against
-- a hardcoded list of admin emails. This is less flexible but easier to set up.

-- Example: Update the policies to use email-based checking
-- (This would require re-running the migration with modified policies)

-- DROP POLICY "Only admins can read contact messages" ON contact_messages;
-- CREATE POLICY "Only admins can read contact messages"
--   ON contact_messages
--   FOR SELECT
--   TO authenticated
--   USING (
--     auth.email() IN ('admin1@example.com', 'admin2@example.com')
--   );


-- METHOD 3: Create a Separate admins Table (For Production Apps)
-- ---------------------------------------------------------------
-- For production apps with multiple roles, create a dedicated table:

-- CREATE TABLE IF NOT EXISTS admins (
--   user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   granted_at TIMESTAMPTZ DEFAULT NOW(),
--   granted_by UUID REFERENCES auth.users(id)
-- );
--
-- -- Add your admin user
-- INSERT INTO admins (user_id)
-- SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com';
--
-- -- Update policies to check the admins table
-- DROP POLICY "Only admins can read contact messages" ON contact_messages;
-- CREATE POLICY "Only admins can read contact messages"
--   ON contact_messages
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
--   );


-- TESTING YOUR ADMIN ACCESS
-- -------------------------
-- After granting admin access, test it by:

-- 1. Log in as the admin user in your app
-- 2. Navigate to /admin/contact-messages
-- 3. You should see the contact messages page

-- If you get "permission denied" errors, check:
-- - Is the user logged in?
-- - Does the user's metadata contain role: "admin"?
-- - Are the RLS policies enabled on the contact_messages table?

-- To debug, you can temporarily check who you're logged in as:
-- SELECT auth.uid(), auth.email();
