# Knowledge Base Upload Fix

This document explains the issues found and fixes applied to the knowledge base article upload functionality.

## Issues Found

### 1. ❌ Invalid Supabase Upsert Syntax

**Location:** `app/api/admin/knowledge-base/upload/route.ts:97-101`

**Problem:**
```typescript
.upsert(articleData, {
  onConflict: 'slug',  // ❌ NOT valid Supabase JS syntax
})
```

The Supabase JavaScript client doesn't support the `onConflict` parameter. It automatically uses the table's UNIQUE constraints.

**Fix:**
```typescript
// Upsert uses the UNIQUE constraint on 'slug' column (no onConflict parameter needed)
.upsert(articleData)
```

### 2. ❌ Silent Error Handling

**Problem:**
- The API always returned HTTP 200 with `success: true` even when all uploads failed
- The client only checked HTTP status codes, not the `uploaded` count
- Errors were logged but not properly surfaced to the user

**Fix:**
- Changed API to return `success: false` when no files were uploaded
- Added detailed logging with `[UPLOAD_ERROR]`, `[DB_ERROR]`, `[UPLOAD_SUCCESS]` prefixes
- Enhanced client-side validation to check both `response.ok` AND `data.success`
- Display specific error messages from the API response

### 3. ⚠️ Missing Storage Bucket

**Problem:**
The `knowledge-base-content` storage bucket must be created manually in Supabase Dashboard. If it doesn't exist, all uploads fail with storage errors.

**Fix:**
Created a setup script to verify and create the bucket automatically.

### 4. ❌ RLS Policies Blocking Storage and Database Operations

**Problem:**
Both the storage bucket and `articles` table RLS policies only allowed `service_role` to perform write operations. The API was using the authenticated user's client, causing "new row violates row-level security policy" errors for both storage uploads and database inserts.

**Fix:**
- Updated upload route to use `supabaseAdmin` (service role client) for **ALL** operations (storage + database)
- This bypasses RLS policies entirely, ensuring reliable uploads
- Admin access is still validated via `requireAdmin()` middleware before any operations
- Created optional migration to allow authenticated admin users as an alternative approach

---

## Fixes Applied

### API Route Changes (`app/api/admin/knowledge-base/upload/route.ts`)

1. **Fixed upsert syntax** (line 97-100)
2. **Changed to use admin client for ALL operations:**
   - Imports only `supabaseAdmin` (removed `createServerSupabaseClient`)
   - Uses `supabaseAdmin` for both storage AND database operations
   - Bypasses all RLS policies for reliable uploads
   - Admin access still validated via `requireAdmin()` middleware
3. **Added detailed logging:**
   - `[UPLOAD_ERROR]` - Storage upload failures
   - `[UPLOAD_SUCCESS]` - Successful storage uploads
   - `[DB_ERROR]` - Database insert failures
   - `[DB_SUCCESS]` - Successful database inserts
   - `[CLEANUP]` - File removal on DB errors
   - `[UPLOAD_SUMMARY]` - Final upload summary

3. **Improved response structure:**
   ```typescript
   {
     success: results.length > 0,  // Only true if at least one file succeeded
     uploaded: results.length,     // Number of successful uploads
     total: files.length,           // Total files attempted
     results: [...],                // Array of successful uploads
     errors: [...]                  // Array of error messages (if any)
   }
   ```

### Client Changes (`app/admin/knowledge-base/upload/page.tsx`)

1. **Enhanced error checking:**
   - Now checks both `response.ok` AND `data.success`
   - Validates that `data.uploaded > 0`
   - Shows specific error messages from `data.errors` array

2. **Better message display:**
   - Error and success messages now support multiline text (`whitespace-pre-wrap`)
   - Shows warnings alongside success messages if some files failed
   - Icons have `flex-shrink-0` to prevent wrapping issues

### New Files Created

1. **`scripts/setup-storage-bucket.ts`**
   - Verifies the `knowledge-base-content` bucket exists
   - Creates the bucket if it doesn't exist
   - Sets up proper configuration (public, 5MB limit, markdown/text only)
   - Tests upload/download permissions
   - Provides detailed status and troubleshooting output

2. **`test-article.md`**
   - Sample markdown file with proper frontmatter
   - Ready to use for testing the upload functionality
   - Demonstrates the required YAML fields

3. **`supabase/migrations/20241224000000_fix_storage_rls_policies.sql`**
   - Adds RLS policies for authenticated admin users
   - Alternative to using service role (for future flexibility)
   - Allows admin users to upload/update/delete storage files

---

## How to Fix Your Setup

### Step 1: Run the Storage Bucket Setup Script

```bash
# Install dependencies if needed
npm install tsx dotenv --save-dev

# Run the setup script
npx tsx scripts/setup-storage-bucket.ts
```

This will:
- ✅ Check if the bucket exists
- ✅ Create it if needed
- ✅ Verify upload/download permissions
- ✅ Test that everything works

**Expected Output:**
```
🚀 Starting storage bucket setup...

✅ Connected to Supabase

🔍 Checking if bucket 'knowledge-base-content' exists...
📦 Creating bucket 'knowledge-base-content'...
✅ Bucket 'knowledge-base-content' created successfully!

📋 Bucket details:
   - Name: knowledge-base-content
   - Public: true
   - Max file size: 5MB
   - Allowed types: text/markdown, text/plain

🧪 Testing bucket access...
✅ Test file uploaded successfully
✅ Test file cleaned up

🎉 Storage bucket setup complete!
```

### Step 2: Test the Upload

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `/admin/knowledge-base/upload`

3. Upload the test file `test-article.md`

4. Check the terminal logs for detailed output:
   ```
   [UPLOAD_SUCCESS] File uploaded to storage: { file: 'test-article.md', path: '...' }
   [DB_SUCCESS] Article inserted/updated: { file: 'test-article.md', slug: '...' }
   [UPLOAD_SUMMARY] { totalFiles: 1, successful: 1, failed: 0 }
   ```

5. Navigate to `/admin/knowledge-base` to see your uploaded article

### Step 3: Verify in Supabase Dashboard

1. **Check Storage:**
   - Go to Supabase Dashboard → Storage → `knowledge-base-content`
   - You should see: `knowledge-base/total-loss-claims/understanding-total-loss-claims.md`

2. **Check Database:**
   - Go to Supabase Dashboard → Table Editor → `articles`
   - You should see a row with `slug: 'understanding-total-loss-claims'`

---

## Common Errors and Solutions

### Error: "Bucket not found"

**Cause:** The `knowledge-base-content` bucket doesn't exist

**Solution:**
```bash
npx tsx scripts/setup-storage-bucket.ts
```

### Error: "Database insert failed - duplicate key value violates unique constraint"

**Cause:** An article with that `slug` already exists

**Solution:** Either:
- Delete the existing article from the `articles` table
- Change the `slug` in your markdown frontmatter
- The upsert should now work correctly (after the fix)

### Error: "new row violates row-level security policy"

**Cause:** RLS policies are blocking the storage upload

**Solution:**
This issue has been fixed! The upload route now uses `supabaseAdmin` (service role) for storage operations, which bypasses RLS policies.

If you still see this error:
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in your `.env.local` file
2. Restart your development server after adding the key
3. Verify the key is correct in Supabase Dashboard → Project Settings → API

**Alternative solution (if not using service role):**
1. Run the migration: `supabase/migrations/20241224000000_fix_storage_rls_policies.sql`
2. This adds policies allowing authenticated admin users to upload
3. Verify admin user has `is_admin: true` in their user metadata

### Error: "Missing required fields"

**Cause:** Markdown frontmatter is missing required fields

**Required fields:**
- `title`
- `slug`
- `category`
- `description`
- `author`

**Solution:** Add all required fields to your markdown frontmatter:
```yaml
---
title: 'Your Title'
slug: 'your-slug'
category: 'Category Name'
description: 'Description here'
author: 'Author Name'
datePublished: '2024-12-24'
dateModified: '2024-12-24'
featured: false
published: true
---
```

---

## Debugging Tips

### Enable Detailed Logging

The API route now logs detailed information. Watch your terminal for:

```bash
# Storage upload
[UPLOAD_SUCCESS] File uploaded to storage: { file: '...', path: '...' }
[UPLOAD_ERROR] Storage upload failed: { file: '...', error: '...' }

# Database operations
[DB_SUCCESS] Article inserted/updated: { file: '...', slug: '...' }
[DB_ERROR] Database insert failed: { file: '...', error: '...' }

# Cleanup
[CLEANUP] Removing file from storage due to DB error: ...

# Summary
[UPLOAD_SUMMARY] { totalFiles: 1, successful: 1, failed: 0, errors: [] }
```

### Check Browser DevTools

1. Open DevTools → Network tab
2. Upload a file
3. Find the request to `/api/admin/knowledge-base/upload`
4. Check the response:
   ```json
   {
     "success": true,
     "uploaded": 1,
     "total": 1,
     "results": [...],
     "errors": []
   }
   ```

### Verify Environment Variables

Ensure these are set in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Migration Checklist

- [x] Fixed invalid `onConflict` syntax in API route
- [x] Added comprehensive error logging
- [x] Improved client-side error handling
- [x] Created storage bucket setup script
- [x] Created sample test file
- [x] Updated error/success message display
- [x] Changed `success` response to reflect actual upload status

---

## Files Modified

| File | Changes |
|------|---------|
| `app/api/admin/knowledge-base/upload/route.ts` | Fixed upsert syntax, added logging, improved error handling |
| `app/admin/knowledge-base/upload/page.tsx` | Enhanced client-side validation, improved message display |

## Files Created

| File | Purpose |
|------|---------|
| `scripts/setup-storage-bucket.ts` | Automated bucket setup and verification |
| `test-article.md` | Sample markdown file for testing |
| `KNOWLEDGE_BASE_UPLOAD_FIX.md` | This documentation |

---

## Next Steps

After confirming uploads work:

1. **Create more test articles** with different categories
2. **Verify the knowledge base display page** shows all articles correctly
3. **Test the search functionality** if implemented
4. **Set up automated backups** for the articles table
5. **Consider adding:**
   - Bulk upload feature
   - Draft management
   - Version history
   - Image upload support

---

## Support

If you encounter issues not covered in this document:

1. Check the terminal logs for `[UPLOAD_ERROR]` or `[DB_ERROR]` messages
2. Verify the storage bucket exists and is public
3. Check RLS policies in Supabase Dashboard
4. Ensure all environment variables are set correctly
5. Try uploading the provided `test-article.md` file first

---

**Last Updated:** December 24, 2024
**Version:** 1.0
