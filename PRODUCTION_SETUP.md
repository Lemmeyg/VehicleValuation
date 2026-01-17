# Production Setup Guide

This guide explains production setup requirements including security settings and PDF downloads.

---

## Security Settings (Supabase Dashboard)

### Enable Leaked Password Protection (Recommended)

Supabase Auth can prevent users from using compromised passwords by checking against HaveIBeenPwned.org.

**To enable:**
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
2. Navigate to **Authentication** > **Settings** (in the left sidebar)
3. Scroll to **Security** section
4. Find **"Leaked Password Protection"**
5. Toggle it **ON** and save

This recommended security enhancement:
- Checks passwords against known data breaches
- Prevents users from setting compromised passwords
- Runs automatically during signup and password changes
- Has no performance impact on your application

> **Note:** This is a dashboard-only setting and cannot be configured via migrations.

---

## PDF Downloads

### Overview

The PDF download feature requires:
1. Storage bucket in Supabase
2. RLS (Row Level Security) policies
3. Environment variables configured

## Step 1: Verify Storage Bucket Exists in Production

### Check if bucket exists:

1. Go to your **Production** Supabase Dashboard:
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/storage/buckets

2. Look for a bucket named `vehicle-reports`

3. If it **doesn't exist**, create it:
   - Click **"New bucket"**
   - Name: `vehicle-reports`
   - Public: **Yes** (toggle ON)
   - Click **"Create bucket"**

## Step 2: Add RLS Policies

### Option A: Using SQL Editor (Recommended)

1. Go to **SQL Editor**: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql

2. Click **"New query"**

3. Copy and paste this SQL:

```sql
-- Allow authenticated users to upload their own reports
CREATE POLICY "Users can upload their own vehicle reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow public read access for vehicle reports
CREATE POLICY "Anyone can read vehicle reports"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-reports');

-- Allow authenticated users to update their own reports
CREATE POLICY "Users can update their own vehicle reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow authenticated users to delete their own reports
CREATE POLICY "Users can delete their own vehicle reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
```

4. Click **"Run"**

5. Verify success (you should see "Success. No rows returned")

### Option B: Using Storage UI

1. Go to **Storage** > **vehicle-reports** > **Policies**

2. Click **"New Policy"** > **"For full customization"**

3. Add each policy one by one using the SQL above

## Step 3: Configure Environment Variables

Add this to your **production environment variables** (e.g., Vercel, Netlify, etc.):

```bash
# Set to "false" to allow FREE PDF downloads
# Set to "true" to require payment before PDF download
REQUIRE_PAYMENT_FOR_PDF=false
```

### Where to add this:

#### If using Vercel:
1. Go to your project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add: `REQUIRE_PAYMENT_FOR_PDF` = `false`
4. Click **Save**
5. **Redeploy** your application

#### If using Netlify:
1. Go to **Site settings** > **Environment variables**
2. Add: `REQUIRE_PAYMENT_FOR_PDF` = `false`
3. Click **Save**
4. **Trigger a new deploy**

#### If using other platforms:
Consult your platform's documentation for setting environment variables.

## Step 4: Deploy & Test

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: Enable free PDF downloads in production"
   git push origin main
   ```

2. **Wait for deployment** to complete

3. **Test PDF download**:
   - Navigate to any report on your production site
   - Click **"Download PDF"** button
   - PDF should generate and download successfully

## Troubleshooting

### Error: "Failed to upload PDF"

**Cause**: Storage bucket doesn't exist or RLS policies are missing

**Solution**:
1. Verify bucket exists (Step 1)
2. Verify policies are created (Step 2)
3. Check Supabase logs for specific errors

### Error: "Report has not been paid for"

**Cause**: `REQUIRE_PAYMENT_FOR_PDF` is set to `true` or not set at all

**Solution**:
1. Set `REQUIRE_PAYMENT_FOR_PDF=false` in production environment
2. Redeploy your application

### Error: "Unauthorized"

**Cause**: User is not logged in

**Solution**:
- User must be authenticated to generate PDFs
- Ensure authentication is working in production

## Payment-Required PDF Downloads (Optional)

If you want to **require payment** before allowing PDF downloads:

1. Set environment variable:
   ```bash
   REQUIRE_PAYMENT_FOR_PDF=true
   ```

2. Configure Lemon Squeezy payment integration:
   - Add Lemon Squeezy API credentials to production env
   - See `.env.production.example` for required variables

3. Redeploy

## Architecture

### How PDF Generation Works:

1. User clicks "Download PDF" button
2. Frontend calls `/api/reports/[id]/generate-pdf`
3. API verifies:
   - User is authenticated
   - User owns the report
   - Payment status (if `REQUIRE_PAYMENT_FOR_PDF=true`)
4. PDF is generated using `@react-pdf/renderer`
5. PDF is uploaded to `vehicle-reports` bucket at:
   - Path: `reports/{user_id}/{report-id-timestamp}.pdf`
6. Public URL is returned and stored in `reports.pdf_url`
7. User's browser opens PDF in new tab

### Security:

- **RLS Policies** ensure users can only upload to their own folder
- **Public read access** allows sharing PDF links
- **Authentication required** for upload/update/delete operations

## Need Help?

- Check Supabase Storage logs: Dashboard > Storage > Logs
- Check application logs in your deployment platform
- Review `lib/services/pdf-generator.tsx` for PDF generation logic
- Review `app/api/reports/[id]/generate-pdf/route.ts` for API logic
