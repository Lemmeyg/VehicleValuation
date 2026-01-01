# Deployment Guide

Complete guide for deploying the Vehicle Valuation SaaS application to Netlify with dev/staging/production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Strategy](#environment-strategy)
3. [Netlify Setup](#netlify-setup)
4. [Environment Variables](#environment-variables)
5. [Branch Strategy](#branch-strategy)
6. [Deployment Process](#deployment-process)
7. [Verification](#verification)
8. [Rollback](#rollback)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ GitHub repository with code pushed
- ✅ Netlify account (free tier works)
- ✅ Supabase project created and configured
- ✅ LemonSqueezy account with products created
- ✅ API keys for all external services:
  - VinAudit API key
  - Auto.dev API key
  - MarketCheck API key
- ✅ All critical security fixes applied (Phase 1 complete)

---

## Environment Strategy

This application uses a **three-tier deployment strategy**:

| Environment | Branch | Purpose | Flags |
|------------|--------|---------|-------|
| **Production** | `main` | Live site for real users | `DISABLE_RATE_LIMIT=false`<br>`DISABLE_PAYMENT_CHECK=false` |
| **Staging** | `staging` | Pre-production testing | `DISABLE_RATE_LIMIT=true`<br>`DISABLE_PAYMENT_CHECK=true` |
| **Development** | `dev` | Feature development | `DISABLE_RATE_LIMIT=true`<br>`DISABLE_PAYMENT_CHECK=true` |

### Why Three Environments?

- **Development**: Test new features without affecting staging
- **Staging**: Final testing before production with production-like settings
- **Production**: Live environment with full security enabled

---

## Netlify Setup

### Step 1: Create Netlify Sites

You'll create **three separate Netlify sites** (one per environment):

1. **Go to Netlify Dashboard**: https://app.netlify.com
2. **Click "Add new site" → "Import an existing project"**
3. **Connect to GitHub** and select your repository

**Create three sites**:

#### Production Site
- **Site name**: `vehicle-valuation-production` (or your domain)
- **Branch to deploy**: `main`
- **Build command**: `npm run build`
- **Publish directory**: `.next`

#### Staging Site
- **Site name**: `vehicle-valuation-staging`
- **Branch to deploy**: `staging`
- **Build command**: `npm run build`
- **Publish directory**: `.next`

#### Development Site
- **Site name**: `vehicle-valuation-dev`
- **Branch to deploy**: `dev`
- **Build command**: `npm run build`
- **Publish directory**: `.next`

### Step 2: Install Netlify CLI (Optional)

For easier management:

```bash
npm install -g netlify-cli
netlify login
netlify link
```

---

## Environment Variables

### Critical Environment Variables

Each Netlify site needs these environment variables configured:

#### Required for All Environments

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LemonSqueezy
LEMONSQUEEZY_API_KEY=your-api-key
LEMONSQUEEZY_STORE_ID=your-store-id
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID=variant-id
NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID=variant-id

# API Providers
VINAUDIT_API_KEY=your-key
AUTODEV_API_KEY=your-key
MARKETCHECK_API_KEY=your-key

# App URL (unique per environment)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Production-Specific

```bash
NODE_ENV=production
DISABLE_RATE_LIMIT=false
DISABLE_PAYMENT_CHECK=false
```

#### Staging/Dev-Specific

```bash
NODE_ENV=production  # or development for dev
DISABLE_RATE_LIMIT=true
DISABLE_PAYMENT_CHECK=true
```

### How to Add Environment Variables in Netlify

**Via Netlify Dashboard**:

1. Go to **Site Settings** → **Environment Variables**
2. Click **Add a variable**
3. Choose the appropriate scope:
   - **All deployments**: For constants like API keys
   - **Production deployments only**: For `DISABLE_RATE_LIMIT=false`
   - **Deploy Preview deployments only**: For dev flags

**Via Netlify CLI**:

```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://xxx.supabase.co"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-key" --secret
```

**Pro Tip**: Use `.env.production.example`, `.env.staging.example`, `.env.development.example` as reference guides.

---

## Branch Strategy

### Creating Branches

If you don't have `staging` and `dev` branches yet:

```bash
# Create staging branch from main
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging

# Create dev branch from staging
git checkout staging
git checkout -b dev
git push -u origin dev
```

### Branch Protection Rules (Recommended)

In GitHub repository settings:

1. **Main Branch**:
   - Require pull request reviews before merging
   - Require status checks to pass (tests)
   - Do not allow force pushes

2. **Staging Branch**:
   - Require pull request reviews (optional)
   - Require status checks to pass

3. **Dev Branch**:
   - No restrictions (for rapid development)

### Workflow

```
dev → staging → main
  ↓       ↓       ↓
  Dev   Staging  Production
```

**Example workflow**:

1. **Develop** new feature on `feature/new-feature` branch
2. **Merge** to `dev` → Auto-deploys to dev site
3. **Test** on dev site → Create PR to `staging`
4. **Merge** to `staging` → Auto-deploys to staging site
5. **Final test** on staging → Create PR to `main`
6. **Merge** to `main` → Auto-deploys to production

---

## Deployment Process

### Initial Deployment

1. **Ensure all migrations are applied**:
   ```bash
   # Run in Supabase SQL Editor
   # See supabase/migrations/ directory
   ```

2. **Configure webhook URLs** in LemonSqueezy:
   ```
   Production: https://your-domain.com/api/lemonsqueezy/webhook
   Staging: https://staging.netlify.app/api/lemonsqueezy/webhook
   Dev: https://dev.netlify.app/api/lemonsqueezy/webhook
   ```

3. **Push to branches**:
   ```bash
   git push origin dev
   git push origin staging
   git push origin main
   ```

4. **Verify builds** in Netlify dashboard

### Subsequent Deployments

**For new features**:

```bash
# 1. Create feature branch from dev
git checkout dev
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "Add new feature"

# 3. Push and create PR to dev
git push -u origin feature/my-feature

# 4. Merge to dev (auto-deploys)
```

**For production releases**:

```bash
# 1. Merge dev → staging
git checkout staging
git merge dev
git push origin staging

# 2. Test on staging site

# 3. Merge staging → main (via PR for safety)
git checkout main
git merge staging
git push origin main
```

---

## Verification

### Post-Deployment Checklist

After each deployment, verify:

#### Functional Tests

- [ ] Homepage loads correctly
- [ ] User can sign up/login
- [ ] VIN validation works
- [ ] Report creation works (end-to-end)
- [ ] Payment flow works (LemonSqueezy)
- [ ] PDF generation works
- [ ] Admin dashboard accessible (admin users only)

#### Security Tests

- [ ] Security headers present (check browser DevTools → Network)
- [ ] HTTPS redirects working
- [ ] Rate limiting active (production only)
- [ ] Payment validation active (production only)
- [ ] Admin authentication secure (check with non-admin user)

#### API Tests

- [ ] VinAudit API working
- [ ] Auto.dev API working
- [ ] MarketCheck API working
- [ ] Supabase connection working

### Using Browser DevTools

**Check security headers**:

1. Open DevTools (F12)
2. Go to Network tab
3. Reload page
4. Click on document request
5. Check Response Headers:
   ```
   x-frame-options: SAMEORIGIN
   x-content-type-options: nosniff
   strict-transport-security: max-age=31536000; includeSubDomains
   content-security-policy: ...
   ```

**Check environment**:

Open browser console and check:
```javascript
// Should be your production domain
console.log(window.location.origin)
```

---

## Rollback

### Emergency Rollback

If production has a critical issue:

**Option 1: Netlify Dashboard (Instant)**

1. Go to **Deploys** tab
2. Find last working deployment
3. Click **Publish deploy**

**Option 2: Git Revert**

```bash
# Find the bad commit
git log --oneline

# Revert it
git revert <commit-hash>
git push origin main
```

**Option 3: Branch Rollback**

```bash
# Reset to previous good state
git checkout main
git reset --hard <good-commit-hash>
git push --force origin main  # Use with caution!
```

### Rollback Database Migrations

If a migration caused issues:

```sql
-- Check applied migrations
SELECT * FROM supabase_migrations.schema_migrations;

-- Manually revert changes (no automatic down migrations)
-- See migration file for what to undo
```

---

## Troubleshooting

### Build Fails

**Error: Missing environment variables**

```bash
# Check env vars are set in Netlify dashboard
# Verify .env.production.example has all required vars
```

**Error: TypeScript errors**

```bash
# Run locally first
npm run build

# Fix all TypeScript errors before deploying
```

**Error: Next.js build fails**

```bash
# Clear .next directory and rebuild
rm -rf .next
npm run build
```

### Runtime Errors

**500 Error on API routes**

- Check Netlify function logs: **Site → Functions → [function name]**
- Verify environment variables are set correctly
- Check Supabase connection

**Supabase connection fails**

- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (server-side only)
- Check Supabase project is not paused

**Rate limit not working**

- Check `DISABLE_RATE_LIMIT` is `false` in production
- Verify environment variable is set in Netlify (not just in code)

**Payment validation bypassed**

- Check `DISABLE_PAYMENT_CHECK` is `false` in production
- Verify `lib/env.ts` validation is running (check server logs)

### Performance Issues

**Slow page loads**

- Check Netlify CDN is working (should see `x-nf-request-id` header)
- Enable Netlify image optimization
- Check for large bundle sizes: `npm run build` and review output

**API calls timing out**

- Check external API status (VinAudit, Auto.dev, MarketCheck)
- Increase timeout in fetch calls if needed
- Add retry logic for transient failures

---

## Security Best Practices

### Production Checklist

Before going live:

- [ ] All security migrations applied (`supabase/migrations/`)
- [ ] Admin users configured in `admins` table (not user_metadata)
- [ ] `DISABLE_RATE_LIMIT=false` in production
- [ ] `DISABLE_PAYMENT_CHECK=false` in production
- [ ] HTTPS enforced (Netlify does this automatically)
- [ ] Security headers configured (check `netlify.toml`)
- [ ] API keys rotated if leaked during development
- [ ] Webhook secrets unique per environment
- [ ] Service role key kept secret (never in client code)

### Monitoring

**Set up monitoring**:

1. **Netlify Analytics**: Enable in site settings (paid)
2. **Sentry** (optional): Error tracking for production
3. **Google Analytics**: Track user behavior
4. **Supabase Logs**: Monitor database queries

**What to monitor**:

- Error rates (Sentry or Netlify functions)
- API call costs (MarketCheck especially - $0.09/call)
- Payment success rate (LemonSqueezy dashboard)
- User signup/login failures
- Rate limit hits (should be rare in production)

---

## Advanced Topics

### Custom Domains

1. **Buy domain** (e.g., NameCheap, Google Domains)
2. **Add to Netlify**:
   - Go to **Domain Settings** → **Add custom domain**
   - Follow DNS configuration instructions
3. **Enable HTTPS**: Automatic with Let's Encrypt

### Continuous Integration

Add GitHub Actions for automated testing:

```yaml
# .github/workflows/test.yml
name: Test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test:ci
```

### Database Backups

**Supabase automatic backups**:
- Free tier: Daily backups (7-day retention)
- Pro tier: Point-in-time recovery

**Manual backup**:
```bash
# Export using Supabase CLI
supabase db dump -f backup.sql
```

---

## Support

**Need help?**

- Netlify Docs: https://docs.netlify.com
- Supabase Docs: https://supabase.com/docs
- LemonSqueezy Docs: https://docs.lemonsqueezy.com
- Project README: `README.md`
- Security Guide: `SECURITY.md`

---

**Last Updated**: January 2025
**Version**: 1.0
