# Admin Access Debugging Guide

This guide will help you debug and fix admin access issues on your staging/production environment.

## 🔍 Problem

You're logged in with admin credentials but get redirected to `/dashboard` when accessing `/admin`.

## 🎯 Root Cause

Based on the code analysis, here are the most likely causes:

### 1. **User Not in `admins` Table** (Most Likely)

The app uses a secure `admins` table to control access (not user metadata). If your user isn't in this table, you'll be denied access.

**How the admin check works:**
1. [app/admin/layout.tsx:13](app/admin/layout.tsx#L13) calls `checkIsAdmin()`
2. [lib/db/admin-auth.ts:69-78](lib/db/admin-auth.ts#L69-L78) gets current user
3. [lib/db/admin-auth.ts:17-45](lib/db/admin-auth.ts#L17-L45) queries `admins` table
4. If user not found → redirected to `/dashboard`

### 2. Migration Not Applied to Staging

The `admins` table might not exist in your staging database if you haven't run migrations.

### 3. Authentication Cookie Issues

Cookies might not be properly set/read in the Netlify staging environment.

## 🛠️ Diagnostic Steps

### Step 1: Check Environment Variables

Verify your staging environment has these variables set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://noijdbkcwcivewzwznru.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**On Netlify:**
1. Go to: Site settings → Environment variables
2. Verify all three are set
3. Redeploy if you made changes

### Step 2: Verify Migration Applied

Check if the `admins` table exists in your database:

**Option A: Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/editor
2. Look for `public.admins` table in the sidebar
3. If missing, run the migration (see Step 3)

**Option B: Using the diagnostic script (local)**
```bash
npm run admin:check
```

### Step 3: Apply Migration (if needed)

If the `admins` table doesn't exist:

**Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql/new
2. Copy contents of: `supabase/migrations/20260101000000_secure_admin_roles.sql`
3. Paste and run it
4. Verify table was created

**OR use Supabase CLI:**
```bash
# Make sure you're connected to the right project
supabase link --project-ref noijdbkcwcivewzwznru

# Apply all pending migrations
supabase db push
```

### Step 4: Check If You're in the Admins Table

**Option A: Diagnostic script (local)**
```bash
# Check specific user
npm run admin:check loladev2026@gmail.com
```

**Option B: Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/editor
2. Open `public.admins` table
3. Look for your user_id
4. If not found, proceed to Step 5

### Step 5: Grant Admin Access

**Option A: Using the script (local)**
```bash
npm run admin:grant loladev2026@gmail.com
```

**Option B: Supabase SQL Editor**
1. Go to: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql/new
2. Run this SQL (replace with your email):

```sql
INSERT INTO public.admins (user_id, notes)
SELECT id, 'Admin access granted manually'
FROM auth.users
WHERE email = 'loladev2026@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
```

3. Verify:
```sql
SELECT
  a.user_id,
  u.email,
  a.granted_at,
  a.notes
FROM public.admins a
JOIN auth.users u ON u.id = a.user_id;
```

### Step 6: Test Access

1. **Clear cookies** (important!)
   - Open DevTools → Application → Cookies
   - Delete all cookies for your staging domain

2. **Log out and back in**
   - This ensures fresh session with admin permissions

3. **Navigate to /admin**
   - Should now work!

## 🔧 Advanced Debugging

### Check Server Logs

Add temporary logging to see what's happening:

**Edit [lib/db/admin-auth.ts:69-78](lib/db/admin-auth.ts#L69-L78):**

```typescript
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const user = await getUser()
    console.log('[DEBUG] checkIsAdmin - user:', user?.id, user?.email)

    if (!user) {
      console.log('[DEBUG] No user found')
      return false
    }

    const result = await isAdmin(user.id)
    console.log('[DEBUG] isAdmin result:', result)
    return result
  } catch (error) {
    console.error('[DEBUG] checkIsAdmin error:', error)
    return false
  }
}
```

Check logs in Netlify:
1. Go to: Deploys → [Latest deploy] → Functions
2. Look for `[DEBUG]` messages

### Verify Cookies in Staging

Check that authentication cookies are being set:

1. Open staging site
2. Log in
3. Open DevTools → Application → Cookies
4. Look for:
   - `sb-[project-ref]-auth-token`
   - `sb-[project-ref]-auth-token-code-verifier`

If missing, there's a cookie setting issue (might be SameSite/Secure attributes).

### Check RLS Policies

Verify the `admins` table has correct RLS policies:

```sql
-- Should show 2 policies
SELECT * FROM pg_policies WHERE tablename = 'admins';

-- Expected:
-- 1. "Service role can manage admins" (ALL to service_role)
-- 2. "Users can check own admin status" (SELECT to authenticated)
```

## 📝 Quick Checklist

- [ ] Environment variables set in Netlify
- [ ] Migration applied (`admins` table exists)
- [ ] User exists in `auth.users`
- [ ] User exists in `public.admins`
- [ ] Cleared cookies and re-logged in
- [ ] Tried accessing `/admin` again

## 🚨 Still Not Working?

### Nuclear Option: Reset Everything

1. **Clear all sessions**
```sql
-- In Supabase SQL Editor
DELETE FROM auth.sessions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'loladev2026@gmail.com'
);
```

2. **Re-grant admin**
```sql
DELETE FROM public.admins WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'loladev2026@gmail.com'
);

INSERT INTO public.admins (user_id, notes)
SELECT id, 'Admin re-granted after reset'
FROM auth.users
WHERE email = 'loladev2026@gmail.com';
```

3. **Force redeploy on Netlify**
   - Trigger redeploy → Deploy settings → Clear cache and redeploy

4. **Test with incognito window**
   - Ensures no cached cookies

## 📞 Support

If still stuck, check:
- Server logs in Netlify Functions
- Browser console for errors
- Network tab for failed API calls to Supabase

## 🔐 Security Notes

- Never hardcode admin emails in code
- Always use the `admins` table (never `user_metadata`)
- Only service role can modify `admins` table
- Regular users can only check their own admin status

---

## Related Files

- Admin layout: [app/admin/layout.tsx](app/admin/layout.tsx)
- Admin auth logic: [lib/db/admin-auth.ts](lib/db/admin-auth.ts)
- Migration: [supabase/migrations/20260101000000_secure_admin_roles.sql](supabase/migrations/20260101000000_secure_admin_roles.sql)
- Diagnostic script: [scripts/check-admin-status.ts](scripts/check-admin-status.ts)
- Grant admin script: [scripts/grant-admin.ts](scripts/grant-admin.ts)
