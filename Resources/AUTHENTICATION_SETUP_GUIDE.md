# Authentication Setup & Debugging Guide

This guide will help you configure Supabase authentication properly and resolve common issues.

---

## Issues Fixed ✅

1. **✅ Password visibility toggle** - Added eye icon to show/hide password on login and signup pages
2. **✅ Password reset functionality** - Created forgot password and reset password pages with API routes
3. **✅ Password reset link on login page** - Added "Forgot your password?" link

---

## Remaining Issues to Fix

### 1. Email Verification Not Working

**Problem**: Users not receiving verification emails after signup

**Root Cause**: Supabase email confirmation settings need to be configured

**Solution**:

#### Option A: Disable Email Confirmation (Development Only)

For local development and testing, you can disable email confirmation:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find "Confirm email" setting
4. **UNCHECK** "Enable email confirmations"
5. Click **Save**

**Note**: Users will be automatically logged in after signup without needing to verify email.

#### Option B: Configure Email Provider (Production)

For production, you should set up proper email delivery:

1. Go to **Authentication** → **Email Templates**
2. Configure SMTP settings:
   - Go to **Project Settings** → **Auth** → **SMTP Settings**
   - Choose a provider:
     - **Resend** (recommended, 3000 emails/month free)
     - **SendGrid**
     - **AWS SES**
     - **Custom SMTP**

3. Set up Resend (Recommended):

   ```
   - Sign up at https://resend.com
   - Get API key from dashboard
   - In Supabase:
     - SMTP Host: smtp.resend.com
     - Port: 465 or 587
     - Username: resend
     - Password: [your-resend-api-key]
     - Sender email: noreply@yourdomain.com (must be verified)
   ```

4. Test email delivery:
   - Create a test account
   - Check inbox and spam folder
   - Verify email links work correctly

---

### 2. Login Not Working - Supabase Configuration Issues

**Problem**: Cannot login with valid credentials

**Possible Causes**:

#### A. Incorrect Supabase Keys

Your `.env.local` file shows shortened keys that may be incomplete:

```env
NEXT_PUBLIC_SUPABASE_URL=https://noijdbkcwcivewzwznru.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_secret_ydNZDEDDgDjvr2d4vGu_Lw_HBli45ay  # ❌ Too short
SUPABASE_SERVICE_ROLE_KEY=Nk0DKEZzdbTLJXBr  # ❌ Way too short
```

**Solution**:

1. **Get the correct keys** from Supabase:
   - Go to your Supabase project: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru
   - Navigate to **Settings** → **API**
   - Copy the FULL keys:

   ```env
   # Project URL
   NEXT_PUBLIC_SUPABASE_URL=https://noijdbkcwcivewzwznru.supabase.co

   # anon/public key (should be ~300+ characters)
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....[full key here]

   # service_role key (should be ~300+ characters) - Keep this secret!
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....[full key here]
   ```

2. **Update your `.env.local`** file with the COMPLETE keys

3. **Restart your development server**:
   ```bash
   npm run dev
   ```

#### B. Database Not Initialized

**Check if database tables exist**:

1. Go to Supabase dashboard → **Table Editor**
2. Verify these tables exist:
   - `auth.users` (Supabase built-in)
   - `user_profiles`
   - `reports`
   - `payments`

3. If tables don't exist, run the setup SQL:
   ```bash
   # In Supabase SQL Editor, run:
   database-setup.sql
   ```

#### C. Row Level Security (RLS) Blocking Queries

**Check RLS policies**:

1. Go to **Authentication** → **Policies**
2. Verify policies exist for `user_profiles`, `reports`, `payments`
3. If policies are too restrictive, temporarily disable RLS for testing:
   ```sql
   -- In Supabase SQL Editor (for debugging only!)
   ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
   ```

**IMPORTANT**: Re-enable RLS after debugging:

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

---

## Testing Authentication Flow

### Test Signup

1. **Navigate to signup page**: http://localhost:3000/signup

2. **Create a test account**:
   - Email: `test@example.com`
   - Password: `testpassword123` (at least 8 characters)
   - Optional: Full name, Company

3. **Expected behavior**:
   - **If email confirmation is DISABLED**:
     - User is immediately logged in
     - Redirected to `/dashboard`
     - Session cookie is set

   - **If email confirmation is ENABLED**:
     - Success message: "Check your email"
     - Email sent to test@example.com
     - User must click link in email to activate account

4. **Check Supabase dashboard**:
   - Go to **Authentication** → **Users**
   - Verify user was created
   - Check `email_confirmed_at` field:
     - If `null` → Email confirmation pending
     - If has timestamp → Email confirmed, ready to login

---

### Test Login

1. **Navigate to login page**: http://localhost:3000/login

2. **Enter credentials**:
   - Email: `test@example.com`
   - Password: `testpassword123`

3. **Check password visibility**:
   - Click the eye icon → Password should become visible
   - Click again → Password should be hidden

4. **Submit login form**

5. **Expected behavior**:
   - **Success**: Redirect to `/dashboard` with session cookie set
   - **Error**: Display error message (check browser console for details)

6. **Debugging login issues**:

   **Open browser DevTools** (F12):

   a. **Network tab**:
   - Click login button
   - Look for `POST /api/auth/login` request
   - Check response:
     - `200 OK` → Login successful
     - `401 Unauthorized` → Invalid credentials or email not confirmed
     - `429 Too Many Requests` → Rate limit hit
     - `500 Server Error` → Backend issue (check server logs)

   b. **Console tab**:
   - Look for error messages
   - Check for Supabase client errors
   - Verify environment variables loaded correctly

   c. **Application tab** → **Cookies**:
   - Look for Supabase auth cookies:
     - `sb-<project-id>-auth-token`
     - `sb-<project-id>-auth-token-code-verifier`
   - If cookies exist → User is logged in
   - If no cookies → Login failed or session expired

---

### Test Password Reset

1. **Click "Forgot your password?"** on login page

2. **Enter email**: `test@example.com`

3. **Expected behavior**:
   - Success message: "Check your email"
   - Email sent with reset link (if email is configured)

4. **Check email** (or Supabase dashboard for testing):
   - Look for email with subject like "Reset Your Password"
   - Click the reset link
   - Should navigate to: `http://localhost:3000/reset-password?code=...`

5. **Enter new password**:
   - Click eye icon to verify password visibility works
   - Password must be at least 8 characters
   - Confirm password must match

6. **Submit**:
   - Success message: "Password reset successful"
   - Redirect to login page after 3 seconds

7. **Test new password**:
   - Login with new password
   - Should work successfully

---

## Common Errors & Solutions

### Error: "Invalid email or password"

**Possible causes**:

1. Email not confirmed (if email confirmation is enabled)
2. Incorrect password
3. User doesn't exist
4. Supabase keys are wrong

**Solutions**:

1. Check if email confirmation is required:
   - Supabase dashboard → **Authentication** → **Users**
   - Look at `email_confirmed_at` field
   - If `null`, user needs to confirm email

2. Verify user exists in Supabase dashboard

3. Double-check Supabase keys in `.env.local`

4. Try creating a new account to test signup flow

---

### Error: "Too many login attempts"

**Cause**: Rate limiting triggered (5 attempts per minute)

**Solution**:

- Wait 60 seconds and try again
- For testing, temporarily increase limit in `lib/rate-limit.ts`:

  ```typescript
  export const loginLimiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500,
  })

  // In API route, change:
  await loginLimiter.check(request, 100) // Increased from 5 to 100
  ```

---

### Error: "An unexpected error occurred"

**Cause**: Backend exception (500 error)

**Debugging steps**:

1. **Check server console** (terminal where `npm run dev` is running):
   - Look for error stack traces
   - Common errors:
     - `SUPABASE_URL is not defined`
     - `Invalid JWT token`
     - `Connection refused`

2. **Verify environment variables**:

   ```bash
   # In project root, create test-env.js:
   console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
   console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 50) + '...')

   # Run:
   node -r dotenv/config test-env.js
   ```

3. **Check Supabase dashboard logs**:
   - Go to **Logs** → **API**
   - Look for authentication-related errors
   - Check timestamp correlates with your login attempt

---

## Quick Fix Checklist

If authentication is completely broken, go through this checklist:

- [ ] **1. Verify Supabase keys are correct and COMPLETE**
  - Keys should be ~300+ characters
  - Copy from Supabase dashboard Settings → API
  - Paste full keys into `.env.local`
  - Restart dev server: `npm run dev`

- [ ] **2. Disable email confirmation (for testing)**
  - Supabase dashboard → Authentication → Providers → Email
  - Uncheck "Enable email confirmations"
  - Save

- [ ] **3. Run database setup**
  - Supabase dashboard → SQL Editor
  - Run `database-setup.sql`
  - Verify tables created

- [ ] **4. Create a fresh test account**
  - Go to http://localhost:3000/signup
  - Use: `test@example.com` / `Test12345678`
  - Should redirect to dashboard immediately

- [ ] **5. Test login**
  - Go to http://localhost:3000/login
  - Login with test account
  - Should redirect to dashboard

- [ ] **6. Check browser console for errors**
  - F12 → Console tab
  - Look for red error messages
  - Share errors if asking for help

- [ ] **7. Check server console for errors**
  - Terminal running `npm run dev`
  - Look for error stack traces
  - Share errors if asking for help

---

## Production Checklist

Before deploying to production:

- [ ] **Configure email provider** (Resend, SendGrid, etc.)
- [ ] **Enable email confirmations**
- [ ] **Set up custom email templates**
- [ ] **Configure redirect URLs** for production domain
- [ ] **Enable RLS on all tables**
- [ ] **Rotate Supabase keys** (never reuse development keys)
- [ ] **Set up proper logging** (Sentry, LogRocket, etc.)
- [ ] **Test all auth flows** on production domain
- [ ] **Set up monitoring** for failed login attempts
- [ ] **Configure CORS** properly

---

## Getting Help

If you're still experiencing issues:

1. **Check server logs**:

   ```bash
   # Terminal where dev server is running
   # Copy all error messages
   ```

2. **Check browser console**:

   ```
   F12 → Console tab
   Copy all error messages
   ```

3. **Verify Supabase project status**:
   - Dashboard → Project Health
   - Check for any outages or issues

4. **Test Supabase directly**:

   ```typescript
   // Create test-supabase.ts
   import { createClient } from '@supabase/supabase-js'

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   )

   async function test() {
     const { data, error } = await supabase.auth.signInWithPassword({
       email: 'test@example.com',
       password: 'Test12345678',
     })
     console.log('Result:', { data, error })
   }

   test()
   ```

5. **Share diagnostic info**:
   - Supabase project URL
   - Error messages (server + browser)
   - Steps to reproduce
   - Environment (dev/production)

---

## Next Steps

1. **Fix Supabase keys** in `.env.local` (most likely issue)
2. **Disable email confirmation** for testing
3. **Test signup flow** with new account
4. **Test login flow** with the account
5. **Test password visibility toggle** (eye icon)
6. **Test password reset flow**
7. **Configure email provider** for production

---

**Last Updated**: December 2024
