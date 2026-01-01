# Clean Up Test Data

## Problem

You have ~20 test reports linked to `gordonlemmey@gmail.com` that already have a `user_id` set from previous tests. This prevents the magic link flow from working correctly because it only links reports where `user_id IS NULL`.

## Solution Options

### Option 1: Use a Different Email (Easiest)

For testing, use a **completely different email address** that hasn't been used before:
- `gordon.lemmey+test1@gmail.com`
- `gordon.lemmey+test2@gmail.com`
- `your.other.email@gmail.com`

Gmail treats `+` aliases as the same inbox, so you'll receive the email!

### Option 2: Clean Up Database (Recommended for continued testing)

Run this SQL in Supabase SQL Editor to reset your test reports:

```sql
-- Option A: Delete ALL reports for your test email
DELETE FROM reports WHERE email = 'gordonlemmey@gmail.com';

-- Option B: Reset reports to anonymous (keeps the data)
UPDATE reports
SET user_id = NULL
WHERE email = 'gordonlemmey@gmail.com';
```

**How to run:**
1. Go to: https://app.supabase.com → Your Project → SQL Editor
2. Paste one of the SQL commands above
3. Click "Run"

### Option 3: Delete Old Test Users

If you want to completely start fresh:

```sql
-- WARNING: This deletes users AND their reports
-- First, delete reports
DELETE FROM reports WHERE email = 'gordonlemmey@gmail.com';

-- Then delete user from auth.users (via Supabase Dashboard)
-- Go to: Authentication → Users → Find user → Delete
```

## For Production

This won't be an issue in production because:
1. Each user only creates reports once authenticated
2. Anonymous reports are only created once per email
3. The linking happens immediately during first authentication

## Recommended Test Flow

1. **Delete old test data:**
   ```sql
   DELETE FROM reports WHERE email = 'gordonlemmey@gmail.com';
   ```

2. **Delete old test user:**
   - Supabase Dashboard → Authentication → Users
   - Find `gordonlemmey@gmail.com`
   - Click "..." → Delete User

3. **Test the complete flow:**
   - Submit form with `gordonlemmey@gmail.com`
   - Click pricing tier
   - Click magic link in email
   - Should see: "Linked 1 reports to user" ✅

4. **For additional tests, use email aliases:**
   - `gordonlemmey+test1@gmail.com`
   - `gordonlemmey+test2@gmail.com`
   - etc.

---

## Why This Happens

When you test multiple times:
1. First test: Report created → user authenticates → report linked (user_id set)
2. Second test: New report created → **same user** authenticates → old reports already have user_id → 0 linked
3. The new report from step 2 gets linked, but old reports don't show in the count

**The fix:** Start with a clean slate for each test, or use different emails.

---

**Quickest solution:** Use `gordonlemmey+test@gmail.com` for your next test!
