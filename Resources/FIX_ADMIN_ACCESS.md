# Fix Admin Access - Step-by-Step Guide

## Problem
When trying to access `/admin`, you're being redirected to `/login` then `/dashboard`. This happens because your user account doesn't have admin privileges set.

## Solution: Grant Admin Access via Supabase

### **Step 1: Open Supabase SQL Editor**

1. Go to your Supabase Dashboard:
   - URL: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru
   - Or login at: https://supabase.com/dashboard

2. Click **"SQL Editor"** in the left sidebar

3. Click **"New Query"** button (top right)

---

### **Step 2: Run the Admin Grant Script**

1. **Option A: Use the Ready-Made Script** ⭐ Recommended

   - Open the file: `GRANT_ADMIN_ACCESS.sql` in this directory
   - **IMPORTANT:** Update the email address on line 26:
     ```sql
     target_email TEXT := 'gordonlemmey@gmail.com';  -- Change to YOUR email!
     ```
   - Copy the ENTIRE contents of the file
   - Paste into Supabase SQL Editor
   - Click **"Run"** (bottom right corner)

2. **Option B: Quick Single Command**

   If you prefer a simpler approach, just run this:
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
   WHERE email = 'gordonlemmey@gmail.com';
   ```

   **Note:** Replace `gordonlemmey@gmail.com` with your actual email address!

---

### **Step 3: Verify Admin Access Was Granted**

Run this query to check:

```sql
SELECT
    email,
    created_at,
    raw_user_meta_data->>'is_admin' as is_admin_flag,
    CASE
        WHEN (raw_user_meta_data->>'is_admin')::boolean = true THEN '✅ YES - Admin'
        ELSE '❌ NO - Not admin'
    END as admin_status
FROM auth.users
WHERE email = 'gordonlemmey@gmail.com'  -- Your email here!
ORDER BY created_at DESC;
```

**Expected Result:**
| email | is_admin_flag | admin_status |
|-------|---------------|--------------|
| gordonlemmey@gmail.com | true | ✅ YES - Admin |

---

### **Step 4: Log Out and Log Back In**

This is **CRITICAL** - the session must be refreshed:

1. **In your browser:**
   - Go to http://localhost:3000
   - Click your profile or settings
   - Click "Log Out"

2. **Clear cookies (optional but recommended):**
   - Press `F12` to open Developer Tools
   - Go to "Application" tab
   - Click "Cookies" → "http://localhost:3000"
   - Right-click → "Clear"

3. **Log back in:**
   - Go to http://localhost:3000/login
   - Enter your credentials
   - Click "Sign In"

---

### **Step 5: Test Admin Access**

1. After logging back in, navigate to:
   ```
   http://localhost:3000/admin
   ```

2. **Expected Result:** ✅ You should see the Admin Dashboard

3. **If still redirected:** Check the terminal logs for `[ADMIN_CHECK]` messages

---

## Debugging

### Check Terminal Logs

After logging in and trying to access `/admin`, look for these console logs:

```
[ADMIN_CHECK] User admin status: {
  userId: 'your-uuid-here',
  email: 'gordonlemmey@gmail.com',
  isAdmin: true,    ← Should be true!
  userMetadata: { is_admin: true }  ← Should have this!
}
```

### If `isAdmin: false` appears:

1. **Check email spelling** - Make sure you updated the correct email in the SQL
2. **Verify in database:**
   ```sql
   SELECT email, raw_user_meta_data
   FROM auth.users
   WHERE email = 'gordonlemmey@gmail.com';
   ```
3. **Try the force update:**
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = '{"is_admin": true}'::jsonb
   WHERE email = 'gordonlemmey@gmail.com';
   ```

### If still having issues:

1. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C in terminal)
   # Start again
   npm run dev
   ```

2. **Check Supabase service role key:**
   ```bash
   cd "c:\Users\Gordo\Documents\Vehicle Comparison Site\vehicle-valuation-saas"
   cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY
   ```
   Should show: `SUPABASE_SERVICE_ROLE_KEY=Nk0DKEZzdbTLJXBr`

3. **Verify user exists:**
   ```sql
   SELECT id, email, created_at
   FROM auth.users
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## Alternative: Use Supabase Dashboard UI

If SQL doesn't work, try the UI method:

1. Go to **Authentication** → **Users** in Supabase
2. Find your user (gordonlemmey@gmail.com)
3. Click on the user row
4. Scroll to **"Raw User Meta Data"** section
5. Click **"Edit"**
6. Change from `{}` to:
   ```json
   {
     "is_admin": true
   }
   ```
7. Click **"Save"**
8. Log out and log back in

---

## Understanding the Fix

### What the SQL does:

1. Finds your user account by email
2. Updates the `raw_user_meta_data` column in `auth.users` table
3. Adds `{"is_admin": true}` to your user metadata
4. The app checks this flag when you visit `/admin`

### How admin check works:

```typescript
// In lib/db/admin-auth.ts
const isAdmin = user.user.user_metadata?.is_admin === true
```

If `user_metadata.is_admin` is not exactly `true`, you're redirected to dashboard.

---

## Quick Reference

### Grant admin:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'your-email@example.com';
```

### Remove admin (if needed):
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_admin'
WHERE email = 'your-email@example.com';
```

### List all admins:
```sql
SELECT email, created_at
FROM auth.users
WHERE (raw_user_meta_data->>'is_admin')::boolean = true
ORDER BY created_at DESC;
```

---

## Summary

✅ **What you need to do:**

1. Run SQL in Supabase SQL Editor to grant admin access
2. Log out completely from the app
3. Log back in
4. Navigate to http://localhost:3000/admin
5. Should work!

⚠️ **Common mistakes:**
- Forgetting to update the email address in the SQL
- Not logging out after running the SQL
- Using the wrong email address
- Not restarting the dev server

---

**Need more help?**

Check the `[ADMIN_CHECK]` logs in your terminal - they'll show exactly what's happening with your admin status!
