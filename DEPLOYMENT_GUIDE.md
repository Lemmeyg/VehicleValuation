# Deployment & Production Readiness Guide

Complete guide to deploying the Vehicle Valuation SaaS to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Vercel Deployment](#vercel-deployment)
5. [Stripe Configuration](#stripe-configuration)
6. [Supabase Production Setup](#supabase-production-setup)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Security Hardening](#security-hardening)
10. [Performance Optimization](#performance-optimization)

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed
- [ ] No console.log statements in production code
- [ ] Error boundaries implemented
- [ ] Loading states added

### Testing
- [ ] All critical user flows tested
- [ ] Payment flow tested with test cards
- [ ] PDF generation tested
- [ ] Admin dashboard tested
- [ ] Mobile responsiveness verified

### Security
- [ ] Environment variables reviewed
- [ ] No secrets committed to git
- [ ] RLS policies enabled
- [ ] Admin authentication working
- [ ] CORS configured correctly

### Documentation
- [ ] README.md up to date
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Setup instructions verified

---

## Environment Setup

### Production Environment Variables

Create these in your hosting platform (Vercel, etc.):

```bash
# Supabase (Production)
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key

# Stripe (Live Mode)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Optional: API Keys (when ready)
VINAUDIT_API_KEY=your-key
AUTODEV_API_KEY=your-key
CARSXE_API_KEY=your-key
```

### Environment Variable Validation

The app automatically validates required environment variables on startup.
If any are missing, you'll see a clear error message.

---

## Database Migration

### Step 1: Export Development Data (Optional)

If you have test data to preserve:

```sql
-- Export reports
COPY (SELECT * FROM reports) TO '/tmp/reports.csv' CSV HEADER;

-- Export payments
COPY (SELECT * FROM payments) TO '/tmp/payments.csv' CSV HEADER;
```

### Step 2: Set Up Production Database

1. Create production Supabase project
2. Run `database-setup.sql` in SQL Editor
3. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';
   ```

### Step 3: Create Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Name: `vehicle-reports`
4. Public: YES
5. Click **Create bucket**

### Step 4: Apply RLS Policies

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('reports', 'payments');

-- Both should show rowsecurity = true
```

---

## Vercel Deployment

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/vehicle-valuation-saas.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Import your GitHub repository
4. Framework Preset: **Next.js**
5. Root Directory: `./`
6. Node.js Version: **18.x** or later

### Step 3: Configure Environment Variables

In Vercel project settings:

1. Click **Settings → Environment Variables**
2. Add all production environment variables
3. Set for: **Production, Preview, Development**
4. Click **Save**

### Step 4: Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-5 minutes)
3. Note your deployment URL

### Step 5: Add Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for propagation (~5-60 minutes)

---

## Stripe Configuration

### Step 1: Switch to Live Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle from **Test mode** to **Live mode**

### Step 2: Activate Account

If not already activated:

1. Click **Activate your account**
2. Provide business information
3. Add bank account details
4. Verify identity
5. Review and submit

### Step 3: Get Live API Keys

1. Go to **Developers → API keys**
2. Copy:
   - Publishable key (`pk_live_...`)
   - Secret key (`sk_live_...`)
3. Add to Vercel environment variables
4. Redeploy

### Step 4: Create Production Webhook

1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Description: "Production webhook for Vehicle Valuation SaaS"
5. Events to send:
   - [x] checkout.session.completed
   - [x] payment_intent.succeeded
   - [x] payment_intent.payment_failed
6. Click **Add endpoint**
7. Copy webhook signing secret (`whsec_...`)
8. Add to Vercel as `STRIPE_WEBHOOK_SECRET`
9. Redeploy

### Step 5: Test Live Webhook

```bash
# Use Stripe CLI to forward live webhooks
stripe listen --live --forward-to https://yourdomain.com/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed --live
```

### Step 6: Configure Payout Schedule

1. Go to **Settings → Payouts**
2. Set payout schedule (daily, weekly, monthly)
3. Verify bank account
4. Enable automatic payouts

---

## Supabase Production Setup

### Step 1: Review Database Performance

```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Step 2: Enable Connection Pooling

1. Go to **Settings → Database**
2. Enable **Connection Pooler**
3. Mode: **Transaction**
4. Use pooler connection string in high-traffic scenarios

### Step 3: Configure Storage

1. Go to **Storage → Settings**
2. Set file size limit: **10MB** (for PDFs)
3. Configure CORS if needed
4. Review storage usage periodically

### Step 4: Set Up Backups

1. Go to **Settings → Database**
2. Enable **Point-in-Time Recovery (PITR)**
3. Configure backup retention: **7 days** minimum
4. Test restore process

### Step 5: Enable Monitoring

1. Go to **Logs → Postgres Logs**
2. Enable slow query logging
3. Set threshold: **1000ms**
4. Review logs weekly

---

## Post-Deployment Verification

### Functional Tests

1. **User Sign Up**
   - [ ] New user can sign up
   - [ ] Email confirmation works
   - [ ] User redirected to dashboard

2. **Report Creation**
   - [ ] VIN validation works
   - [ ] Vehicle data fetched
   - [ ] Report created successfully

3. **Payment Flow**
   - [ ] Checkout session created
   - [ ] Stripe Checkout loads
   - [ ] Payment processes successfully
   - [ ] Webhook receives event
   - [ ] PDF generated automatically
   - [ ] User redirected to success page

4. **PDF Download**
   - [ ] PDF URL generated
   - [ ] PDF downloads successfully
   - [ ] PDF content correct

5. **Admin Dashboard**
   - [ ] Admin can log in
   - [ ] Dashboard loads
   - [ ] All pages accessible
   - [ ] Data displays correctly

### Performance Tests

```bash
# Test homepage load time
curl -o /dev/null -s -w 'Total: %{time_total}s\n' https://yourdomain.com

# Test API endpoint
curl -o /dev/null -s -w 'Total: %{time_total}s\n' https://yourdomain.com/api/reports/create
```

Target metrics:
- Homepage: < 2 seconds
- API endpoints: < 1 second
- PDF generation: < 10 seconds

### Security Tests

1. **HTTPS Verification**
   ```bash
   curl -I https://yourdomain.com | grep -i strict-transport-security
   ```

2. **Headers Check**
   - [ ] X-Frame-Options set
   - [ ] X-Content-Type-Options set
   - [ ] Content-Security-Policy set

3. **Authentication**
   - [ ] Unauthenticated users redirected
   - [ ] Admin pages require admin role
   - [ ] RLS policies enforced

---

## Monitoring & Alerts

### Vercel Analytics

1. Enable in **Settings → Analytics**
2. Monitor:
   - Page views
   - Performance metrics
   - Error rates

### Stripe Monitoring

1. Dashboard → **Developers → Events**
2. Monitor:
   - Successful payments
   - Failed payments
   - Webhook delivery status

3. Set up email alerts:
   - Failed webhooks
   - Disputed payments
   - Refund requests

### Supabase Monitoring

1. Dashboard → **Reports**
2. Monitor:
   - Database size
   - API requests
   - Storage usage
   - Concurrent connections

### Log Management

**Vercel Logs:**
```bash
# Install Vercel CLI
npm i -g vercel

# View logs
vercel logs https://yourdomain.com
```

**Supabase Logs:**
- **Postgres Logs**: Database queries
- **PostgREST Logs**: API requests
- **Auth Logs**: Authentication events

### Set Up Alerts

**Critical Alerts:**
- Webhook failures (Stripe)
- Database errors (Supabase)
- Payment failures
- PDF generation failures

**Warning Alerts:**
- Slow queries (> 1s)
- High error rates (> 5%)
- Storage approaching limit (> 80%)

---

## Security Hardening

### 1. Environment Variables

- [ ] No secrets in client-side code
- [ ] Service role key never exposed
- [ ] Webhook secret rotated quarterly
- [ ] API keys use minimum required permissions

### 2. Authentication

```typescript
// Ensure all protected routes check auth
const user = await getUser()
if (!user) redirect('/login')
```

### 3. RLS Policies

```sql
-- Verify all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### 4. Input Validation

- [ ] VIN format validated
- [ ] Email format validated
- [ ] Payment amounts validated
- [ ] User input sanitized

### 5. Rate Limiting

Implement in API routes:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'

export const ratelimit = new Ratelimit({
  redis: /* your redis instance */,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})
```

### 6. CORS Configuration

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
        ],
      },
    ]
  },
}
```

---

## Performance Optimization

### 1. Database Optimization

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_reports_user_id_status
ON reports(user_id, status)
WHERE status IN ('pending', 'completed');

-- Analyze tables
ANALYZE reports;
ANALYZE payments;

-- Vacuum tables
VACUUM ANALYZE reports;
VACUUM ANALYZE payments;
```

### 2. Caching Strategy

**Static Pages:**
- Homepage
- Pricing page
- Documentation

**Revalidate:**
```typescript
export const revalidate = 3600 // 1 hour
```

**Dynamic Pages:**
- User dashboard
- Admin dashboard
- Report details

### 3. Image Optimization

Use Next.js Image component:

```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={50}
  priority
/>
```

### 4. Code Splitting

Lazy load heavy components:

```typescript
import dynamic from 'next/dynamic'

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  loading: () => <p>Loading...</p>,
  ssr: false
})
```

### 5. Bundle Size

```bash
# Analyze bundle
npm run build

# Check bundle size
npx @next/bundle-analyzer
```

---

## Production Monitoring Dashboard

### Key Metrics to Track

**Business Metrics:**
- Total revenue
- Conversion rate
- Average order value
- Customer lifetime value
- Daily active users

**Technical Metrics:**
- API response times
- Error rates
- Webhook delivery success
- PDF generation time
- Database query performance

**Operational Metrics:**
- Supabase storage usage
- Database size
- Concurrent connections
- Stripe webhook failures

### Recommended Tools

**Free:**
- Vercel Analytics
- Stripe Dashboard
- Supabase Dashboard
- Google Analytics

**Paid (Optional):**
- Sentry (Error tracking)
- LogRocket (Session replay)
- Datadog (APM)
- PagerDuty (Alerts)

---

## Rollback Plan

### If Deployment Fails

**Vercel:**
1. Go to **Deployments**
2. Find last working deployment
3. Click **⋯** → **Promote to Production**

**Database:**
```sql
-- Restore from backup
-- Contact Supabase support or use PITR
```

**Stripe:**
1. Revert to previous webhook endpoint
2. Use test mode temporarily
3. Fix issues in staging

---

## Launch Checklist

### Final Pre-Launch

- [ ] All environment variables set
- [ ] Database migrated and tested
- [ ] Storage bucket configured
- [ ] Stripe live mode enabled
- [ ] Webhooks configured and tested
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Admin user created
- [ ] Test payment completed successfully
- [ ] PDF generation working
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Error tracking enabled

### Launch Day

- [ ] Announce launch
- [ ] Monitor error rates
- [ ] Watch webhook delivery
- [ ] Check database performance
- [ ] Monitor Stripe Dashboard
- [ ] Test user flows
- [ ] Have rollback plan ready

### First Week

- [ ] Daily error log review
- [ ] Payment success rate monitoring
- [ ] User feedback collection
- [ ] Performance optimization
- [ ] Database query optimization
- [ ] User onboarding improvements

---

## Support Contacts

**Hosting:**
- Vercel Support: support@vercel.com
- Vercel Discord: discord.gg/vercel

**Database:**
- Supabase Support: support@supabase.io
- Supabase Discord: discord.supabase.com

**Payments:**
- Stripe Support: support.stripe.com
- Stripe Phone: Available in dashboard

**Emergency:**
- On-call engineer: [your-number]
- Backup contact: [backup-number]

---

## Conclusion

This guide covers everything needed to deploy the Vehicle Valuation SaaS to production. Follow each section carefully and check off items as you complete them.

**Remember:**
- Test thoroughly before going live
- Have a rollback plan ready
- Monitor closely after launch
- Gather user feedback quickly
- Iterate based on data

Good luck with your launch! 🚀
