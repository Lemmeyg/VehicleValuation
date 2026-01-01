# Security Documentation

This document outlines the security architecture, policies, and best practices for the Vehicle Valuation SaaS application.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Admin Role Management](#admin-role-management)
3. [Authentication & Authorization](#authentication--authorization)
4. [Row Level Security (RLS)](#row-level-security-rls)
5. [Rate Limiting](#rate-limiting)
6. [Payment Security](#payment-security)
7. [Environment Variable Security](#environment-variable-security)
8. [Input Validation](#input-validation)
9. [Security Headers](#security-headers)
10. [Production Deployment Checklist](#production-deployment-checklist)
11. [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)

---

## Security Architecture

### Core Security Principles

1. **Defense in Depth**: Multiple layers of security (RLS, rate limiting, input validation, payment verification)
2. **Least Privilege**: Users and services only have access to what they need
3. **Secure by Default**: Development flags must be explicitly disabled in production
4. **Database-Level Security**: RLS policies enforce access control at the database layer
5. **Zero Trust**: All requests validated, even from authenticated users

### Security Layers

```
┌─────────────────────────────────────────────┐
│  1. Security Headers (HSTS, CSP, etc.)      │
├─────────────────────────────────────────────┤
│  2. Rate Limiting (IP-based, LRU cache)     │
├─────────────────────────────────────────────┤
│  3. Input Validation (VIN, email, ZIP)      │
├─────────────────────────────────────────────┤
│  4. Authentication (Supabase Auth)          │
├─────────────────────────────────────────────┤
│  5. Authorization (RLS Policies)            │
├─────────────────────────────────────────────┤
│  6. Payment Verification (LemonSqueezy)     │
├─────────────────────────────────────────────┤
│  7. Database Row Level Security             │
└─────────────────────────────────────────────┘
```

---

## Admin Role Management

### 🚨 CRITICAL: Admin Authentication

**SECURITY ISSUE RESOLVED**: Previous implementation stored admin status in `user_metadata.is_admin`, which is user-editable. This has been replaced with a secure database-backed system.

### How Admin Roles Work

Admin status is stored in the `public.admins` table, which:
- ✅ Only service role can write to (via RLS policies)
- ✅ Uses foreign key to `auth.users(id)` for referential integrity
- ✅ Tracks who granted admin access and when
- ✅ Cannot be modified by end users

### Granting Admin Access

**Method 1: Via Supabase SQL Editor** (Recommended)

```sql
-- Replace with the user's email
INSERT INTO public.admins (user_id, granted_by, notes)
SELECT id, id, 'Granted admin access via SQL'
FROM auth.users
WHERE email = 'newadmin@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

**Method 2: Via Service Role API** (Programmatic)

```typescript
import { supabaseAdmin } from '@/lib/db/supabase'

// Get user ID from email
const { data: user } = await supabaseAdmin.auth.admin.getUserByEmail(
  'newadmin@example.com'
)

if (user) {
  // Add to admins table
  await supabaseAdmin.from('admins').insert({
    user_id: user.id,
    granted_by: currentAdminUserId,
    notes: 'Granted via admin panel'
  })
}
```

### Revoking Admin Access

```sql
-- Remove admin access
DELETE FROM public.admins
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

### Checking Admin Status

**In Application Code:**

```typescript
import { isAdmin } from '@/lib/db/admin-auth'

const adminStatus = await isAdmin(userId)
if (adminStatus) {
  // User is admin
}
```

**In Database (RLS Policies):**

```sql
-- Use the is_admin() function
CREATE POLICY "Admins can view all contact messages"
ON public.contact_messages
FOR SELECT
USING (public.is_admin());
```

### Admin Table Schema

```sql
CREATE TABLE public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Authentication & Authorization

### Supabase Auth Configuration

**Supported Methods:**
- ✅ Email/Password authentication
- ✅ Magic link authentication
- ❌ OAuth providers (not configured)

### Email Validation

All email inputs are validated using `lib/utils/email-validator.ts`:

```typescript
import { getEmailValidationError, sanitizeEmail } from '@/lib/utils/email-validator'

const email = sanitizeEmail(rawEmail) // Trim + lowercase
const error = getEmailValidationError(email)
if (error) {
  return { error }
}
```

**Validation Rules:**
- Must match RFC-compliant email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Maximum length: 254 characters
- Automatically sanitized (trimmed, lowercased)

### Session Management

- **Session Duration**: 1 hour (default Supabase)
- **Refresh Token**: 30 days
- **Session Storage**: HTTP-only cookies (secure)
- **PKCE Flow**: Used for authentication

---

## Row Level Security (RLS)

### RLS Policy Overview

All tables have RLS enabled with policies enforcing access control:

| Table | Policy | Who Can Access |
|-------|--------|----------------|
| `reports` | Users can view own reports | Authenticated users (own reports only) |
| `reports` | Admins can view all reports | Admin users (via `is_admin()`) |
| `contact_messages` | Admins only | Admin users (via `is_admin()`) |
| `admins` | Service role only | No user access (service role only) |
| `payments` | Users can view own payments | Authenticated users (own payments only) |
| `api_call_logs` | Admins only | Admin users (via `is_admin()`) |

### Example RLS Policies

**Reports Table:**

```sql
-- Users can view their own reports
CREATE POLICY "Users can view own reports"
ON public.reports
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.reports
FOR SELECT
USING (public.is_admin());
```

**Admins Table:**

```sql
-- Only service role can insert admins
CREATE POLICY "Service role can insert admins"
ON public.admins
FOR INSERT
WITH CHECK (false); -- No users can insert via client

-- Only service role can delete admins
CREATE POLICY "Service role can delete admins"
ON public.admins
FOR DELETE
USING (false); -- No users can delete via client
```

### Testing RLS Policies

**Verify user cannot access other users' reports:**

```sql
-- As regular user (should return only own reports)
SELECT * FROM reports;

-- Should fail (no access to admins table)
SELECT * FROM admins;
```

**Verify admin can access all data:**

```sql
-- As admin user (should return all reports)
SELECT * FROM reports;

-- Should return contact messages
SELECT * FROM contact_messages;
```

---

## Rate Limiting

### Rate Limit Configuration

**Report Creation:**
- **Limit**: 1 report per user per 7 days
- **Identifier**: User ID (authenticated) or IP address (anonymous)
- **Implementation**: LRU cache with 7-day TTL
- **Bypass**: Set `DISABLE_RATE_LIMIT=true` (development only)

**Contact Form:**
- **Limit**: 3 submissions per IP per hour
- **Identifier**: IP address
- **Implementation**: LRU cache with 1-hour TTL

### How Rate Limiting Works

```typescript
import { checkRateLimit } from '@/lib/rate-limit'

const rateLimitResult = await checkRateLimit(userId, 'report_creation')

if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. You can create 1 report every 7 days.' },
    { status: 429 }
  )
}
```

### Rate Limit Storage

- **Technology**: LRU (Least Recently Used) cache
- **Storage**: In-memory (resets on server restart)
- **Production**: Consider Redis for persistent rate limiting across server instances

### Bypassing Rate Limits (Development Only)

**⚠️ WARNING: Never enable in production!**

```bash
# .env.local (development)
DISABLE_RATE_LIMIT=true
```

**Production Validation:** `lib/env.ts` throws error if `DISABLE_RATE_LIMIT=true` in production.

---

## Payment Security

### LemonSqueezy Webhook Security

**HMAC Signature Verification:**

Every webhook request is verified using HMAC-SHA256:

```typescript
import crypto from 'crypto'

const signature = request.headers.get('X-Signature')
const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!

const hmac = crypto.createHmac('sha256', secret)
hmac.update(rawBody)
const digest = hmac.digest('hex')

if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
  return new Response('Invalid signature', { status: 401 })
}
```

**Security Features:**
- ✅ Timing-safe signature comparison (prevents timing attacks)
- ✅ Raw body verification (no JSON parsing before validation)
- ✅ Webhook secret stored as environment variable
- ✅ 401 response on invalid signature

### Payment Validation

Reports require confirmed payment before PDF generation:

```typescript
import { validatePaymentStatus } from '@/lib/security/report-validation'

const { valid, error } = await validatePaymentStatus(reportId, userId)

if (!valid) {
  return NextResponse.json({ error }, { status: 403 })
}
```

**Validation Checks:**
- Report has `stripe_payment_id` or `lemon_squeezy_payment_id`
- Report has `price_paid` > 0
- User owns the report (userId matches)

### Payment Flow Security

```
1. User enters VIN → Anonymous report created (no pricing data)
2. User enters email → Redirects to LemonSqueezy checkout
3. Payment confirmed → LemonSqueezy webhook triggered
4. Webhook signature validated → Payment recorded
5. MarketCheck API called → Pricing data stored
6. PDF generated → User notified
```

**Security Controls:**
- Anonymous reports have no market data until payment
- Webhook validates signature before processing
- MarketCheck API only called after payment confirmation
- PDF generation requires payment validation

---

## Environment Variable Security

### Environment Variable Types

**Public (Client-Side):**
- Prefix: `NEXT_PUBLIC_*`
- Exposed to browser
- Examples: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL`

**Server-Side Only:**
- No prefix
- Never exposed to browser
- Examples: `SUPABASE_SERVICE_ROLE_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, API keys

### Production Environment Validation

The application validates production environment on startup:

```typescript
// lib/env.ts
export function validateProductionEnv(): void {
  if (NODE_ENV !== 'production') return

  const errors: string[] = []

  // Check dangerous development flags
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    errors.push('DISABLE_RATE_LIMIT must be false in production')
  }

  if (process.env.DISABLE_PAYMENT_CHECK === 'true') {
    errors.push('DISABLE_PAYMENT_CHECK must be false in production')
  }

  // Check required secrets
  if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    errors.push('LEMONSQUEEZY_WEBHOOK_SECRET is required')
  }

  if (errors.length > 0) {
    throw new Error(`❌ PRODUCTION VALIDATION FAILED:\n${errors.join('\n')}`)
  }
}
```

### Secure Environment Variable Practices

**✅ DO:**
- Use `.env.local` for local development (gitignored)
- Use Netlify environment variables for deployment
- Rotate API keys periodically
- Use separate keys for dev/staging/production
- Use service role key only server-side

**❌ DON'T:**
- Commit `.env.local` or `.env.production` to git
- Expose service role key to client
- Use production keys in development
- Share API keys in public repositories
- Log sensitive environment variables

### Required Environment Variables

See [.env.production.example](.env.production.example) for complete list.

**Critical Production Variables:**
```bash
NODE_ENV=production
DISABLE_RATE_LIMIT=false
DISABLE_PAYMENT_CHECK=false
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
LEMONSQUEEZY_API_KEY=your-live-api-key
MARKETCHECK_API_KEY=your-api-key
```

---

## Input Validation

### VIN Validation

**Implementation:** `lib/utils/vin-validator.ts`

**Validation Rules:**
- Exactly 17 characters (after sanitization)
- Alphanumeric only (I, O, Q excluded per VIN standard)
- Valid VIN checksum (9th digit)
- Sanitization: Remove spaces, convert to uppercase

**Example:**

```typescript
import { getVinValidationError, sanitizeVin } from '@/lib/utils/vin-validator'

const vin = sanitizeVin(rawVin) // Remove spaces, uppercase
const error = getVinValidationError(vin)
if (error) {
  return { error }
}
```

### ZIP Code Validation

**Rules:**
- Exactly 5 digits
- US ZIP codes only
- Numeric only

**Example:**

```typescript
import { getZipValidationError } from '@/lib/utils/zip-validator'

const error = getZipValidationError(zipCode)
if (error) {
  return { error }
}
```

### Mileage Validation

**Rules:**
- Positive integer
- Range: 0 - 999,999 miles
- Numeric only

### Email Validation

See [Authentication & Authorization](#authentication--authorization) section above.

---

## Security Headers

### Headers Configuration

All headers configured in `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    # Prevent clickjacking
    X-Frame-Options = "SAMEORIGIN"

    # Prevent MIME sniffing
    X-Content-Type-Options = "nosniff"

    # XSS protection
    X-XSS-Protection = "1; mode=block"

    # Referrer policy
    Referrer-Policy = "strict-origin-when-cross-origin"

    # Permissions policy
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

    # HSTS (force HTTPS)
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"

    # Content Security Policy
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com; ..."
```

### Content Security Policy (CSP)

**Current Policy:**

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://api.lemonsqueezy.com;
frame-ancestors 'self';
```

**⚠️ Note:** `'unsafe-inline'` and `'unsafe-eval'` are currently enabled for Next.js compatibility. Consider using nonces or hashes for stricter CSP.

### Verifying Security Headers

**Test in production:**

```bash
curl -I https://your-domain.com
```

**Expected Headers:**
```
HTTP/2 200
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains
content-security-policy: default-src 'self'; ...
```

---

## Production Deployment Checklist

### Pre-Deployment Verification

**Environment Variables:**
- [ ] `NODE_ENV=production`
- [ ] `DISABLE_RATE_LIMIT=false`
- [ ] `DISABLE_PAYMENT_CHECK=false`
- [ ] All API keys set (MarketCheck, Auto.dev, VinAudit)
- [ ] LemonSqueezy keys are **LIVE mode** (not test mode)
- [ ] `LEMONSQUEEZY_WEBHOOK_SECRET` matches production webhook
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `NEXT_PUBLIC_APP_URL` is production domain

**Database:**
- [ ] All migrations applied in correct order
- [ ] RLS enabled on all tables
- [ ] Admin user(s) added to `admins` table
- [ ] Test admin authentication (log in as admin)
- [ ] Verify RLS policies (user can't access other users' data)

**Security:**
- [ ] Security headers verified in Netlify
- [ ] CSP configured and tested
- [ ] Rate limiting enabled and tested
- [ ] Payment validation enabled (no bypass)
- [ ] Admin authentication uses `admins` table (not user_metadata)

**Payment Integration:**
- [ ] LemonSqueezy webhook URL configured: `https://your-domain.com/api/lemonsqueezy/webhook`
- [ ] Webhook secret matches production environment
- [ ] Test payment flow end-to-end
- [ ] Verify MarketCheck API is called after payment
- [ ] Verify PDF generation works

**Testing:**
- [ ] Run all unit tests: `npm run test:ci`
- [ ] Run type checking: `npm run type-check`
- [ ] Run linting: `npm run lint`
- [ ] Test report creation flow
- [ ] Test payment flow
- [ ] Test admin dashboard access

**Monitoring:**
- [ ] Google Analytics configured (if using)
- [ ] Error logging configured (Sentry or similar)
- [ ] API cost monitoring (MarketCheck usage)

### Post-Deployment Verification

**Immediately After Deployment:**
1. Visit production URL
2. Create test account
3. Create anonymous report (verify VIN validation)
4. Test payment flow (use test card if available)
5. Log in as admin (verify dashboard access)
6. Check security headers: `curl -I https://your-domain.com`
7. Verify no console errors in browser

**Week 1 Monitoring:**
- Monitor Netlify logs for errors
- Check Supabase auth logs
- Verify MarketCheck API usage
- Monitor rate limit hits
- Check payment success rate

---

## Reporting Security Vulnerabilities

### How to Report

If you discover a security vulnerability, please:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: loladev2026@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Varies by severity
  - Critical: 1-3 days
  - High: 1 week
  - Medium: 2 weeks
  - Low: 1 month

### Severity Levels

**Critical:**
- Remote code execution
- Authentication bypass
- Admin privilege escalation
- Payment fraud
- Data breach

**High:**
- SQL injection
- XSS (stored)
- CSRF
- Sensitive data exposure

**Medium:**
- XSS (reflected)
- Information disclosure
- Missing security headers
- Rate limit bypass

**Low:**
- Minor configuration issues
- Low-impact information disclosure

---

## Security Audit History

### Recent Security Improvements

**December 2025 - Production Hardening:**
- ✅ Fixed admin authentication vulnerability (user_metadata → admins table)
- ✅ Updated all RLS policies to use secure `is_admin()` function
- ✅ Added production environment validation
- ✅ Implemented email validation utility
- ✅ Added comprehensive rate limiting
- ✅ Configured security headers in Netlify
- ✅ Added payment validation checks
- ✅ Removed Stripe code (security surface reduction)
- ✅ Implemented API cost protection in tests

---

## Additional Resources

- **Supabase Security Best Practices**: https://supabase.com/docs/guides/auth/row-level-security
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Next.js Security**: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
- **LemonSqueezy Webhooks**: https://docs.lemonsqueezy.com/guides/developer-guide/webhooks

---

**Last Updated**: December 2025
**Security Contact**: loladev2026@gmail.com
**Version**: 1.0.0
