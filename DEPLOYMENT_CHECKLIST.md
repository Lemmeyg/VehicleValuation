# Deployment Checklist - PDF Download Feature

Follow these steps to deploy the PDF download feature to production.

## ✅ Pre-Deployment (What You've Already Done)

- [x] Updated `DISABLE_PAYMENT_CHECK=true` in production environment variables
- [x] Code updates completed locally

## 📋 Deployment Steps

### Step 1: Commit and Push Code Changes

```bash
git add .
git commit -m "feat: Add configurable PDF payment requirement with REQUIRE_PAYMENT_FOR_PDF"
git push origin main
```

**What changed:**
- PDF generation now uses `REQUIRE_PAYMENT_FOR_PDF` instead of relying on `DISABLE_PAYMENT_CHECK`
- All `.env` example files updated with the new variable
- Better separation of concerns (payment checks vs PDF downloads)

### Step 2: Wait for Production Deployment

- Your hosting platform (Vercel/Netlify/etc.) will automatically deploy
- Wait for deployment to complete (usually 2-5 minutes)
- ✅ Check deployment status in your platform dashboard

### Step 3: Set Up Supabase Storage (Production)

#### 3a. Check if `vehicle-reports` bucket exists

1. Go to **Production Supabase Dashboard**
2. Navigate to **Storage** (left sidebar)
3. Look for `vehicle-reports` bucket

#### 3b. Create bucket (if it doesn't exist)

1. Click **"New bucket"**
2. Settings:
   - **Name**: `vehicle-reports`
   - **Public**: **ON** ✓
   - **File size limit**: 10 MB (optional)
   - **Allowed MIME types**: `application/pdf` (optional)
3. Click **"Create bucket"**

#### 3c. Add RLS Policies

1. Go to **SQL Editor** in Supabase
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
5. Verify: "Success. No rows returned"

### Step 4: Update Production Environment Variables (Optional Cleanup)

Now that the code uses `REQUIRE_PAYMENT_FOR_PDF`, you can optionally clean up:

**Current setup (working):**
- `DISABLE_PAYMENT_CHECK=true` ← Currently in use

**New setup (recommended after deployment):**
- Remove or set `DISABLE_PAYMENT_CHECK=false`
- Add `REQUIRE_PAYMENT_FOR_PDF=false`

**To update:**

1. Go to your hosting platform environment variables
2. **Option A - Clean transition:**
   - Add: `REQUIRE_PAYMENT_FOR_PDF=false`
   - Set: `DISABLE_PAYMENT_CHECK=false`
   - Redeploy

3. **Option B - Keep current (works fine):**
   - Leave `DISABLE_PAYMENT_CHECK=true` as is
   - No changes needed

> **Note:** The new code checks `REQUIRE_PAYMENT_FOR_PDF` first, so it will work regardless of `DISABLE_PAYMENT_CHECK` value.

### Step 5: Test PDF Download

1. Navigate to your production site
2. Log in with a user account
3. Go to any report (or create a new one)
4. Click **"Download PDF"** button
5. Verify:
   - ✅ Loading spinner appears
   - ✅ PDF generates successfully
   - ✅ PDF opens in new tab
   - ✅ PDF contains correct report data

### Step 6: Verify Storage (Optional)

1. Go to Supabase Dashboard > Storage > vehicle-reports
2. Navigate to `reports/{user-id}/`
3. You should see the generated PDF file
4. Click on it to verify it's accessible

## 🎯 Success Criteria

- [ ] Code deployed to production
- [ ] `vehicle-reports` bucket exists in production Supabase
- [ ] RLS policies applied successfully
- [ ] Environment variables configured
- [ ] Test PDF download works
- [ ] PDF opens and displays correctly

## 🔧 Troubleshooting

### Error: "Failed to upload PDF"

**Solution:**
1. Verify `vehicle-reports` bucket exists (Step 3b)
2. Verify RLS policies are applied (Step 3c)
3. Check Supabase Storage logs for errors

### Error: "Report has not been paid for"

**Solution:**
1. Verify `DISABLE_PAYMENT_CHECK=true` OR `REQUIRE_PAYMENT_FOR_PDF=false`
2. Redeploy if you changed environment variables

### PDF generates but doesn't open

**Solution:**
1. Check browser console for errors
2. Verify bucket is public (Settings > Make bucket public)
3. Test the PDF URL directly in a new tab

### RLS policy errors when running SQL

**Solution:**
1. If you see "policy already exists", that's OK - skip it
2. If you see "permission denied", verify you're using the correct Supabase project
3. Make sure you're logged in as project owner/admin

## 📚 Related Documentation

- [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) - Detailed production setup guide
- [Migration SQL](./supabase/migrations/20260111000000_create_vehicle_reports_bucket.sql) - Storage bucket migration

## 🎉 Post-Deployment

Once everything is working:

1. Monitor for any errors in production logs
2. Test with multiple users/reports
3. Consider adding `REQUIRE_PAYMENT_FOR_PDF=true` later if you want to monetize PDFs

---

**Last Updated:** 2026-01-11
**Deployment Type:** Production
**Feature:** Free PDF Downloads
