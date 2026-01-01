# Magic Link Testing Guide

**Date:** December 26, 2025
**Purpose:** Test the magic link email verification flow for anonymous report access

---

## What Was Fixed

The auth callback handler now properly handles Supabase's magic link tokens, which use a `token` parameter instead of an OAuth `code` parameter. This should fix the issue where clicking the email link redirected to the homepage instead of the report.

---

## Quick Test (5 minutes)

### Step 1: Clear Browser & Start Fresh
```bash
# Open incognito/private browser window
# Or clear cookies for localhost:3000
```

### Step 2: Submit Form
1. Go to `http://localhost:3000`
2. Fill in the hero form:
   - **Email:** Use a real email you can check
   - **VIN:** 1HGBH41JXMN109186
   - **Mileage:** 50000
   - **ZIP:** 07960
3. Click "Get My True Vehicle Value"

### Step 3: Select Pricing Tier
1. You'll be redirected to `/pricing` page
2. Click "Select Basic Report - $29"
3. Beta modal should appear with:
   - "Great News - This Report is FREE!"
   - "Sending Verification Email..." (initially)
   - Then changes to "Check Your Email!"
   - Shows your email address

### Step 4: Check Email & Click Link
1. Check your email inbox (and spam folder)
2. Look for email from Supabase
3. Click the magic link in the email

### Step 5: Verify Success ✅

**Expected Result:**
- You should be redirected to `/reports/{reportId}`
- You should see your vehicle valuation report
- You should be logged in (user session created)

**Terminal logs should show:**
```
Auth callback - Token: present
Auth callback - Type: magiclink
User authenticated via magic link: [user-id] [email]
Linked 1 anonymous reports for [email] to user [user-id]
Redirecting to: /reports/[report-id]
```

---

## If It Works ✅

Congratulations! The magic link flow is working correctly. You can now:
1. Close the testing guide
2. Test with multiple users if desired
3. Prepare for production deployment (see [MAGIC_LINK_IMPLEMENTATION.md](MAGIC_LINK_IMPLEMENTATION.md))

---

## If It Still Fails ❌

### Check Terminal Logs

Copy the terminal logs from when you clicked the email link and look for:

**Good signs:**
```
Auth callback - Token: present
Auth callback - Type: magiclink
User authenticated via magic link: ...
```

**Bad signs:**
```
Auth callback - Token: missing
No code provided, redirecting to home
```

**Error signs:**
```
Magic link verification error: ...
Error linking reports to user: ...
```

### Common Issues

#### Issue 1: Still Redirects to Homepage
**Logs show:** `Auth callback - Token: missing`

**Possible causes:**
1. Supabase redirect URL not configured correctly
2. Magic link URL format changed
3. Browser blocking cookies

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add redirect URL: `http://localhost:3000/api/auth/callback*` (with wildcard)
3. Check that Site URL is set to: `http://localhost:3000`
4. Try in different browser without ad blockers

#### Issue 2: "Invalid Link" Error
**Logs show:** `Magic link verification error: ...`

**Possible causes:**
1. Link expired (1 hour timeout)
2. Link already used
3. Supabase token format issue

**Solution:**
1. Request a new magic link (click "resend" in modal)
2. Click link within 1 hour
3. Don't click the same link twice

#### Issue 3: User Created But Report Not Linked
**Logs show:** `Error linking reports to user: ...`

**Possible causes:**
1. Email mismatch between report and user
2. RLS policy blocking admin update
3. Report already linked to different user

**Solution:**
1. Check terminal for specific linking error
2. Verify report email matches user email in logs
3. Check Supabase database:
   ```sql
   SELECT id, email, user_id FROM reports WHERE email = 'your-email@example.com';
   ```

---

## Debug Mode

If issues persist, add more detailed logging:

### 1. Check Magic Link URL Format

When you receive the email, **DON'T click the link yet**. Instead:
1. Right-click the link → Copy Link Address
2. Paste it into a text editor
3. Check if it contains:
   - `token=...`
   - `type=magiclink`
   - `next=/reports/...`

**Example expected URL:**
```
https://your-project.supabase.co/auth/v1/verify?token=abc123...&type=magiclink&redirect_to=http://localhost:3000/api/auth/callback?next=%2Freports%2F[report-id]
```

### 2. Test Manual Token Verification

If the URL looks correct, the issue might be in token verification. Check terminal for:
```
Magic link verification error: [specific error message]
```

### 3. Check Supabase Auth Logs

1. Go to Supabase Dashboard → Logs → Auth Logs
2. Filter for recent entries
3. Look for verification attempts and errors

---

## Contact Information

If you're still stuck after trying these steps, provide:
1. Terminal logs from clicking the magic link
2. The magic link URL format (with token redacted)
3. Any error messages from browser console
4. Supabase Auth Logs screenshots

---

## Next Steps After Successful Test

Once the flow works correctly:

1. **Production Configuration** (see [MAGIC_LINK_IMPLEMENTATION.md](MAGIC_LINK_IMPLEMENTATION.md)):
   - Update Supabase redirect URLs to production domain
   - Configure custom SMTP (optional but recommended)
   - Update environment variables

2. **Additional Testing:**
   - Test with multiple users
   - Test email resend functionality
   - Test expired link behavior
   - Test multiple reports per user

3. **User Experience:**
   - Customize email template in Supabase Dashboard
   - Add branding and logo
   - Improve email copy

---

**Last Updated:** December 26, 2025
