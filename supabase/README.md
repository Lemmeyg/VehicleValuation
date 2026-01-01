# Supabase Database Setup

This directory contains SQL migrations for the Vehicle Valuation SaaS database schema.

## Quick Start

### Option 1: Apply Migrations via Supabase Dashboard (Recommended for MVP)

1. Go to your Supabase project dashboard: https://app.supabase.com/
2. Navigate to **SQL Editor** in the left sidebar
3. Apply migrations in order:

#### Step 1: Apply Initial Schema
- Click **New Query**
- Copy contents of `migrations/20241210000000_initial_schema.sql`
- Paste and click **Run**
- ✅ Verify: 5 tables created (reports, payments, refund_requests, api_call_logs, user_profiles)

#### Step 2: Apply RLS Policies
- Click **New Query**
- Copy contents of `migrations/20241210000001_rls_policies.sql`
- Paste and click **Run**
- ✅ Verify: RLS enabled on all tables with policies

### Option 2: Apply via Supabase CLI (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

---

## Database Schema Overview

### Tables

1. **reports** - Vehicle valuation reports
   - Stores VIN, vehicle data, accident details, valuation results
   - Links to user via `user_id`
   - Tracks payment and PDF generation status

2. **payments** - Stripe payment transactions
   - Records all payment attempts
   - Links to reports and users
   - Immutable audit log

3. **refund_requests** - Money-back guarantee claims
   - Requires ACV report and settlement documentation
   - Auto-validates settlement amount
   - Admin approval workflow

4. **api_call_logs** - External API usage tracking
   - Tracks calls to VinAudit, Auto.dev, CarsXE
   - Cost tracking per call
   - Performance monitoring

5. **user_profiles** - Extended user information
   - Supplements `auth.users`
   - Auto-created on signup
   - Stores name, company, preferences

---

## Security (Row Level Security)

All tables have RLS enabled with the following policies:

### Reports
- ✅ Users can view/create/update their own reports
- ❌ Users cannot delete reports (audit trail)

### Payments
- ✅ Users can view their own payments
- ✅ Service role can insert payments (webhooks)
- ❌ No updates/deletes (immutable)

### Refund Requests
- ✅ Users can view/create their own requests
- ✅ Users can update pending requests (upload docs)
- ❌ Admin actions via service role only

### API Call Logs
- ✅ Users can view logs for their reports
- ✅ Service role can insert logs
- ❌ Read-only for users

### User Profiles
- ✅ Users can view/update their own profile
- ✅ Auto-created on signup

---

## Verification Steps

After applying migrations, verify your setup:

### 1. Check Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: `api_call_logs`, `payments`, `refund_requests`, `reports`, `user_profiles`

### 2. Check RLS Status

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true`

### 3. Check Policies

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

You should see multiple policies per table.

### 4. Test User Creation

Sign up a test user in your app or via Supabase Auth UI. Check that:
```sql
SELECT * FROM user_profiles;
```

The profile should be auto-created with the user's ID.

---

## Generating TypeScript Types

After applying migrations, generate TypeScript types:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Generate types
npx supabase gen types typescript --project-id your-project-id > types/database.ts
```

Or add to package.json:
```json
{
  "scripts": {
    "db:generate-types": "supabase gen types typescript --project-id your-project-id > types/database.ts"
  }
}
```

---

## Database Diagram

```
┌─────────────┐
│ auth.users  │
│ (Supabase)  │
└──────┬──────┘
       │
       ├──────────────────┬─────────────────┬──────────────┐
       │                  │                 │              │
       ▼                  ▼                 ▼              ▼
┌─────────────┐   ┌──────────────┐  ┌───────────┐  ┌──────────────┐
│   reports   │──▶│   payments   │  │  refund_  │  │     user_    │
│             │   │              │  │  requests │  │   profiles   │
│  - VIN      │   │  - Stripe ID │  │  - Docs   │  │  - Name      │
│  - Vehicle  │   │  - Amount    │  │  - Amount │  │  - Company   │
│  - Accident │   │  - Status    │  │  - Status │  │  - Prefs     │
│  - Results  │   └──────────────┘  └───────────┘  └──────────────┘
│  - PDF      │
│  - Status   │
└──────┬──────┘
       │
       ▼
┌──────────────┐
│ api_call_logs│
│              │
│  - Provider  │
│  - Cost      │
│  - Success   │
└──────────────┘
```

---

## Troubleshooting

### Error: "relation does not exist"
- Ensure migrations run in order (schema before policies)
- Check Supabase dashboard for any failed queries

### Error: "permission denied for table"
- RLS policies not applied correctly
- Re-run `20241210000001_rls_policies.sql`

### Error: "new row violates check constraint"
- Check ENUM values match exactly (case-sensitive)
- Valid statuses: `draft`, `pending`, `completed`, `failed`

### Profile not auto-created
- Check trigger exists: `on_auth_user_created`
- Test by creating new user via Supabase Auth UI

---

## Next Steps

1. ✅ Apply migrations
2. ✅ Verify tables and RLS policies
3. ✅ Generate TypeScript types
4. ⏭️ Implement authentication routes (Phase 2 continued)

---

**Need Help?**
- Check Supabase docs: https://supabase.com/docs
- Review migration files for comments
- Test with SQL queries in Supabase dashboard
