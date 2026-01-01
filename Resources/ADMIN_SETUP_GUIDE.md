# Admin Setup & Database Fix Guide

## Issue Summary

You're seeing the rate limit because:
1. ❌ The `user_profiles` table doesn't exist in your Supabase database
2. ❌ Admin rights aren't set in your user's `user_metadata`
3. ✅ The code was already correct, but needs the database setup

---

## Solution: 3-Step Process

### Step 1: Create user_profiles Table

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of this file:
   ```
   vehicle-valuation-saas/supabase/migrations/20241216000001_add_user_profiles.sql
   ```
5. Click **Run** (bottom right)
6. Verify success message

**Option B: Using Local Migration**

If you have Supabase CLI installed:
```bash
cd vehicle-valuation-saas
supabase db push
```

---

### Step 2: Set Your Admin Rights

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New Query**
3. Copy and paste the entire contents of this file:
   ```
   vehicle-valuation-saas/SET_ADMIN_USER.sql
   ```
4. Click **Run**
5. Check the results - you should see:
   ```
   admin_status: "YES - Admin rights granted"
   is_admin_flag: "true"
   ```

**Alternative Method (Using Auth UI):**

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Find user: `gordonlemmey@gmail.com`
3. Click on the user
4. Scroll to **User Metadata** section
5. Click **Edit**
6. Add or merge:
   ```json
   {
     "is_admin": true
   }
   ```
7. Click **Save**

---

### Step 3: Verify & Test

**Check Console Logs:**

After restarting your dev server, when you create a report, you should see:

```
[ADMIN_CHECK] User admin status: {
  userId: 'your-uuid',
  email: 'gordonlemmey@gmail.com',
  isAdmin: true,
  userMetadata: { is_admin: true }
}

[RATE_LIMIT_CHECK] {
  userId: 'your-uuid',
  email: 'gordonlemmey@gmail.com',
  isAdmin: true,
  disableRateLimit: true,
  willCheckRateLimit: false
}
```

**Test Report Creation:**

1. Navigate to homepage
2. Enter a VIN
3. Click pricing tier
4. **Expected**: Report creates immediately (no rate limit error)

---

## Files Created/Updated

### New Files:
1. ✅ `vehicle-valuation-saas/supabase/migrations/20241216000001_add_user_profiles.sql`
   - Creates `user_profiles` table
   - Sets up RLS policies
   - Creates trigger to auto-create profiles on signup
   - Backfills existing users

2. ✅ `vehicle-valuation-saas/SET_ADMIN_USER.sql`
   - Sets admin rights for gordonlemmey@gmail.com
   - Includes verification queries

### Updated Files:
3. ✅ `vehicle-valuation-saas/lib/db/auth.ts`
   - Fixed `getUserProfile()` to use `.maybeSingle()`
   - Added fallback to `auth.users` data if profile doesn't exist
   - Prevents errors when user_profiles table is missing

---

## Understanding the Auth System

### How Admin Rights Work

Admin status is stored in **Supabase Auth's user_metadata**, not in a database table:

```
auth.users
├── id: uuid
├── email: string
├── raw_user_meta_data: jsonb  ← Admin flag stored here
│   └── { "is_admin": true }
└── ...
```

The code checks this with:
```typescript
const isAdmin = user.user_metadata?.is_admin === true
```

### How User Profiles Work

User profiles provide extended data beyond auth:

```
public.user_profiles
├── id: uuid (references auth.users.id)
├── email: string
├── full_name: string
└── created_at, updated_at
```

**Why separate?**
- `auth.users`: Managed by Supabase Auth (authentication)
- `user_profiles`: Your custom data (names, preferences, etc.)

---

## Database Schema Overview

After running the migration, your database will have:

```
public.reports
├── id (uuid, primary key)
├── user_id (references auth.users)
├── vin (varchar)
├── vehicle_data (jsonb)
├── status (text)
└── ...

public.user_profiles  ← NEW
├── id (uuid, references auth.users)
├── email (text)
├── full_name (text)
└── created_at, updated_at

public.payments
├── id (uuid)
├── report_id (references reports)
├── user_id (references auth.users)
└── ...
```

---

## Troubleshooting

### "relation public.user_profiles does not exist"

**Cause**: Step 1 wasn't completed
**Fix**: Run the migration SQL in Supabase SQL Editor

### Still seeing rate limit after setting admin

**Check these:**

1. **Restart dev server** - Environment variables are loaded once
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear browser cache** - Stale session might be cached
   ```
   Ctrl+Shift+R (hard refresh)
   ```

3. **Verify admin flag in database**:
   ```sql
   SELECT email, raw_user_meta_data->>'is_admin'
   FROM auth.users
   WHERE email = 'gordonlemmey@gmail.com';
   ```

4. **Check console logs** - Look for `[ADMIN_CHECK]` and `[RATE_LIMIT_CHECK]` outputs

### Profile fetch errors

If you see "Cannot coerce to single JSON object":

**Already fixed!** The code now uses `.maybeSingle()` and falls back to auth.users data.

---

## Quick Reference

### Set Admin via SQL (copy-paste ready)

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'gordonlemmey@gmail.com';
```

### Check Admin Status

```sql
SELECT
  email,
  raw_user_meta_data->>'is_admin' as is_admin,
  CASE
    WHEN (raw_user_meta_data->>'is_admin')::boolean = true THEN 'Admin'
    ELSE 'Regular User'
  END as role
FROM auth.users
WHERE email = 'gordonlemmey@gmail.com';
```

### Remove Admin Rights (if needed)

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_admin'
WHERE email = 'gordonlemmey@gmail.com';
```

---

## Summary

**What was wrong:**
1. Missing `user_profiles` table in database
2. Admin rights not set in `user_metadata`
3. Code was calling `.single()` instead of `.maybeSingle()`

**What's now fixed:**
1. ✅ Created migration to set up `user_profiles` table
2. ✅ Created SQL script to set admin rights
3. ✅ Updated `getUserProfile()` to handle missing profiles
4. ✅ Code already has proper logging for debugging

**Next steps:**
1. Run the migration SQL in Supabase SQL Editor
2. Run the admin setup SQL
3. Restart dev server
4. Test creating reports (should work without rate limit)

---

## Production Notes

### Before Deploying:

1. **Run migrations** in production Supabase project
2. **Set admin users** via SQL or Auth dashboard
3. **Set `DISABLE_RATE_LIMIT=false`** (or remove) in production env
4. **Test rate limit** with non-admin account

### Managing Admin Users:

**Add admin:**
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'new-admin@example.com';
```

**List all admins:**
```sql
SELECT email, created_at
FROM auth.users
WHERE raw_user_meta_data->>'is_admin' = 'true';
```

---

**Need help?** Check the console logs for `[ADMIN_CHECK]` and `[RATE_LIMIT_CHECK]` output to see exactly what's happening.
