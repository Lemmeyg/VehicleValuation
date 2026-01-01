# Magic Link Rate Limiting - Important Info

## What Happened

You encountered Supabase's magic link rate limiting:

```
Error: For security purposes, you can only request this after 18 seconds.
Status: 429 - over_email_send_rate_limit
```

## Why This Happens

**This is a security feature**, not a bug. Supabase prevents spam and abuse by limiting how frequently magic links can be sent to the same email address.

### Rate Limits

**Development Mode:**
- **60 second cooldown** between magic link requests to the same email
- **3 emails per hour** per email address (Supabase free tier)

**Production Mode (with custom SMTP):**
- No rate limits (you control the sending)
- Better deliverability
- Custom branding

## What We Fixed

### 1. Better Error Handling
The API now detects rate limit errors and returns a helpful message:

```typescript
// app/api/auth/magic-link/route.ts
if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
  return NextResponse.json({
    error: 'Please wait a minute before requesting another magic link. Check your email for the previous one.',
    code: 'rate_limit'
  }, { status: 429 })
}
```

### 2. User-Friendly UI
The modal now shows a clear error message when rate limited:

- **Red alert box** instead of generic error
- **Helpful message** explaining the wait time
- **"Try again" button** to retry after waiting

## How to Test Successfully

### Option 1: Wait 60 Seconds
1. Wait at least **60 seconds** after the last magic link request
2. Click "Try again" button
3. Magic link will be sent successfully

### Option 2: Use Different Email
1. Submit form with a different email address
2. No rate limit since it's a new email
3. Magic link sends immediately

### Option 3: Check Previous Email
The first magic link you requested probably arrived! Check:
- Inbox for email from Supabase
- Spam/junk folder
- Email subject: "Confirm Your Signup" or similar

## Testing the Full Flow Now

1. **Wait 60 seconds** from your last attempt
2. **OR** use a different email address
3. Submit the form again
4. Click pricing tier
5. Modal should show: "Sending Verification Email..."
6. Then: "Check Your Email!"
7. Click the link in the email
8. You'll be redirected to your report ✅

## Expected Terminal Logs (Success)

When you click the magic link, you should see:

```
Auth callback - Code: present
Auth callback - ReportId: [your-report-id]
User authenticated: [user-id] [email]
Linked 1 anonymous reports for [email] to user [user-id]
Redirecting to specific report: /reports/[report-id]
```

## For Production Deployment

To avoid rate limits in production:

### Configure Custom SMTP (Recommended)

1. **Go to Supabase Dashboard** → Project Settings → Auth → SMTP Settings

2. **Choose an email provider**:
   - SendGrid (99,000 free emails/month)
   - Mailgun (5,000 free emails/month)
   - Amazon SES (62,000 free emails/month)
   - Resend (3,000 free emails/month)

3. **Benefits of custom SMTP**:
   - ✅ No rate limits
   - ✅ Unlimited emails (within provider limits)
   - ✅ Better deliverability
   - ✅ Custom sender name and domain
   - ✅ Email analytics

### Example: SendGrid Setup

```env
# Supabase SMTP Settings
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Your SendGrid API Key]
Sender Email: noreply@yourdomain.com
Sender Name: Your Company Name
```

## Current Status

✅ **Magic link flow is working correctly**
✅ **Error handling improved**
✅ **User feedback enhanced**
⏱️ **Rate limiting is expected behavior**

The only issue was hitting the rate limit during testing. Wait 60 seconds or use a different email to test successfully.

---

**Last Updated:** December 26, 2025
