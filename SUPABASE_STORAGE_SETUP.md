# Supabase Storage Setup Guide

This guide explains how to set up Supabase Storage for storing vehicle report PDFs.

## Prerequisites

- Supabase project already created (from Phase 2)
- Admin access to Supabase Dashboard

---

## Step 1: Create Storage Bucket

1. **Navigate to Storage**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Click **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **New bucket**
   - Bucket name: `vehicle-reports`
   - Public bucket: **YES** (check the box)
   - Click **Create bucket**

> **Why public?** Users need to download their PDF reports directly. We'll use RLS policies to control access.

---

## Step 2: Set Up Storage Policies

After creating the bucket, you need to configure Row Level Security (RLS) policies.

### Policy 1: Allow Users to Read Their Own Reports

```sql
-- Allow authenticated users to read their own reports
CREATE POLICY "Users can read own reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**What this does:**
- Users can only access PDFs in folders named with their user ID
- Folder structure: `reports/{user_id}/{filename}.pdf`

### Policy 2: Allow System to Insert Reports

```sql
-- Allow service role to insert reports
CREATE POLICY "Service role can insert reports"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'vehicle-reports');
```

**What this does:**
- Backend services can upload PDFs to any folder
- Uses the service role key for uploads

### Policy 3: Allow System to Update Reports

```sql
-- Allow service role to update reports
CREATE POLICY "Service role can update reports"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'vehicle-reports');
```

**What this does:**
- Backend can replace or update existing PDFs if needed

### Policy 4: Allow System to Delete Reports

```sql
-- Allow service role to delete reports
CREATE POLICY "Service role can delete reports"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'vehicle-reports');
```

**What this does:**
- Backend can remove old or invalid reports

---

## Step 3: Apply Policies in Supabase Dashboard

### Option A: Using SQL Editor (Recommended)

1. Click **SQL Editor** in left sidebar
2. Click **New query**
3. Paste all four policies above
4. Click **Run**
5. Verify "Success. No rows returned" message

### Option B: Using Storage Policies UI

1. Go to **Storage** → **Policies**
2. Click **New Policy** for each policy
3. Fill in the policy details manually
4. Click **Review** then **Save policy**

---

## Step 4: Verify Setup

### Test Bucket Access

Run this query in SQL Editor to verify bucket exists:

```sql
SELECT * FROM storage.buckets WHERE name = 'vehicle-reports';
```

Expected output:
- `id`: (UUID)
- `name`: vehicle-reports
- `public`: true

### Test Policies

Run this query to verify policies exist:

```sql
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

You should see 4 policies listed.

---

## Step 5: Update Database Schema (Optional)

If you haven't already added the `pdf_url` column to reports table, add it now:

```sql
-- Add pdf_url column to reports table
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_pdf_url ON reports(pdf_url) WHERE pdf_url IS NOT NULL;
```

---

## Folder Structure

PDFs will be stored in this structure:

```
vehicle-reports/
├── reports/
│   ├── {user_id_1}/
│   │   ├── report-{report_id}-{timestamp}.pdf
│   │   └── report-{report_id}-{timestamp}.pdf
│   ├── {user_id_2}/
│   │   └── report-{report_id}-{timestamp}.pdf
│   └── ...
```

**Benefits:**
- Easy to find all reports for a specific user
- Natural RLS boundary (users can only access their folder)
- Prevents filename collisions

---

## Access Control Flow

### Upload Flow (Backend Service)
1. Service uses `SUPABASE_SERVICE_ROLE_KEY`
2. Bypasses RLS policies
3. Uploads to `reports/{user_id}/{filename}.pdf`

### Download Flow (User)
1. User authenticated with `SUPABASE_ANON_KEY`
2. RLS policy checks folder name matches user ID
3. If match, grants access to PDF
4. User can download via public URL

---

## Testing

### Test Upload (from backend)

```typescript
import { createServerSupabaseClient } from '@/lib/db/supabase'

const supabase = await createServerSupabaseClient()

// Upload test file
const { data, error } = await supabase.storage
  .from('vehicle-reports')
  .upload('reports/test-user-id/test.pdf', pdfBuffer, {
    contentType: 'application/pdf',
  })

console.log('Upload result:', data, error)
```

### Test Download (from client)

```typescript
import { createClientSupabaseClient } from '@/lib/db/supabase'

const supabase = createClientSupabaseClient()

// Get public URL
const { data } = supabase.storage
  .from('vehicle-reports')
  .getPublicUrl('reports/your-user-id/test.pdf')

console.log('Download URL:', data.publicUrl)
```

---

## Troubleshooting

### "Bucket not found" Error

**Solution:**
- Verify bucket name is exactly `vehicle-reports`
- Check bucket was created successfully in Dashboard

### "Access Denied" Error

**Solution:**
- Check RLS policies are enabled and correct
- Verify user ID in folder path matches authenticated user
- Ensure bucket is marked as public

### "Upload Failed" Error

**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check file size (Supabase free tier: 1GB storage limit)
- Ensure folder path format is correct

### PDF Not Accessible

**Solution:**
- Verify bucket is public
- Check RLS policies allow SELECT
- Ensure file exists: `SELECT * FROM storage.objects WHERE bucket_id = 'vehicle-reports'`

---

## Security Best Practices

1. **Never expose service role key to client**
   - Only use in server-side code
   - Never include in client bundles

2. **Always use folder-based isolation**
   - Store user files in folders named with user IDs
   - RLS policies enforce this separation

3. **Validate file types**
   - Only allow PDF uploads
   - Check contentType before storing

4. **Monitor storage usage**
   - Free tier: 1GB storage
   - Set up alerts for approaching limits

---

## Next Steps

After setup:
- ✅ Create bucket: `vehicle-reports`
- ✅ Apply RLS policies
- ✅ Add `pdf_url` column to reports table
- Test upload/download flow
- Integrate with PDF generation API

---

**Setup Complete!** Your Supabase Storage is ready for PDF reports.
